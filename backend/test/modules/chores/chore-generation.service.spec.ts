import { ChoreTemplateAssignmentStrategy, ChoreTemplateStatus } from '@prisma/client';

import { ChoreGenerationService } from '../../../src/modules/chores/chore-generation.service';

const buildTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: 'template-1',
  groupId: 'group-1',
  title: 'Take out trash',
  description: 'Kitchen and bathroom bins',
  status: ChoreTemplateStatus.ACTIVE,
  assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
  startsOn: new Date('2026-04-06T00:00:00.000Z'),
  endsOn: null,
  repeatEveryDays: 7,
  assignedToUserId: 'user-2',
  createdBy: 'user-admin',
  updatedBy: 'user-editor',
  generatedThroughOn: null,
  participants: [],
  ...overrides
});

const buildRoundRobinTemplate = (overrides: Record<string, unknown> = {}) =>
  buildTemplate({
    assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
    assignedToUserId: null,
    participants: [
      { userId: 'user-2', groupId: 'group-1', sortOrder: 0 },
      { userId: 'user-3', groupId: 'group-1', sortOrder: 1 },
      { userId: 'user-4', groupId: 'group-1', sortOrder: 2 }
    ],
    ...overrides
  });

const extractGeneratedRows = (createManyArg: {
  data: Array<{
    dueOn: Date;
    occurrenceIndex: number | null;
    assignedToUserId: string;
  }>;
}) =>
  createManyArg.data.map((item) => ({
    dueOn: item.dueOn.toISOString().slice(0, 10),
    occurrenceIndex: item.occurrenceIndex,
    assignedToUserId: item.assignedToUserId
  }));

