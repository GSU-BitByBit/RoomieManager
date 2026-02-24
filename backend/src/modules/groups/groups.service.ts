import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  GroupMemberRole,
  GroupMemberStatus,
  Prisma,
  type Group,
  type GroupMember
} from '@prisma/client';
import { randomInt } from 'node:crypto';

import { ErrorCode } from '../../common/http/http-error-code';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { JoinGroupDto } from './dto/join-group.dto';
import type { GroupSummary, JoinCodeResetResponse } from './interfaces/group-response.interface';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 8;
const MAX_JOIN_CODE_ATTEMPTS = 12;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(userId: string, payload: CreateGroupDto): Promise<GroupSummary> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: payload.name.trim(),
          createdBy: userId
        }
      });

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const joinCode = await this.rotateJoinCode(tx, group.id, userId);

      return this.mapGroupSummary(
        group,
        {
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        },
        1,
        joinCode
      );
    });
  }

  async joinGroup(userId: string, payload: JoinGroupDto): Promise<GroupSummary> {
    const normalizedCode = this.normalizeJoinCode(payload.joinCode);

    return this.prisma.$transaction(async (tx) => {
      const joinCodeRecord = await tx.joinCode.findUnique({
        where: { code: normalizedCode },
        include: { group: true }
      });

      if (!joinCodeRecord) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Invalid join code.'
        });
      }

      const existingMembership = await tx.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: joinCodeRecord.groupId,
            userId
          }
        }
      });

      let membership: GroupMember;

      if (existingMembership?.status === GroupMemberStatus.ACTIVE) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: 'You are already a member of this group.'
        });
      }

      if (existingMembership) {
        membership = await tx.groupMember.update({
          where: { id: existingMembership.id },
          data: {
            status: GroupMemberStatus.ACTIVE,
            joinedAt: new Date()
          }
        });
      } else {
        membership = await tx.groupMember.create({
          data: {
            groupId: joinCodeRecord.groupId,
            userId,
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.ACTIVE
          }
        });
      }

      const memberCount = await tx.groupMember.count({
        where: {
          groupId: joinCodeRecord.groupId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const shouldIncludeJoinCode = membership.role === GroupMemberRole.ADMIN;

      return this.mapGroupSummary(
        joinCodeRecord.group,
        membership,
        memberCount,
        shouldIncludeJoinCode ? joinCodeRecord.code : undefined
      );
    });
  }

  async resetJoinCode(userId: string, groupId: string): Promise<JoinCodeResetResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertAdminMembership(tx, userId, groupId);

      const joinCode = await this.rotateJoinCode(tx, groupId, userId);

      return {
        groupId,
        joinCode
      };
    });
  }

  async getGroup(userId: string, groupId: string): Promise<GroupSummary> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        },
        include: {
          group: true
        }
      });

      if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
        throw new ForbiddenException({
          code: ErrorCode.Forbidden,
          message: 'You do not have access to this group.'
        });
      }

      const memberCount = await tx.groupMember.count({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      let joinCode: string | undefined;
      if (membership.role === GroupMemberRole.ADMIN) {
        const codeRecord = await tx.joinCode.findUnique({
          where: { groupId },
          select: { code: true }
        });
        joinCode = codeRecord?.code;
      }

      return this.mapGroupSummary(membership.group, membership, memberCount, joinCode);
    });
  }

  private async assertAdminMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'You must be an active member of this group.'
      });
    }

    if (membership.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'Only group admins can reset join codes.'
      });
    }

    const groupExists = await tx.group.findUnique({
      where: { id: groupId },
      select: { id: true }
    });

    if (!groupExists) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Group not found.'
      });
    }

    return membership;
  }

  private async rotateJoinCode(
    tx: Prisma.TransactionClient,
    groupId: string,
    createdBy: string
  ): Promise<string> {
    for (let attempt = 1; attempt <= MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
      const candidate = this.generateJoinCode();

      try {
        await tx.joinCode.upsert({
          where: { groupId },
          update: {
            code: candidate,
            createdBy
          },
          create: {
            groupId,
            code: candidate,
            createdBy
          }
        });

        return candidate;
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

        if (!isUniqueConflict || attempt === MAX_JOIN_CODE_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new ConflictException({
      code: ErrorCode.Conflict,
      message: 'Unable to generate a unique join code. Please retry.'
    });
  }

  private generateJoinCode(): string {
    return Array.from({ length: JOIN_CODE_LENGTH }, () => {
      const index = randomInt(0, JOIN_CODE_ALPHABET.length);
      return JOIN_CODE_ALPHABET[index];
    }).join('');
  }

  private normalizeJoinCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private mapGroupSummary(
    group: Group,
    membership: Pick<GroupMember, 'role' | 'status'>,
    memberCount: number,
    joinCode?: string
  ): GroupSummary {
    return {
      id: group.id,
      name: group.name,
      createdBy: group.createdBy,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      memberRole: membership.role,
      memberStatus: membership.status,
      memberCount,
      ...(joinCode ? { joinCode } : {})
    };
  }
}
