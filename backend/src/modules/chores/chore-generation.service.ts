import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChoreTemplateAssignmentStrategy, ChoreTemplateStatus, Prisma } from '@prisma/client';

import { ErrorCode } from '../../common/http/http-error-code';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  addUtcDays,
  compareDateOnlyAsc,
  formatDateOnlyUtc,
  isDateOnlyAfter,
  maxDateOnly,
  minDateOnly,
  toDateOnlyUtc
} from '../../common/time/date-only.util';
import { CHORE_GENERATION_HORIZON_DAYS, RECURRING_OCCURRENCE_SLOT_KEY } from './chore.constants';

const CHORE_TEMPLATE_GENERATION_SELECT = {
  id: true,
  groupId: true,
  title: true,
  description: true,
  status: true,
  assignmentStrategy: true,
  startsOn: true,
  endsOn: true,
  repeatEveryDays: true,
  assignedToUserId: true,
  createdBy: true,
  updatedBy: true,
  generatedThroughOn: true,
  participants: {
    select: {
      userId: true,
      groupId: true,
      sortOrder: true
    },
    orderBy: {
      sortOrder: 'asc' as const
    }
  }
} satisfies Prisma.ChoreTemplateSelect;

type ChoreTemplateForGeneration = Prisma.ChoreTemplateGetPayload<{
  select: typeof CHORE_TEMPLATE_GENERATION_SELECT;
}>;

interface PendingGeneratedSlot {
  occurrenceIndex: number;
  dueOn: Date;
}

export interface MaintainChoreGenerationOptions {
  tx?: Prisma.TransactionClient;
  today?: Date;
  resetGenerationCursor?: boolean;
  generationStartOn?: Date;
}

export interface TemplateGenerationResult {
  templateId: string;
  groupId: string;
  attemptedOccurrenceCount: number;
  createdOccurrenceCount: number;
  generatedFromOn: string | null;
  generatedThroughOn: string | null;
  skippedReason?: 'INACTIVE' | 'NO_ELIGIBLE_WINDOW';
}

export interface GroupGenerationResult {
  groupId: string;
  horizonThroughOn: string;
  processedTemplateCount: number;
  createdOccurrenceCount: number;
  templates: TemplateGenerationResult[];
}

