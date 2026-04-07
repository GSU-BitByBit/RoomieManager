import {
  BadRequestException,
  ConflictException,
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
import { formatDateOnlyUtc, toDateOnlyUtc } from '../../common/time/date-only.util';
import { CHORE_GENERATION_HORIZON_DAYS } from './chore.constants';
import { ChoreGenerationService } from './chore-generation.service';
import type { ChoreCalendarQueryDto } from './dto/chore-calendar.query';
import type { CreateChoreDto } from './dto/create-chore.dto';
import type { ListChoresQueryDto } from './dto/list-chores.query';
import type { UpdateChoreAssigneeDto } from './dto/update-chore-assignee.dto';
import type {
  ChoreCalendarOccurrence,
  ChoreSummary,
  GroupChoreCalendarResponse,
  GroupChoresResponse
} from './interfaces/chore-response.interface';

@Injectable()
export class ChoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly choreGenerationService: ChoreGenerationService
  ) {}

  async createChore(
    actorUserId: string,
    groupId: string,
    payload: CreateChoreDto
  ): Promise<ChoreSummary> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.assertActiveMembership(tx, actorUserId, groupId);

      if (!payload.assigneeUserId) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Assignee is required for one-off chores.'
        });
      }

      if (!payload.dueOn) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'dueOn is required for one-off chores.'
        });
      }

      await this.assertActiveGroupMember(tx, groupId, payload.assigneeUserId);

      if (
        membership.role !== GroupMemberRole.ADMIN &&
        payload.assigneeUserId !== membership.userId
      ) {
        throw new ForbiddenException({
          code: ErrorCode.Forbidden,
          message: 'Active members can only create one-off chores for themselves.'
        });
      }

      const chore = await tx.chore.create({
        data: {
          groupId,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          status: ChoreStatus.PENDING,
          dueOn: toDateOnlyUtc(payload.dueOn),
          assignedToUserId: payload.assigneeUserId,
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
            assigneeUserId: payload.assigneeUserId
          }
        }
      });

      await tx.choreActivity.create({
        data: {
          choreId: chore.id,
          groupId,
          actorUserId,
          type: ChoreActivityType.ASSIGNED,
          details: {
            assigneeUserId: payload.assigneeUserId
          }
        }
      });

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
      await this.choreGenerationService.maintainGroupGenerationHorizon(groupId, { tx });
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

      if (query.dueOnFrom || query.dueOnTo) {
        where.dueOn = {
          ...(query.dueOnFrom ? { gte: toDateOnlyUtc(query.dueOnFrom) } : {}),
          ...(query.dueOnTo ? { lte: toDateOnlyUtc(query.dueOnTo) } : {})
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

  async getGroupChoreCalendar(
    userId: string,
    groupId: string,
    query: ChoreCalendarQueryDto
  ): Promise<GroupChoreCalendarResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);

      const start = toDateOnlyUtc(query.start);
      const end = toDateOnlyUtc(query.end);
      this.assertValidCalendarRange(start, end);

      await this.choreGenerationService.maintainGroupGenerationHorizon(groupId, { tx });

      const occurrences = await tx.chore.findMany({
        where: {
          groupId,
          dueOn: {
            gte: start,
            lte: end
          }
        },
        orderBy: [{ dueOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
      });

      return {
        groupId,
        start: formatDateOnlyUtc(start),
        end: formatDateOnlyUtc(end),
        occurrences: occurrences.map((occurrence) => this.mapCalendarOccurrence(occurrence))
      };
    });
  }

  async updateOccurrenceAssignee(
    actorUserId: string,
    occurrenceId: string,
    payload: UpdateChoreAssigneeDto
  ): Promise<ChoreSummary> {
    return this.prisma.$transaction(async (tx) => {
      const chore = await tx.chore.findUnique({
        where: { id: occurrenceId }
      });

      if (!chore) {
        throw new NotFoundException({
          code: ErrorCode.NotFound,
          message: 'Chore not found.'
        });
      }

      const membership = await this.assertActiveMembership(tx, actorUserId, chore.groupId);

      if (!payload.assigneeUserId) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Assignee is required for occurrence reassignment.'
        });
      }

      if (membership.role !== GroupMemberRole.ADMIN) {
        throw new ForbiddenException({
          code: ErrorCode.Forbidden,
          message: 'Only admins can reassign chore occurrences.'
        });
      }

      if (chore.status !== ChoreStatus.PENDING) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: 'Only pending chore occurrences can be reassigned.'
        });
      }

      await this.assertActiveGroupMember(tx, chore.groupId, payload.assigneeUserId);

      const updated = await tx.chore.update({
        where: { id: occurrenceId },
        data: {
          assignedToUserId: payload.assigneeUserId
        }
      });

      await tx.choreActivity.create({
        data: {
          choreId: updated.id,
          groupId: updated.groupId,
          actorUserId,
          type: ChoreActivityType.ASSIGNED,
          details: {
            assigneeUserId: payload.assigneeUserId
          }
        }
      });

      return this.mapChoreSummary(updated);
    });
  }

  async completeOccurrence(actorUserId: string, occurrenceId: string): Promise<ChoreSummary> {
    return this.prisma.$transaction(async (tx) => {
      const chore = await tx.chore.findUnique({
        where: { id: occurrenceId }
      });

      if (!chore) {
        throw new NotFoundException({
          code: ErrorCode.NotFound,
          message: 'Chore not found.'
        });
      }

      const membership = await this.assertActiveMembership(tx, actorUserId, chore.groupId);
      const isAdmin = membership.role === GroupMemberRole.ADMIN;

      if (chore.status === ChoreStatus.CANCELLED) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: 'Cancelled chore occurrences cannot be completed.'
        });
      }

      if (!isAdmin && chore.assignedToUserId !== actorUserId) {
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
        where: { id: occurrenceId },
        data: {
          status: ChoreStatus.COMPLETED,
          completedAt: now,
          completedByUserId: actorUserId
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
      dueOn: formatDateOnlyUtc(chore.dueOn),
      assigneeUserId: chore.assignedToUserId,
      createdBy: chore.createdBy,
      templateId: chore.templateId,
      completedByUserId: chore.completedByUserId,
      completedAt: chore.completedAt?.toISOString() ?? null,
      createdAt: chore.createdAt.toISOString(),
      updatedAt: chore.updatedAt.toISOString()
    };
  }

  private mapCalendarOccurrence(chore: Chore): ChoreCalendarOccurrence {
    return {
      id: chore.id,
      templateId: chore.templateId,
      title: chore.title,
      description: chore.description,
      dueOn: formatDateOnlyUtc(chore.dueOn),
      assigneeUserId: chore.assignedToUserId,
      status: chore.status,
      completedAt: chore.completedAt?.toISOString() ?? null,
      completedByUserId: chore.completedByUserId
    };
  }

  private buildChoreOrderBy(query: ListChoresQueryDto): Prisma.ChoreOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'createdAt':
        return [{ createdAt: query.sortOrder }, { dueOn: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: query.sortOrder }, { createdAt: query.sortOrder }];
      case 'status':
        return [{ status: query.sortOrder }, { dueOn: 'asc' }, { createdAt: 'asc' }];
      case 'dueOn':
      default:
        return [{ dueOn: query.sortOrder }, { createdAt: query.sortOrder }];
    }
  }

  private assertValidCalendarRange(start: Date, end: Date): void {
    const daySpan = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    if (daySpan < 0 || daySpan > CHORE_GENERATION_HORIZON_DAYS) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: `Calendar range must use start <= end and span no more than ${CHORE_GENERATION_HORIZON_DAYS} days.`
      });
    }
  }

  private async assertActiveGroupMember(
    tx: Prisma.TransactionClient,
    groupId: string,
    userId: string
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
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Assignee must be an active member of the group.'
      });
    }

    return membership;
  }
}
