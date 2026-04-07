import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  ChoreTemplateAssignmentStrategy,
  ChoreTemplateStatus,
  GroupMemberRole,
  GroupMemberStatus
} from '@prisma/client';

import { ChoreTemplatesService } from '../../../src/modules/chores/chore-templates.service';

const buildTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: 'template-1',
  groupId: 'group-1',
  title: 'Trash',
  description: 'Bins',
  status: ChoreTemplateStatus.ACTIVE,
  assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
  startsOn: new Date('2026-04-06T00:00:00.000Z'),
  endsOn: null,
  repeatEveryDays: 7,
  assignedToUserId: 'user-2',
  createdBy: 'user-1',
  updatedBy: 'user-1',
  generatedThroughOn: new Date('2026-05-25T00:00:00.000Z'),
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  participants: [],
  ...overrides
});

const buildRoundRobinTemplate = (overrides: Record<string, unknown> = {}) =>
  buildTemplate({
    assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
    assignedToUserId: null,
    participants: [
      {
        id: 'participant-1',
        templateId: 'template-1',
        groupId: 'group-1',
        userId: 'user-2',
        sortOrder: 0,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      },
      {
        id: 'participant-2',
        templateId: 'template-1',
        groupId: 'group-1',
        userId: 'user-3',
        sortOrder: 1,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      }
    ],
    ...overrides
  });