describe('ChoreGenerationService', () => {
  it('generates active interval occurrences through today plus 56 days for a group', async () => {
    const txMock = {
      choreTemplate: {
        findMany: jest.fn().mockResolvedValue([buildTemplate()]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 8 })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoreGenerationService(prismaMock as any);
    const result = await service.maintainGroupGenerationHorizon('group-1', {
      today: new Date('2026-04-05T15:30:00.000Z')
    });

    expect(result.horizonThroughOn).toBe('2026-05-31');
    expect(result.processedTemplateCount).toBe(1);
    expect(result.createdOccurrenceCount).toBe(8);
    expect(extractGeneratedRows(txMock.chore.createMany.mock.calls[0][0])).toEqual([
      { dueOn: '2026-04-06', occurrenceIndex: 0, assignedToUserId: 'user-2' },
      { dueOn: '2026-04-13', occurrenceIndex: 1, assignedToUserId: 'user-2' },
      { dueOn: '2026-04-20', occurrenceIndex: 2, assignedToUserId: 'user-2' },
      { dueOn: '2026-04-27', occurrenceIndex: 3, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-04', occurrenceIndex: 4, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-11', occurrenceIndex: 5, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-18', occurrenceIndex: 6, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-25', occurrenceIndex: 7, assignedToUserId: 'user-2' }
    ]);
    expect(txMock.choreTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          generatedThroughOn: new Date('2026-05-25T00:00:00.000Z')
        }
      })
    );
  });

  it('starts after generatedThroughOn and remains idempotent when duplicates already exist', async () => {
    const txMock = {
      choreTemplate: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            buildTemplate({ generatedThroughOn: new Date('2026-04-20T00:00:00.000Z') })
          ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoreGenerationService(prismaMock as any);
    const result = await service.maintainTemplateGenerationHorizon('template-1', {
      today: new Date('2026-04-05T09:00:00.000Z')
    });

    expect(result.attemptedOccurrenceCount).toBe(5);
    expect(result.createdOccurrenceCount).toBe(0);
    expect(result.generatedFromOn).toBe('2026-04-27');
    expect(result.generatedThroughOn).toBe('2026-05-25');
    expect(extractGeneratedRows(txMock.chore.createMany.mock.calls[0][0])).toEqual([
      { dueOn: '2026-04-27', occurrenceIndex: 3, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-04', occurrenceIndex: 4, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-11', occurrenceIndex: 5, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-18', occurrenceIndex: 6, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-25', occurrenceIndex: 7, assignedToUserId: 'user-2' }
    ]);
  });

  it.each([ChoreTemplateStatus.PAUSED, ChoreTemplateStatus.ARCHIVED])(
    'does not generate future occurrences for %s templates',
    async (status) => {
      const txMock = {
        choreTemplate: {
          findUnique: jest.fn().mockResolvedValue(buildTemplate({ status })),
          updateMany: jest.fn()
        },
        chore: {
          findMany: jest.fn(),
          createMany: jest.fn()
        }
      };

      const prismaMock = {
        $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
      };

      const service = new ChoreGenerationService(prismaMock as any);
      const result = await service.maintainTemplateGenerationHorizon('template-1', {
        today: new Date('2026-04-05T09:00:00.000Z')
      });

      expect(result.skippedReason).toBe('INACTIVE');
      expect(txMock.chore.createMany).not.toHaveBeenCalled();
      expect(txMock.choreTemplate.updateMany).not.toHaveBeenCalled();
    }
  );

  it('caps generation at endsOn for active templates', async () => {
    const txMock = {
      choreTemplate: {
        findUnique: jest.fn().mockResolvedValue(
          buildTemplate({
            endsOn: new Date('2026-04-20T00:00:00.000Z')
          })
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 3 })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoreGenerationService(prismaMock as any);
    const result = await service.maintainTemplateGenerationHorizon('template-1', {
      today: new Date('2026-04-05T09:00:00.000Z')
    });

    expect(result.generatedThroughOn).toBe('2026-04-20');
    expect(extractGeneratedRows(txMock.chore.createMany.mock.calls[0][0])).toEqual([
      { dueOn: '2026-04-06', occurrenceIndex: 0, assignedToUserId: 'user-2' },
      { dueOn: '2026-04-13', occurrenceIndex: 1, assignedToUserId: 'user-2' },
      { dueOn: '2026-04-20', occurrenceIndex: 2, assignedToUserId: 'user-2' }
    ]);
  });

  it('can reset the generation cursor and assign round-robin slots deterministically', async () => {
    const txMock = {
      choreTemplate: {
        findUnique: jest.fn().mockResolvedValue(
          buildRoundRobinTemplate({
            generatedThroughOn: new Date('2026-05-25T00:00:00.000Z')
          })
        ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 8 })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoreGenerationService(prismaMock as any);
    const result = await service.maintainTemplateGenerationHorizon('template-1', {
      today: new Date('2026-04-05T09:00:00.000Z'),
      resetGenerationCursor: true
    });

    expect(result.attemptedOccurrenceCount).toBe(8);
    expect(result.createdOccurrenceCount).toBe(8);
    expect(extractGeneratedRows(txMock.chore.createMany.mock.calls[0][0])).toEqual([
      { dueOn: '2026-04-06', occurrenceIndex: 0, assignedToUserId: 'user-2' },
      { dueOn: '2026-04-13', occurrenceIndex: 1, assignedToUserId: 'user-3' },
      { dueOn: '2026-04-20', occurrenceIndex: 2, assignedToUserId: 'user-4' },
      { dueOn: '2026-04-27', occurrenceIndex: 3, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-04', occurrenceIndex: 4, assignedToUserId: 'user-3' },
      { dueOn: '2026-05-11', occurrenceIndex: 5, assignedToUserId: 'user-4' },
      { dueOn: '2026-05-18', occurrenceIndex: 6, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-25', occurrenceIndex: 7, assignedToUserId: 'user-3' }
    ]);
    expect(txMock.choreTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          generatedThroughOn: new Date('2026-05-25T00:00:00.000Z')
        }
      })
    );
  });

  it('skips slots that already have a live recurring occurrence by occurrenceIndex or legacy dueOn fallback', async () => {
    const txMock = {
      choreTemplate: {
        findUnique: jest.fn().mockResolvedValue(buildRoundRobinTemplate()),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([
          {
            occurrenceIndex: 3,
            dueOn: new Date('2026-04-27T00:00:00.000Z')
          },
          {
            occurrenceIndex: null,
            dueOn: new Date('2026-04-20T00:00:00.000Z')
          }
        ]),
        createMany: jest.fn().mockResolvedValue({ count: 6 })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoreGenerationService(prismaMock as any);
    await service.maintainTemplateGenerationHorizon('template-1', {
      today: new Date('2026-04-05T09:00:00.000Z'),
      resetGenerationCursor: true
    });

    expect(extractGeneratedRows(txMock.chore.createMany.mock.calls[0][0])).toEqual([
      { dueOn: '2026-04-06', occurrenceIndex: 0, assignedToUserId: 'user-2' },
      { dueOn: '2026-04-13', occurrenceIndex: 1, assignedToUserId: 'user-3' },
      { dueOn: '2026-05-04', occurrenceIndex: 4, assignedToUserId: 'user-3' },
      { dueOn: '2026-05-11', occurrenceIndex: 5, assignedToUserId: 'user-4' },
      { dueOn: '2026-05-18', occurrenceIndex: 6, assignedToUserId: 'user-2' },
      { dueOn: '2026-05-25', occurrenceIndex: 7, assignedToUserId: 'user-3' }
    ]);
  });
});
