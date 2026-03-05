import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  ChoreStatus,
  GroupMemberRole,
  GroupMemberStatus,
  Prisma,
  type Group,
  type GroupMember
} from '@prisma/client';
import { randomInt } from 'node:crypto';

import { ErrorCode } from '../../common/http/http-error-code';
import { buildPaginationMeta, resolvePagination } from '../../common/http/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { JoinGroupDto } from './dto/join-group.dto';
import { ListGroupMembersQueryDto } from './dto/list-group-members.query';
import { ListUserGroupsQueryDto } from './dto/list-user-groups.query';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import type {
  GroupDashboardResponse,
  GroupMemberRemoveResponse,
  GroupMemberRoleUpdateResponse,
  GroupMembersResponse,
  GroupSummary,
  JoinCodeResetResponse,
  UserGroupsResponse
} from './interfaces/group-response.interface';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 8;
const MAX_JOIN_CODE_ATTEMPTS = 12;
const AUDIT_ACTION_MEMBER_ROLE_UPDATED = 'MEMBER_ROLE_UPDATED';
const AUDIT_ACTION_MEMBER_REMOVED = 'MEMBER_REMOVED';

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

  async listUserGroups(
    userId: string,
    query: ListUserGroupsQueryDto = new ListUserGroupsQueryDto()
  ): Promise<UserGroupsResponse> {
    return this.prisma.$transaction(async (tx) => {
      const pagination = resolvePagination(query);

      const totalGroups = await tx.groupMember.count({
        where: {
          userId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const memberships = await tx.groupMember.findMany({
        where: {
          userId,
          status: GroupMemberStatus.ACTIVE
        },
        include: {
          group: {
            include: {
              joinCode: {
                select: { code: true }
              }
            }
          }
        },
        orderBy: this.buildUserGroupsOrderBy(query),
        skip: pagination.skip,
        take: pagination.take
      });

      const groupIds = memberships.map((membership) => membership.groupId);
      const activeMemberCounts =
        groupIds.length === 0
          ? []
          : await tx.groupMember.groupBy({
              by: ['groupId'],
              where: {
                groupId: { in: groupIds },
                status: GroupMemberStatus.ACTIVE
              },
              _count: { _all: true }
            });

      const activeMemberCountByGroupId = new Map(
        activeMemberCounts.map((entry) => [entry.groupId, entry._count._all])
      );

      return {
        groups: memberships.map((membership) =>
          this.mapGroupSummary(
            membership.group,
            membership,
            activeMemberCountByGroupId.get(membership.groupId) ?? 0,
            membership.role === GroupMemberRole.ADMIN ? membership.group.joinCode?.code : undefined
          )
        ),
        pagination: buildPaginationMeta(pagination.page, pagination.pageSize, totalGroups)
      };
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
            role: GroupMemberRole.MEMBER,
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
      const membership = await this.assertActiveMembership(tx, userId, groupId, {
        includeGroup: true
      });

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

  async getGroupDashboard(userId: string, groupId: string): Promise<GroupDashboardResponse> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.assertActiveMembership(tx, userId, groupId, {
        includeGroup: true
      });

      const shouldIncludeJoinCode = membership.role === GroupMemberRole.ADMIN;
      const now = new Date();

      const [
        activeMemberCount,
        activeAdminCount,
        joinCodeRecord,
        pendingChoreCount,
        completedChoreCount,
        overdueChoreCount,
        assignedToMePendingCount,
        billCount,
        paymentCount,
        latestBill,
        latestPayment,
        contract
      ] = await Promise.all([
        tx.groupMember.count({
          where: {
            groupId,
            status: GroupMemberStatus.ACTIVE
          }
        }),
        tx.groupMember.count({
          where: {
            groupId,
            status: GroupMemberStatus.ACTIVE,
            role: GroupMemberRole.ADMIN
          }
        }),
        shouldIncludeJoinCode
          ? tx.joinCode.findUnique({
              where: { groupId },
              select: { code: true }
            })
          : Promise.resolve<{ code: string } | null>(null),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.PENDING
          }
        }),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.COMPLETED
          }
        }),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.PENDING,
            dueDate: {
              lt: now
            }
          }
        }),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.PENDING,
            assignedToUserId: userId
          }
        }),
        tx.bill.count({
          where: { groupId }
        }),
        tx.payment.count({
          where: { groupId }
        }),
        tx.bill.findFirst({
          where: { groupId },
          select: { incurredAt: true },
          orderBy: { incurredAt: 'desc' }
        }),
        tx.payment.findFirst({
          where: { groupId },
          select: { paidAt: true },
          orderBy: { paidAt: 'desc' }
        }),
        tx.contract.findUnique({
          where: { groupId },
          select: {
            draftContent: true,
            publishedVersion: true,
            updatedAt: true
          }
        })
      ]);

      return {
        group: this.mapGroupSummary(
          membership.group,
          membership,
          activeMemberCount,
          shouldIncludeJoinCode ? joinCodeRecord?.code : undefined
        ),
        members: {
          totalActive: activeMemberCount,
          adminCount: activeAdminCount,
          memberCount: Math.max(activeMemberCount - activeAdminCount, 0)
        },
        chores: {
          pendingCount: pendingChoreCount,
          completedCount: completedChoreCount,
          overdueCount: overdueChoreCount,
          assignedToMePendingCount
        },
        finance: {
          billCount,
          paymentCount,
          latestBillIncurredAt: latestBill?.incurredAt.toISOString() ?? null,
          latestPaymentPaidAt: latestPayment?.paidAt.toISOString() ?? null
        },
        contract: {
          hasDraft: (contract?.draftContent.trim().length ?? 0) > 0,
          publishedVersion: contract?.publishedVersion ?? null,
          updatedAt: contract?.updatedAt.toISOString() ?? null
        }
      };
    });
  }

  async getGroupMembers(
    userId: string,
    groupId: string,
    query: ListGroupMembersQueryDto = new ListGroupMembersQueryDto()
  ): Promise<GroupMembersResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);

      const pagination = resolvePagination(query);
      const totalMembers = await tx.groupMember.count({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const members = await tx.groupMember.findMany({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        },
        orderBy: this.buildMemberOrderBy(query),
        skip: pagination.skip,
        take: pagination.take
      });

      return {
        groupId,
        members: members.map((member) => this.mapGroupMemberSummary(member)),
        pagination: buildPaginationMeta(pagination.page, pagination.pageSize, totalMembers)
      };
    });
  }

  async updateMemberRole(
    actorUserId: string,
    groupId: string,
    memberUserId: string,
    payload: UpdateMemberRoleDto
  ): Promise<GroupMemberRoleUpdateResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertAdminMembership(tx, actorUserId, groupId);

        if (actorUserId === memberUserId) {
          throw new BadRequestException({
            code: ErrorCode.BadRequest,
            message: 'Use leave-group flow to change your own role.'
          });
        }

        const membership = await tx.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: memberUserId
            }
          }
        });

        if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
          throw new NotFoundException({
            code: ErrorCode.NotFound,
            message: 'Active member not found.'
          });
        }

        if (membership.role === payload.role) {
          return {
            groupId,
            userId: membership.userId,
            role: membership.role,
            status: membership.status,
            updatedAt: membership.updatedAt.toISOString()
          };
        }

        if (membership.role === GroupMemberRole.ADMIN && payload.role !== GroupMemberRole.ADMIN) {
          await this.assertNotLastAdmin(tx, groupId);
        }

        const updatedMembership = await tx.groupMember.update({
          where: { id: membership.id },
          data: {
            role: payload.role
          }
        });

        await this.recordAuditLog(tx, {
          groupId,
          actorUserId,
          targetUserId: memberUserId,
          action: AUDIT_ACTION_MEMBER_ROLE_UPDATED,
          details: {
            previousRole: membership.role,
            nextRole: updatedMembership.role
          }
        });

        return {
          groupId,
          userId: updatedMembership.userId,
          role: updatedMembership.role,
          status: updatedMembership.status,
          updatedAt: updatedMembership.updatedAt.toISOString()
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async removeMember(
    actorUserId: string,
    groupId: string,
    memberUserId: string
  ): Promise<GroupMemberRemoveResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertAdminMembership(tx, actorUserId, groupId);

        if (actorUserId === memberUserId) {
          throw new BadRequestException({
            code: ErrorCode.BadRequest,
            message: 'Use leave-group flow to remove yourself.'
          });
        }

        const membership = await tx.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: memberUserId
            }
          }
        });

        if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
          throw new NotFoundException({
            code: ErrorCode.NotFound,
            message: 'Active member not found.'
          });
        }

        if (membership.role === GroupMemberRole.ADMIN) {
          await this.assertNotLastAdmin(tx, groupId);
        }

        const updatedMembership = await tx.groupMember.update({
          where: { id: membership.id },
          data: {
            status: GroupMemberStatus.INACTIVE
          }
        });

        await this.recordAuditLog(tx, {
          groupId,
          actorUserId,
          targetUserId: memberUserId,
          action: AUDIT_ACTION_MEMBER_REMOVED,
          details: {
            previousRole: membership.role
          }
        });

        return {
          groupId,
          userId: updatedMembership.userId,
          status: updatedMembership.status,
          removed: true,
          updatedAt: updatedMembership.updatedAt.toISOString()
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async assertActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string
  ): Promise<GroupMember>;
  private async assertActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string,
    options: { includeGroup: true }
  ): Promise<GroupMember & { group: Group }>;
  private async assertActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string,
    options?: { includeGroup?: boolean }
  ): Promise<GroupMember | (GroupMember & { group: Group })> {
    const membership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      },
      ...(options?.includeGroup
        ? {
            include: {
              group: true
            }
          }
        : {})
    });

    if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'You do not have access to this group.'
      });
    }

    return membership as GroupMember | (GroupMember & { group: Group });
  }

  private async assertAdminMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await this.assertActiveMembership(tx, userId, groupId);

    if (membership.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'Only group admins can perform this action.'
      });
    }

    return membership;
  }

  private async assertNotLastAdmin(tx: Prisma.TransactionClient, groupId: string): Promise<void> {
    const activeAdminCount = await tx.groupMember.count({
      where: {
        groupId,
        status: GroupMemberStatus.ACTIVE,
        role: GroupMemberRole.ADMIN
      }
    });

    if (activeAdminCount <= 1) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: 'Group must have at least one admin.'
      });
    }
  }

  private async recordAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      groupId: string;
      actorUserId: string;
      targetUserId?: string;
      action: string;
      details?: Record<string, unknown>;
    }
  ): Promise<void> {
    await tx.groupAuditLog.create({
      data: {
        groupId: params.groupId,
        actorUserId: params.actorUserId,
        targetUserId: params.targetUserId,
        action: params.action,
        ...(params.details ? { details: params.details as Prisma.InputJsonValue } : {})
      }
    });
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

  private mapGroupMemberSummary(member: GroupMember): GroupMembersResponse['members'][number] {
    return {
      userId: member.userId,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt.toISOString(),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString()
    };
  }

  private buildMemberOrderBy(
    query: ListGroupMembersQueryDto
  ): Prisma.GroupMemberOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'joinedAt':
        return [{ joinedAt: query.sortOrder }, { createdAt: query.sortOrder }];
      case 'createdAt':
        return [{ createdAt: query.sortOrder }, { joinedAt: query.sortOrder }];
      case 'role':
      default:
        return [{ role: query.sortOrder }, { joinedAt: 'asc' }];
    }
  }

  private buildUserGroupsOrderBy(
    query: ListUserGroupsQueryDto
  ): Prisma.GroupMemberOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'name':
        return [{ group: { name: query.sortOrder } }, { joinedAt: 'desc' }];
      case 'createdAt':
        return [{ group: { createdAt: query.sortOrder } }, { joinedAt: 'desc' }];
      case 'joinedAt':
        return [{ joinedAt: query.sortOrder }, { createdAt: query.sortOrder }];
      case 'updatedAt':
      default:
        return [{ group: { updatedAt: query.sortOrder } }, { joinedAt: 'desc' }];
    }
  }
}