describe('ChoreTemplatesService', () => {
  it('creates an active fixed recurring template as admin and generates its horizon', async () => {
    const createdTemplate = buildTemplate({ createdBy: 'admin-1', updatedBy: 'admin-1' });

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            groupId: 'group-1',
            userId: 'admin-1',
            role: GroupMemberRole.ADMIN,
            status: GroupMemberStatus.ACTIVE
          })
          .mockResolvedValueOnce({
            groupId: 'group-1',
            userId: 'user-2',
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.ACTIVE
          })
      },
      choreTemplate: {
        create: jest.fn().mockResolvedValue(createdTemplate),
        findUnique: jest.fn().mockResolvedValue(createdTemplate)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn().mockResolvedValue({
        templateId: 'template-1'
      })
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);
    const result = await service.createTemplate('admin-1', 'group-1', {
      title: 'Trash',
      assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
      startsOn: new Date('2026-04-06T00:00:00.000Z'),
      repeatEveryDays: 7,
      assigneeUserId: 'user-2'
    });

    expect(result.status).toBe(ChoreTemplateStatus.ACTIVE);
    expect(result.assignmentStrategy).toBe(ChoreTemplateAssignmentStrategy.FIXED);
    expect(txMock.choreTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ChoreTemplateStatus.ACTIVE,
          assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
          assignedToUserId: 'user-2',
          repeatEveryDays: 7
        })
      })
    );
    expect(generationMock.maintainTemplateGenerationHorizon).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({
        tx: txMock
      })
    );
  });

  it('creates an active round-robin template and preserves participant order', async () => {
    const createdTemplate = buildRoundRobinTemplate({ createdBy: 'admin-1', updatedBy: 'admin-1' });

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'admin-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-2' }, { userId: 'user-3' }])
      },
      choreTemplate: {
        create: jest.fn().mockResolvedValue(createdTemplate),
        findUnique: jest.fn().mockResolvedValue(createdTemplate)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn().mockResolvedValue({
        templateId: 'template-1'
      })
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);
    const result = await service.createTemplate('admin-1', 'group-1', {
      title: 'Bathroom reset',
      assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
      startsOn: new Date('2026-04-06T00:00:00.000Z'),
      repeatEveryDays: 7,
      participantUserIds: ['user-2', 'user-3']
    });

    expect(result.assignmentStrategy).toBe(ChoreTemplateAssignmentStrategy.ROUND_ROBIN);
    expect(result.assigneeUserId).toBeNull();
    expect(result.participants).toEqual([
      { userId: 'user-2', sortOrder: 0 },
      { userId: 'user-3', sortOrder: 1 }
    ]);
    expect(txMock.choreTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
          assignedToUserId: null,
          participants: {
            create: [
              { groupId: 'group-1', userId: 'user-2', sortOrder: 0 },
              { groupId: 'group-1', userId: 'user-3', sortOrder: 1 }
            ]
          }
        })
      })
    );
  });

  it('blocks non-admins from creating recurring templates', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'user-1',
          role: GroupMemberRole.MEMBER,
          status: GroupMemberStatus.ACTIVE
        })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn()
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);

    await expect(
      service.createTemplate('user-1', 'group-1', {
        title: 'Trash',
        assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
        startsOn: new Date('2026-04-06T00:00:00.000Z'),
        repeatEveryDays: 7,
        assigneeUserId: 'user-1'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid round-robin participant lists', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'admin-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        })
      }
    };
    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn()
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);

    await expect(
      service.createTemplate('admin-1', 'group-1', {
        title: 'Bathroom reset',
        assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
        startsOn: new Date('2026-04-06T00:00:00.000Z'),
        repeatEveryDays: 7,
        participantUserIds: ['user-2']
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates an active template from fixed to round-robin by cancelling future pending occurrences and regenerating', async () => {
    const existing = buildTemplate();
    const refreshed = buildRoundRobinTemplate({
      title: 'Trash Updated',
      description: 'Bins',
      repeatEveryDays: 3,
      updatedBy: 'admin-1'
    });
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'admin-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-2' }, { userId: 'user-3' }])
      },
      choreTemplate: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({
          ...existing,
          title: 'Trash Updated',
          assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
          assignedToUserId: null,
          repeatEveryDays: 3,
          updatedBy: 'admin-1'
        }),
        findUnique: jest.fn().mockResolvedValue(refreshed)
      },
      choreTemplateParticipant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([{ id: 'chore-1' }, { id: 'chore-2' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      choreActivity: {
        createMany: jest.fn().mockResolvedValue({ count: 2 })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn().mockResolvedValue({
        templateId: 'template-1'
      })
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);
    const result = await service.updateTemplate(
      'admin-1',
      'group-1',
      'template-1',
      {
        title: 'Trash Updated',
        assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
        repeatEveryDays: 3,
        participantUserIds: ['user-2', 'user-3']
      },
      { today: new Date('2026-04-06T12:00:00.000Z') }
    );

    expect(result.title).toBe('Trash Updated');
    expect(result.assignmentStrategy).toBe(ChoreTemplateAssignmentStrategy.ROUND_ROBIN);
    expect(result.participants).toEqual([
      { userId: 'user-2', sortOrder: 0 },
      { userId: 'user-3', sortOrder: 1 }
    ]);
    expect(txMock.choreTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentStrategy: ChoreTemplateAssignmentStrategy.ROUND_ROBIN,
          assignedToUserId: null,
          repeatEveryDays: 3
        })
      })
    );
    expect(txMock.choreTemplateParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { templateId: 'template-1', groupId: 'group-1', userId: 'user-2', sortOrder: 0 },
        { templateId: 'template-1', groupId: 'group-1', userId: 'user-3', sortOrder: 1 }
      ]
    });
    expect(txMock.chore.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED'
        })
      })
    );
    expect(generationMock.maintainTemplateGenerationHorizon).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({
        resetGenerationCursor: true,
        generationStartOn: new Date('2026-04-07T00:00:00.000Z')
      })
    );
  });

  it('pauses an active template and cancels future pending occurrences without regenerating', async () => {
    const paused = buildRoundRobinTemplate({
      status: ChoreTemplateStatus.PAUSED,
      updatedBy: 'admin-1'
    });

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'admin-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        })
      },
      choreTemplate: {
        findFirst: jest.fn().mockResolvedValue(buildRoundRobinTemplate()),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(paused)
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([{ id: 'chore-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      choreActivity: {
        createMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    };
    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn()
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);
    const result = await service.pauseTemplate('admin-1', 'group-1', 'template-1');

    expect(result.status).toBe(ChoreTemplateStatus.PAUSED);
    expect(generationMock.maintainTemplateGenerationHorizon).not.toHaveBeenCalled();
  });

  it('resumes a paused round-robin template and regenerates future occurrences', async () => {
    const paused = buildRoundRobinTemplate({ status: ChoreTemplateStatus.PAUSED });
    const resumed = buildRoundRobinTemplate({
      status: ChoreTemplateStatus.ACTIVE,
      updatedBy: 'admin-1'
    });

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'admin-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-2' }, { userId: 'user-3' }])
      },
      choreTemplate: {
        findFirst: jest.fn().mockResolvedValue(paused),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(resumed)
      }
    };
    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn().mockResolvedValue({
        templateId: 'template-1'
      })
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);
    const result = await service.resumeTemplate('admin-1', 'group-1', 'template-1');

    expect(result.status).toBe(ChoreTemplateStatus.ACTIVE);
    expect(generationMock.maintainTemplateGenerationHorizon).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({
        resetGenerationCursor: true
      })
    );
  });

  it('archives an active template and prevents later resume', async () => {
    const archived = buildTemplate({ status: ChoreTemplateStatus.ARCHIVED, updatedBy: 'admin-1' });
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'admin-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        })
      },
      choreTemplate: {
        findFirst: jest.fn().mockResolvedValueOnce(buildTemplate()).mockResolvedValueOnce(archived),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(archived)
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([{ id: 'chore-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      choreActivity: {
        createMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    };
    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn()
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);
    const archivedResult = await service.archiveTemplate('admin-1', 'group-1', 'template-1');
    expect(archivedResult.status).toBe(ChoreTemplateStatus.ARCHIVED);

    await expect(service.resumeTemplate('admin-1', 'group-1', 'template-1')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('rejects invalid template windows', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          userId: 'admin-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        })
      }
    };
    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
    const generationMock = {
      maintainTemplateGenerationHorizon: jest.fn()
    };

    const service = new ChoreTemplatesService(prismaMock as any, generationMock as any);

    await expect(
      service.createTemplate('admin-1', 'group-1', {
        title: 'Trash',
        assignmentStrategy: ChoreTemplateAssignmentStrategy.FIXED,
        startsOn: new Date('2026-05-06T00:00:00.000Z'),
        endsOn: new Date('2026-04-06T00:00:00.000Z'),
        repeatEveryDays: 7,
        assigneeUserId: 'user-2'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
