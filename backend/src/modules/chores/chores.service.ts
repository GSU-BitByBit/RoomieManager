import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  ChoreStatus,
  ChoreActivityType,
  GroupMemberRole,
  GroupMemberStatus,
  Prisma,
  type Chore,
  type GroupMember
} from '@prisma/client';

import { ErrorCode } from '../../common/http/http-error-code';
import { buildPaginationMeta, resolvePagination } from '../../common/http/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateChoreDto } from './dto/create-chore.dto';
import type { ListChoresQueryDto } from './dto/list-chores.query';
import type { UpdateChoreAssigneeDto } from './dto/update-chore-assignee.dto';
import type { ChoreSummary, GroupChoresResponse } from './interfaces/chore-response.interface';

@Injectable()
export class ChoresService {
  constructor(private readonly prisma: PrismaService) {}

  async createChore(
    actorUserId: string,
    groupId: string,
    payload: CreateChoreDto
  ): Promise<ChoreSummary> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, actorUserId, groupId);

      let assigneeUserId: string | null = null;
      if (payload.assigneeUserId) {
        const assigneeMembership = await tx.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: payload.assigneeUserId
            }
          }
        });

        if (!assigneeMembership || assigneeMembership.status !== GroupMemberStatus.ACTIVE) {
          throw new BadRequestException({
            code: ErrorCode.BadRequest,
            message: 'Assignee must be an active member of the group.'
          });
        }

        assigneeUserId = payload.assigneeUserId;
      }

      const chore = await tx.chore.create({
        data: {
          groupId,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          status: ChoreStatus.PENDING,
          dueDate: payload.dueDate ?? null,
          assignedToUserId: assigneeUserId,
          createdBy: actorUserId
        }
      });

      await tx.choreActivity.create({
        data: {
          choreId: chore.id,
          groupId,
          actorUserId,
          type: ChoreActivityType.CREATED,
          details: {
            ...(assigneeUserId ? { assigneeUserId } : {})
          }
        }
      });

      if (assigneeUserId) {
        await tx.choreActivity.create({
          data: {
            choreId: chore.id,
            groupId,
            actorUserId,
            type: ChoreActivityType.ASSIGNED,
            details: {
              assigneeUserId
            }
          }
        });
      }

      return this.mapChoreSummary(chore);
    });
  }

  async listGroupChores(
    userId: string,
    groupId: string,
    query: ListChoresQueryDto
  ): Promise<GroupChoresResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);
      const pagination = resolvePagination(query);

      const where: Prisma.ChoreWhereInput = {
        groupId
      };

      if (query.status) {
        where.status = query.status;
      }

      if (query.assigneeUserId) {
        where.assignedToUserId = query.assigneeUserId;
      }

      if (query.dueAfter || query.dueBefore) {
        where.dueDate = {
          ...(query.dueAfter ? { gte: query.dueAfter } : {}),
          ...(query.dueBefore ? { lte: query.dueBefore } : {})
        };
      }

      const totalChores = await tx.chore.count({ where });

      const chores = await tx.chore.findMany({
        where,
        orderBy: this.buildChoreOrderBy(query),
        skip: pagination.skip,
        take: pagination.take
      });

      return {
        groupId,
        chores: chores.map((chore) => this.mapChoreSummary(chore)),
        pagination: buildPaginationMeta(pagination.page, pagination.pageSize, totalChores)
      };
    });
  }

  async updateChoreAssignee(
    actorUserId: string,
    choreId: string,
    payload: UpdateChoreAssigneeDto
  ): Promise<ChoreSummary> {
    return this.prisma.$transaction(async (tx) => {
      const chore = await tx.chore.findUnique({
        where: { id: choreId }
      });

      if (!chore) {
        throw new NotFoundException({
          code: ErrorCode.NotFound,
          message: 'Chore not found.'
        });
      }

      const membership = await this.assertActiveMembership(tx, actorUserId, chore.groupId);

      let assigneeUserId: string | null = null;
      if (payload.assigneeUserId) {
        const assigneeMembership = await tx.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId: chore.groupId,
              userId: payload.assigneeUserId
            }
          }
        });

        if (!assigneeMembership || assigneeMembership.status !== GroupMemberStatus.ACTIVE) {
          throw new BadRequestException({
            code: ErrorCode.BadRequest,
            message: 'Assignee must be an active member of the group.'
          });
        }

        if (
          membership.role !== GroupMemberRole.ADMIN &&
          payload.assigneeUserId !== membership.userId
        ) {
          throw new ForbiddenException({
            code: ErrorCode.Forbidden,
            message: 'Only admins can assign chores to other members.'
          });
        }

        assigneeUserId = payload.assigneeUserId;
      }

      const updated = await tx.chore.update({
        where: { id: choreId },
        data: {
          assignedToUserId: assigneeUserId
        }
      });

      await tx.choreActivity.create({
        data: {
          choreId: updated.id,
          groupId: updated.groupId,
          actorUserId,
          type: assigneeUserId ? ChoreActivityType.ASSIGNED : ChoreActivityType.UNASSIGNED,
          details: assigneeUserId
            ? {
                assigneeUserId
              }
            : undefined
        }
      });

      return this.mapChoreSummary(updated);
    });
  }

  async completeChore(actorUserId: string, choreId: string): Promise<ChoreSummary> {
    return this.prisma.$transaction(async (tx) => {
      const chore = await tx.chore.findUnique({
        where: { id: choreId }
      });

      if (!chore) {
        throw new NotFoundException({
          code: ErrorCode.NotFound,
          message: 'Chore not found.'
        });
      }

      const membership = await this.assertActiveMembership(tx, actorUserId, chore.groupId);
      const isAdmin = membership.role === GroupMemberRole.ADMIN;

      if (!isAdmin && chore.assignedToUserId && chore.assignedToUserId !== actorUserId) {
        throw new ForbiddenException({
          code: ErrorCode.Forbidden,
          message: 'Only admins or the assignee can complete this chore.'
        });
      }

      if (chore.status === ChoreStatus.COMPLETED) {
        return this.mapChoreSummary(chore);
      }

      const now = new Date();

      const updated = await tx.chore.update({
        where: { id: choreId },
        data: {
          status: ChoreStatus.COMPLETED,
          completedAt: now
        }
      });

      await tx.choreActivity.create({
        data: {
          choreId: updated.id,
          groupId: updated.groupId,
          actorUserId,
          type: ChoreActivityType.COMPLETED
        }
      });

      return this.mapChoreSummary(updated);
    });
  }

  private async assertActiveMembership(
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
        message: 'You do not have access to this group.'
      });
    }

    return membership;
  }

  private mapChoreSummary(chore: Chore): ChoreSummary {
    return {
      id: chore.id,
      groupId: chore.groupId,
      title: chore.title,
      description: chore.description,
      status: chore.status,
      dueDate: chore.dueDate?.toISOString() ?? null,
      assignedToUserId: chore.assignedToUserId ?? null,
      createdBy: chore.createdBy,
      completedAt: chore.completedAt?.toISOString() ?? null,
      createdAt: chore.createdAt.toISOString(),
      updatedAt: chore.updatedAt.toISOString()
    };
  }

  private buildChoreOrderBy(query: ListChoresQueryDto): Prisma.ChoreOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'createdAt':
        return [{ createdAt: query.sortOrder }, { dueDate: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: query.sortOrder }, { createdAt: query.sortOrder }];
      case 'status':
        return [{ status: query.sortOrder }, { dueDate: 'asc' }, { createdAt: 'asc' }];
      case 'dueDate':
      default:
        return [{ dueDate: query.sortOrder }, { createdAt: query.sortOrder }];
    }
  }
}
