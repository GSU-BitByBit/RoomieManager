import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  ChoreActivityType,
  ChoreStatus,
  ChoreTemplateAssignmentStrategy,
  ChoreTemplateStatus,
  GroupMemberRole,
  GroupMemberStatus,
  Prisma,
  type GroupMember
} from '@prisma/client';

import { ErrorCode } from '../../common/http/http-error-code';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  addUtcDays,
  formatDateOnlyUtc,
  isDateOnlyBefore,
  toDateOnlyUtc
} from '../../common/time/date-only.util';
import {
  ChoreGenerationService,
  type MaintainChoreGenerationOptions
} from './chore-generation.service';
import { CreateChoreTemplateDto } from './dto/create-chore-template.dto';
import { UpdateChoreTemplateDto } from './dto/update-chore-template.dto';
import type {
  ChoreTemplateParticipantSummary,
  ChoreTemplateSummary,
  GroupChoreTemplatesResponse
} from './interfaces/chore-template-response.interface';

const CHORE_TEMPLATE_WITH_PARTICIPANTS_INCLUDE = {
  participants: {
    orderBy: {
      sortOrder: 'asc' as const
    }
  }
} satisfies Prisma.ChoreTemplateInclude;

type ChoreTemplateWithParticipants = Prisma.ChoreTemplateGetPayload<{
  include: typeof CHORE_TEMPLATE_WITH_PARTICIPANTS_INCLUDE;
}>;

interface ResolvedTemplateAssignmentConfig {
  assignmentStrategy: ChoreTemplateAssignmentStrategy;
  assigneeUserId: string | null;
  participantUserIds: string[];
}