@Injectable()
export class ChoreGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  async maintainGroupGenerationHorizon(
    groupId: string,
    options: MaintainChoreGenerationOptions = {}
  ): Promise<GroupGenerationResult> {
    const today = toDateOnlyUtc(options.today ?? new Date());
    const horizonThroughOn = addUtcDays(today, CHORE_GENERATION_HORIZON_DAYS);

    const operation = async (tx: Prisma.TransactionClient): Promise<GroupGenerationResult> => {
      const templates = await tx.choreTemplate.findMany({
        where: {
          groupId,
          status: ChoreTemplateStatus.ACTIVE
        },
        select: CHORE_TEMPLATE_GENERATION_SELECT,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
      });

      const results: TemplateGenerationResult[] = [];
      let createdOccurrenceCount = 0;

      for (const template of templates) {
        const result = await this.maintainTemplateGenerationHorizonForTemplate(template, {
          ...options,
          tx,
          today
        });

        results.push(result);
        createdOccurrenceCount += result.createdOccurrenceCount;
      }

      return {
        groupId,
        horizonThroughOn: formatDateOnlyUtc(horizonThroughOn),
        processedTemplateCount: templates.length,
        createdOccurrenceCount,
        templates: results
      };
    };

    if (options.tx) {
      return operation(options.tx);
    }

    return this.prisma.$transaction((tx) => operation(tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  async maintainTemplateGenerationHorizon(
    templateId: string,
    options: MaintainChoreGenerationOptions = {}
  ): Promise<TemplateGenerationResult> {
    const today = toDateOnlyUtc(options.today ?? new Date());

    const operation = async (tx: Prisma.TransactionClient): Promise<TemplateGenerationResult> => {
      const template = await tx.choreTemplate.findUnique({
        where: { id: templateId },
        select: CHORE_TEMPLATE_GENERATION_SELECT
      });

      if (!template) {
        throw new NotFoundException({
          code: ErrorCode.NotFound,
          message: 'Chore template not found.'
        });
      }

      return this.maintainTemplateGenerationHorizonForTemplate(template, {
        ...options,
        tx,
        today
      });
    };

    if (options.tx) {
      return operation(options.tx);
    }

    return this.prisma.$transaction((tx) => operation(tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  private async maintainTemplateGenerationHorizonForTemplate(
    template: ChoreTemplateForGeneration,
    options: MaintainChoreGenerationOptions & {
      tx: Prisma.TransactionClient;
      today: Date;
    }
  ): Promise<TemplateGenerationResult> {
    const { tx, today } = options;

    if (template.status !== ChoreTemplateStatus.ACTIVE) {
      return {
        templateId: template.id,
        groupId: template.groupId,
        attemptedOccurrenceCount: 0,
        createdOccurrenceCount: 0,
        generatedFromOn: null,
        generatedThroughOn: template.generatedThroughOn
          ? formatDateOnlyUtc(template.generatedThroughOn)
          : null,
        skippedReason: 'INACTIVE'
      };
    }

    this.assertTemplateGenerationIsValid(template);

    const horizonThroughOn = addUtcDays(today, CHORE_GENERATION_HORIZON_DAYS);
    const effectiveWindowEnd = template.endsOn
      ? minDateOnly(template.endsOn, horizonThroughOn)
      : horizonThroughOn;

    const generationFloor = this.resolveGenerationFloor(template, {
      today,
      resetGenerationCursor: options.resetGenerationCursor,
      generationStartOn: options.generationStartOn
    });

    if (isDateOnlyAfter(generationFloor, effectiveWindowEnd)) {
      await this.persistGenerationCursor(tx, template.id, null, {
        resetGenerationCursor: options.resetGenerationCursor
      });

      return {
        templateId: template.id,
        groupId: template.groupId,
        attemptedOccurrenceCount: 0,
        createdOccurrenceCount: 0,
        generatedFromOn: null,
        generatedThroughOn: null,
        skippedReason: 'NO_ELIGIBLE_WINDOW'
      };
    }

    const firstOccurrenceIndex = this.getFirstOccurrenceIndexOnOrAfter(
      template.startsOn,
      template.repeatEveryDays,
      generationFloor
    );

    const slots = this.buildPendingSlots(template, firstOccurrenceIndex, effectiveWindowEnd);

    if (slots.length === 0) {
      await this.persistGenerationCursor(tx, template.id, null, {
        resetGenerationCursor: options.resetGenerationCursor
      });

      return {
        templateId: template.id,
        groupId: template.groupId,
        attemptedOccurrenceCount: 0,
        createdOccurrenceCount: 0,
        generatedFromOn: null,
        generatedThroughOn: null,
        skippedReason: 'NO_ELIGIBLE_WINDOW'
      };
    }

    const existingLiveOccurrences = await tx.chore.findMany({
      where: {
        templateId: template.id,
        slotDedupeKey: RECURRING_OCCURRENCE_SLOT_KEY,
        OR: [
          {
            occurrenceIndex: {
              in: slots.map((slot) => slot.occurrenceIndex)
            }
          },
          {
            dueOn: {
              in: slots.map((slot) => slot.dueOn)
            }
          }
        ]
      },
      select: {
        occurrenceIndex: true,
        dueOn: true
      }
    });

    const liveOccurrenceIndexes = new Set(
      existingLiveOccurrences
        .map((occurrence) => occurrence.occurrenceIndex)
        .filter((occurrenceIndex): occurrenceIndex is number => occurrenceIndex !== null)
    );
    const liveDueOnKeys = new Set(
      existingLiveOccurrences.map((occurrence) => formatDateOnlyUtc(occurrence.dueOn))
    );

    const rowsToCreate = slots
      .filter(
        (slot) =>
          !liveOccurrenceIndexes.has(slot.occurrenceIndex) &&
          !liveDueOnKeys.has(formatDateOnlyUtc(slot.dueOn))
      )
      .map((slot) => ({
        groupId: template.groupId,
        templateId: template.id,
        title: template.title,
        description: template.description,
        dueOn: slot.dueOn,
        occurrenceIndex: slot.occurrenceIndex,
        slotDedupeKey: RECURRING_OCCURRENCE_SLOT_KEY,
        assignedToUserId: this.resolveAssigneeUserId(template, slot.occurrenceIndex),
        createdBy: template.updatedBy ?? template.createdBy
      }));

    let createdOccurrenceCount = 0;
    if (rowsToCreate.length > 0) {
      const createManyResult = await tx.chore.createMany({
        data: rowsToCreate,
        skipDuplicates: true
      });

      createdOccurrenceCount = createManyResult.count;
    }

    const generatedFromOn = formatDateOnlyUtc(slots[0].dueOn);
    const generatedThroughOn = formatDateOnlyUtc(slots[slots.length - 1].dueOn);

    await this.persistGenerationCursor(tx, template.id, slots[slots.length - 1].dueOn, {
      resetGenerationCursor: options.resetGenerationCursor
    });

    return {
      templateId: template.id,
      groupId: template.groupId,
      attemptedOccurrenceCount: slots.length,
      createdOccurrenceCount,
      generatedFromOn,
      generatedThroughOn
    };
  }

  private resolveGenerationFloor(
    template: Pick<ChoreTemplateForGeneration, 'startsOn' | 'generatedThroughOn'>,
    options: {
      today: Date;
      resetGenerationCursor?: boolean;
      generationStartOn?: Date;
    }
  ): Date {
    const floorCandidates = [toDateOnlyUtc(options.today), toDateOnlyUtc(template.startsOn)];

    if (options.generationStartOn) {
      floorCandidates.push(toDateOnlyUtc(options.generationStartOn));
    }

    if (!options.resetGenerationCursor && template.generatedThroughOn) {
      floorCandidates.push(addUtcDays(template.generatedThroughOn, 1));
    }

    return maxDateOnly(...floorCandidates);
  }

  private buildPendingSlots(
    template: Pick<ChoreTemplateForGeneration, 'startsOn' | 'repeatEveryDays'>,
    firstOccurrenceIndex: number,
    effectiveWindowEnd: Date
  ): PendingGeneratedSlot[] {
    const slots: PendingGeneratedSlot[] = [];
    let occurrenceIndex = firstOccurrenceIndex;

    while (true) {
      const dueOn = this.getDueOnForOccurrenceIndex(
        template.startsOn,
        template.repeatEveryDays,
        occurrenceIndex
      );

      if (isDateOnlyAfter(dueOn, effectiveWindowEnd)) {
        break;
      }

      slots.push({
        occurrenceIndex,
        dueOn
      });

      occurrenceIndex += 1;
    }

    return slots;
  }

  private getFirstOccurrenceIndexOnOrAfter(
    startsOn: Date,
    repeatEveryDays: number,
    anchor: Date
  ): number {
    const normalizedStartsOn = toDateOnlyUtc(startsOn);
    const normalizedAnchor = toDateOnlyUtc(anchor);

    if (compareDateOnlyAsc(normalizedAnchor, normalizedStartsOn) <= 0) {
      return 0;
    }

    const millisecondsBetween = normalizedAnchor.getTime() - normalizedStartsOn.getTime();
    const daysBetween = Math.floor(millisecondsBetween / (24 * 60 * 60 * 1000));

    return Math.ceil(daysBetween / repeatEveryDays);
  }

  private getDueOnForOccurrenceIndex(
    startsOn: Date,
    repeatEveryDays: number,
    occurrenceIndex: number
  ): Date {
    return addUtcDays(startsOn, repeatEveryDays * occurrenceIndex);
  }

  private resolveAssigneeUserId(
    template: Pick<
      ChoreTemplateForGeneration,
      'id' | 'groupId' | 'assignmentStrategy' | 'assignedToUserId' | 'participants'
    >,
    occurrenceIndex: number
  ): string {
    if (template.assignmentStrategy === ChoreTemplateAssignmentStrategy.FIXED) {
      if (!template.assignedToUserId) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: `Recurring template ${template.id} is missing a fixed assignee.`
        });
      }

      return template.assignedToUserId;
    }

    if (template.assignedToUserId) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: `Round-robin template ${template.id} must not retain a fixed assignee.`
      });
    }

    if (template.participants.length < 2) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: `Round-robin template ${template.id} must have at least two participants.`
      });
    }

    const participant = template.participants[occurrenceIndex % template.participants.length];

    if (!participant) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: `Round-robin template ${template.id} has no participant for slot generation.`
      });
    }

    return participant.userId;
  }

  private assertTemplateGenerationIsValid(template: ChoreTemplateForGeneration): void {
    if (template.repeatEveryDays < 1) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: `Recurring template ${template.id} has an invalid repeatEveryDays value.`
      });
    }

    if (template.assignmentStrategy === ChoreTemplateAssignmentStrategy.FIXED) {
      if (!template.assignedToUserId) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: `Fixed recurring template ${template.id} is missing assigneeUserId.`
        });
      }

      if (template.participants.length > 0) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: `Fixed recurring template ${template.id} must not have round-robin participants.`
        });
      }

      return;
    }

    if (template.assignedToUserId) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: `Round-robin template ${template.id} must not have a fixed assignee.`
      });
    }

    if (template.participants.length < 2) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: `Round-robin template ${template.id} must include at least two participants.`
      });
    }

    template.participants.forEach((participant, index) => {
      if (participant.groupId !== template.groupId) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: `Round-robin template ${template.id} has a participant outside the template group.`
        });
      }

      if (participant.sortOrder !== index) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: `Round-robin template ${template.id} has non-contiguous participant ordering.`
        });
      }
    });
  }

  private async persistGenerationCursor(
    tx: Prisma.TransactionClient,
    templateId: string,
    generatedThroughOn: Date | null,
    options: {
      resetGenerationCursor?: boolean;
    }
  ): Promise<void> {
    if (options.resetGenerationCursor) {
      await tx.choreTemplate.update({
        where: { id: templateId },
        data: {
          generatedThroughOn
        }
      });

      return;
    }

    if (!generatedThroughOn) {
      return;
    }

    await tx.choreTemplate.updateMany({
      where: {
        id: templateId,
        OR: [{ generatedThroughOn: null }, { generatedThroughOn: { lt: generatedThroughOn } }]
      },
      data: {
        generatedThroughOn
      }
    });
  }
}