@Injectable()
export class ChoreTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly choreGenerationService: ChoreGenerationService
  ) {}

  async listGroupTemplates(userId: string, groupId: string): Promise<GroupChoreTemplatesResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);

      const templates = await tx.choreTemplate.findMany({
        where: { groupId },
        include: CHORE_TEMPLATE_WITH_PARTICIPANTS_INCLUDE,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
      });

      return {
        groupId,
        templates: templates.map((template) => this.mapTemplateSummary(template))
      };
    });
  }

  async createTemplate(
    actorUserId: string,
    groupId: string,
    payload: CreateChoreTemplateDto,
    options: Pick<MaintainChoreGenerationOptions, 'today'> = {}
  ): Promise<ChoreTemplateSummary> {
    return this.withSerializableTransaction(async (tx) => {
      await this.assertAdminMembership(tx, actorUserId, groupId);

      const startsOn = toDateOnlyUtc(payload.startsOn);
      const endsOn = payload.endsOn ? toDateOnlyUtc(payload.endsOn) : null;
      this.assertValidTemplateWindow(startsOn, endsOn);
      this.assertValidRepeatEveryDays(payload.repeatEveryDays);

      const assignment = await this.resolveCreateAssignmentConfig(tx, groupId, payload);

      const template = await tx.choreTemplate.create({
        data: {
          groupId,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          status: ChoreTemplateStatus.ACTIVE,
          assignmentStrategy: assignment.assignmentStrategy,
          startsOn,
          endsOn,
          repeatEveryDays: payload.repeatEveryDays,
          assignedToUserId: assignment.assigneeUserId,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          participants:
            assignment.participantUserIds.length > 0
              ? {
                  create: assignment.participantUserIds.map((userId, index) => ({
                    groupId,
                    userId,
                    sortOrder: index
                  }))
                }
              : undefined
        },
        include: CHORE_TEMPLATE_WITH_PARTICIPANTS_INCLUDE
      });

      await this.choreGenerationService.maintainTemplateGenerationHorizon(template.id, {
        tx,
        today: options.today
      });

      const refreshed = await this.findTemplateByIdOrThrow(tx, template.id);
      return this.mapTemplateSummary(refreshed);
    });
  }

  async updateTemplate(
    actorUserId: string,
    groupId: string,
    templateId: string,
    payload: UpdateChoreTemplateDto,
    options: Pick<MaintainChoreGenerationOptions, 'today'> = {}
  ): Promise<ChoreTemplateSummary> {
    return this.withSerializableTransaction(async (tx) => {
      await this.assertAdminMembership(tx, actorUserId, groupId);

      const existing = await this.findTemplateOrThrow(tx, groupId, templateId);
      if (existing.status === ChoreTemplateStatus.ARCHIVED) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: 'Archived chore templates cannot be updated.'
        });
      }

      const title = payload.title !== undefined ? payload.title.trim() : existing.title;
      const description =
        payload.description !== undefined
          ? payload.description?.trim() || null
          : existing.description;
      const startsOn = payload.startsOn ? toDateOnlyUtc(payload.startsOn) : existing.startsOn;
      const endsOn =
        payload.endsOn !== undefined
          ? payload.endsOn
            ? toDateOnlyUtc(payload.endsOn)
            : null
          : existing.endsOn;
      const repeatEveryDays = payload.repeatEveryDays ?? existing.repeatEveryDays;

      this.assertValidTemplateWindow(startsOn, endsOn);
      this.assertValidRepeatEveryDays(repeatEveryDays);

      const nextAssignment = await this.resolveUpdatedAssignmentConfig(
        tx,
        groupId,
        existing,
        payload
      );
      const existingParticipantUserIds = this.getParticipantUserIds(existing);
      const hasRelevantChanges =
        title !== existing.title ||
        description !== existing.description ||
        startsOn.getTime() !== existing.startsOn.getTime() ||
        (endsOn?.getTime() ?? null) !== (existing.endsOn?.getTime() ?? null) ||
        repeatEveryDays !== existing.repeatEveryDays ||
        nextAssignment.assignmentStrategy !== existing.assignmentStrategy ||
        nextAssignment.assigneeUserId !== existing.assignedToUserId ||
        !this.areStringArraysEqual(nextAssignment.participantUserIds, existingParticipantUserIds);

      await tx.choreTemplate.update({
        where: { id: existing.id },
        data: {
          title,
          description,
          startsOn,
          endsOn,
          repeatEveryDays,
          assignmentStrategy: nextAssignment.assignmentStrategy,
          assignedToUserId: nextAssignment.assigneeUserId,
          updatedBy: actorUserId
        }
      });

      await this.replaceTemplateParticipants(
        tx,
        existing.id,
        groupId,
        nextAssignment.participantUserIds
      );

      if (hasRelevantChanges) {
        const today = toDateOnlyUtc(options.today ?? new Date());

        await this.cancelFuturePendingOccurrences(
          tx,
          existing,
          actorUserId,
          today,
          'TEMPLATE_UPDATED'
        );

        const refreshedForGeneration = await this.findTemplateByIdOrThrow(tx, existing.id);
        if (refreshedForGeneration.status === ChoreTemplateStatus.ACTIVE) {
          await this.choreGenerationService.maintainTemplateGenerationHorizon(
            refreshedForGeneration.id,
            {
              tx,
              today,
              resetGenerationCursor: true,
              generationStartOn: addUtcDays(today, 1)
            }
          );
        }
      }

      const refreshed = await this.findTemplateByIdOrThrow(tx, existing.id);
      return this.mapTemplateSummary(refreshed);
    });
  }

  async pauseTemplate(
    actorUserId: string,
    groupId: string,
    templateId: string,
    options: Pick<MaintainChoreGenerationOptions, 'today'> = {}
  ): Promise<ChoreTemplateSummary> {
    return this.withSerializableTransaction(async (tx) => {
      await this.assertAdminMembership(tx, actorUserId, groupId);

      const existing = await this.findTemplateOrThrow(tx, groupId, templateId);
      if (existing.status === ChoreTemplateStatus.ARCHIVED) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: 'Archived chore templates cannot be paused.'
        });
      }

      if (existing.status === ChoreTemplateStatus.PAUSED) {
        return this.mapTemplateSummary(existing);
      }

      await tx.choreTemplate.update({
        where: { id: existing.id },
        data: {
          status: ChoreTemplateStatus.PAUSED,
          updatedBy: actorUserId
        }
      });

      await this.cancelFuturePendingOccurrences(
        tx,
        existing,
        actorUserId,
        toDateOnlyUtc(options.today ?? new Date()),
        'TEMPLATE_PAUSED'
      );

      const refreshed = await this.findTemplateByIdOrThrow(tx, existing.id);
      return this.mapTemplateSummary(refreshed);
    });
  }

  async resumeTemplate(
    actorUserId: string,
    groupId: string,
    templateId: string,
    options: Pick<MaintainChoreGenerationOptions, 'today'> = {}
  ): Promise<ChoreTemplateSummary> {
    return this.withSerializableTransaction(async (tx) => {
      await this.assertAdminMembership(tx, actorUserId, groupId);

      const existing = await this.findTemplateOrThrow(tx, groupId, templateId);
      if (existing.status === ChoreTemplateStatus.ARCHIVED) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: 'Archived chore templates cannot be resumed.'
        });
      }

      if (existing.assignmentStrategy === ChoreTemplateAssignmentStrategy.ROUND_ROBIN) {
        await this.assertRoundRobinParticipantsActive(
          tx,
          groupId,
          this.getParticipantUserIds(existing)
        );
      } else if (existing.assignedToUserId) {
        await this.assertActiveMemberAssignee(tx, groupId, existing.assignedToUserId);
      }

      if (existing.status === ChoreTemplateStatus.PAUSED) {
        await tx.choreTemplate.update({
          where: { id: existing.id },
          data: {
            status: ChoreTemplateStatus.ACTIVE,
            updatedBy: actorUserId
          }
        });
      }

      await this.choreGenerationService.maintainTemplateGenerationHorizon(existing.id, {
        tx,
        today: options.today,
        resetGenerationCursor: true
      });

      const refreshed = await this.findTemplateByIdOrThrow(tx, existing.id);
      return this.mapTemplateSummary(refreshed);
    });
  }

  async archiveTemplate(
    actorUserId: string,
    groupId: string,
    templateId: string,
    options: Pick<MaintainChoreGenerationOptions, 'today'> = {}
  ): Promise<ChoreTemplateSummary> {
    return this.withSerializableTransaction(async (tx) => {
      await this.assertAdminMembership(tx, actorUserId, groupId);

      const existing = await this.findTemplateOrThrow(tx, groupId, templateId);
      if (existing.status === ChoreTemplateStatus.ARCHIVED) {
        return this.mapTemplateSummary(existing);
      }

      await tx.choreTemplate.update({
        where: { id: existing.id },
        data: {
          status: ChoreTemplateStatus.ARCHIVED,
          updatedBy: actorUserId
        }
      });

      await this.cancelFuturePendingOccurrences(
        tx,
        existing,
        actorUserId,
        toDateOnlyUtc(options.today ?? new Date()),
        'TEMPLATE_ARCHIVED'
      );

      const refreshed = await this.findTemplateByIdOrThrow(tx, existing.id);
      return this.mapTemplateSummary(refreshed);
    });
  }

  private async withSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => operation(tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  private async cancelFuturePendingOccurrences(
    tx: Prisma.TransactionClient,
    template: Pick<ChoreTemplateWithParticipants, 'id' | 'groupId'>,
    actorUserId: string,
    today: Date,
    reason: 'TEMPLATE_UPDATED' | 'TEMPLATE_PAUSED' | 'TEMPLATE_ARCHIVED'
  ): Promise<number> {
    const staleOccurrences = await tx.chore.findMany({
      where: {
        templateId: template.id,
        groupId: template.groupId,
        status: ChoreStatus.PENDING,
        dueOn: {
          gt: today
        }
      },
      select: {
        id: true
      }
    });

    if (staleOccurrences.length === 0) {
      return 0;
    }

    const occurrenceIds = staleOccurrences.map((occurrence) => occurrence.id);

    await tx.chore.updateMany({
      where: {
        id: {
          in: occurrenceIds
        }
      },
      data: {
        status: ChoreStatus.CANCELLED,
        slotDedupeKey: null
      }
    });

    await tx.choreActivity.createMany({
      data: occurrenceIds.map((choreId) => ({
        choreId,
        groupId: template.groupId,
        actorUserId,
        type: ChoreActivityType.CANCELLED,
        details: {
          reason,
          templateId: template.id
        }
      }))
    });

    return occurrenceIds.length;
  }

  private async findTemplateOrThrow(
    tx: Prisma.TransactionClient,
    groupId: string,
    templateId: string
  ): Promise<ChoreTemplateWithParticipants> {
    const template = await tx.choreTemplate.findFirst({
      where: {
        id: templateId,
        groupId
      },
      include: CHORE_TEMPLATE_WITH_PARTICIPANTS_INCLUDE
    });

    if (!template) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Chore template not found.'
      });
    }

    return template;
  }

  private async findTemplateByIdOrThrow(
    tx: Prisma.TransactionClient,
    templateId: string
  ): Promise<ChoreTemplateWithParticipants> {
    const template = await tx.choreTemplate.findUnique({
      where: { id: templateId },
      include: CHORE_TEMPLATE_WITH_PARTICIPANTS_INCLUDE
    });

    if (!template) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Chore template not found.'
      });
    }

    return template;
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

  private async assertAdminMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await this.assertActiveMembership(tx, userId, groupId);
    if (membership.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'Only admins can manage recurring chore templates.'
      });
    }

    return membership;
  }

  private async assertActiveMemberAssignee(
    tx: Prisma.TransactionClient,
    groupId: string,
    assigneeUserId: string
  ): Promise<void> {
    const assigneeMembership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: assigneeUserId
        }
      }
    });

    if (!assigneeMembership || assigneeMembership.status !== GroupMemberStatus.ACTIVE) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Assignee must be an active member of the group.'
      });
    }
  }

  private async assertRoundRobinParticipantsActive(
    tx: Prisma.TransactionClient,
    groupId: string,
    participantUserIds: string[]
  ): Promise<void> {
    if (participantUserIds.length < 2) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Round-robin templates require at least two participants.'
      });
    }

    const uniqueUserIds = new Set(participantUserIds);
    if (uniqueUserIds.size !== participantUserIds.length) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Round-robin participants must be unique.'
      });
    }

    const members = await tx.groupMember.findMany({
      where: {
        groupId,
        status: GroupMemberStatus.ACTIVE,
        userId: {
          in: participantUserIds
        }
      },
      select: {
        userId: true
      }
    });

    const activeUserIds = new Set(members.map((member) => member.userId));
    const missingUserIds = participantUserIds.filter((userId) => !activeUserIds.has(userId));

    if (missingUserIds.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Round-robin participants must all be active members of the group.',
        details: {
          missingUserIds
        }
      });
    }
  }

  private assertValidTemplateWindow(startsOn: Date, endsOn: Date | null): void {
    if (endsOn && isDateOnlyBefore(endsOn, startsOn)) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Template endsOn cannot be earlier than startsOn.'
      });
    }
  }

  private assertValidRepeatEveryDays(repeatEveryDays: number): void {
    if (!Number.isInteger(repeatEveryDays) || repeatEveryDays < 1) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Template repeatEveryDays must be a positive integer.'
      });
    }
  }

  private async resolveCreateAssignmentConfig(
    tx: Prisma.TransactionClient,
    groupId: string,
    payload: CreateChoreTemplateDto
  ): Promise<ResolvedTemplateAssignmentConfig> {
    if (payload.assignmentStrategy === ChoreTemplateAssignmentStrategy.FIXED) {
      if (!payload.assigneeUserId) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'FIXED recurring templates require assigneeUserId.'
        });
      }

      if ((payload.participantUserIds?.length ?? 0) > 0) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'FIXED recurring templates cannot include participantUserIds.'
        });
      }

      await this.assertActiveMemberAssignee(tx, groupId, payload.assigneeUserId);

      return {
        assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
        assigneeUserId: payload.assigneeUserId,
        participantUserIds: []
      };
    }

    if (payload.assigneeUserId) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'ROUND_ROBIN recurring templates cannot include assigneeUserId.'
      });
    }

    const participantUserIds = this.normalizeParticipantUserIds(payload.participantUserIds);
    await this.assertRoundRobinParticipantsActive(tx, groupId, participantUserIds);

    return {
      assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
      assigneeUserId: null,
      participantUserIds
    };
  }

  private async resolveUpdatedAssignmentConfig(
    tx: Prisma.TransactionClient,
    groupId: string,
    existing: ChoreTemplateWithParticipants,
    payload: UpdateChoreTemplateDto
  ): Promise<ResolvedTemplateAssignmentConfig> {
    const nextStrategy = payload.assignmentStrategy ?? existing.assignmentStrategy;
    const existingParticipantUserIds = this.getParticipantUserIds(existing);

    if (nextStrategy === ChoreTemplateAssignmentStrategy.FIXED) {
      if (payload.participantUserIds !== undefined) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'FIXED recurring templates cannot include participantUserIds.'
        });
      }

      const assigneeUserId =
        payload.assigneeUserId !== undefined
          ? payload.assigneeUserId
          : existing.assignmentStrategy === ChoreTemplateAssignmentStrategy.FIXED
            ? existing.assignedToUserId
            : null;

      if (!assigneeUserId) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'FIXED recurring templates require assigneeUserId.'
        });
      }

      await this.assertActiveMemberAssignee(tx, groupId, assigneeUserId);

      return {
        assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
        assigneeUserId,
        participantUserIds: []
      };
    }

    if (payload.assigneeUserId !== undefined && payload.assigneeUserId !== null) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'ROUND_ROBIN recurring templates cannot include assigneeUserId.'
      });
    }

    const participantUserIds =
      payload.participantUserIds !== undefined
        ? this.normalizeParticipantUserIds(payload.participantUserIds)
        : existing.assignmentStrategy === ChoreTemplateAssignmentStrategy.ROUND_ROBIN
          ? existingParticipantUserIds
          : [];

    await this.assertRoundRobinParticipantsActive(tx, groupId, participantUserIds);

    return {
      assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
      assigneeUserId: null,
      participantUserIds
    };
  }

  private normalizeParticipantUserIds(participantUserIds: string[] | undefined): string[] {
    return (participantUserIds ?? []).map((userId) => userId.trim());
  }

  private getParticipantUserIds(
    template: Pick<ChoreTemplateWithParticipants, 'participants'>
  ): string[] {
    return template.participants
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((participant) => participant.userId);
  }

  private async replaceTemplateParticipants(
    tx: Prisma.TransactionClient,
    templateId: string,
    groupId: string,
    participantUserIds: string[]
  ): Promise<void> {
    await tx.choreTemplateParticipant.deleteMany({
      where: {
        templateId
      }
    });

    if (participantUserIds.length === 0) {
      return;
    }

    await tx.choreTemplateParticipant.createMany({
      data: participantUserIds.map((userId, index) => ({
        templateId,
        groupId,
        userId,
        sortOrder: index
      }))
    });
  }

  private areStringArraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => value === right[index]);
  }

  private mapTemplateSummary(template: ChoreTemplateWithParticipants): ChoreTemplateSummary {
    return {
      id: template.id,
      groupId: template.groupId,
      title: template.title,
      description: template.description,
      status: template.status,
      assignmentStrategy: template.assignmentStrategy,
      startsOn: formatDateOnlyUtc(template.startsOn),
      endsOn: template.endsOn ? formatDateOnlyUtc(template.endsOn) : null,
      repeatEveryDays: template.repeatEveryDays,
      assigneeUserId: template.assignedToUserId,
      participants: template.participants
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map<ChoreTemplateParticipantSummary>((participant) => ({
          userId: participant.userId,
          sortOrder: participant.sortOrder
        })),
      createdBy: template.createdBy,
      updatedBy: template.updatedBy,
      generatedThroughOn: template.generatedThroughOn
        ? formatDateOnlyUtc(template.generatedThroughOn)
        : null,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };
  }
}
