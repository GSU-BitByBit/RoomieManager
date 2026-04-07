import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
import { ChoreActivityType, ChoreStatus, GroupMemberRole, GroupMemberStatus } from '@prisma/client';

import { ChoresService } from '../../../src/modules/chores/chores.service';

const buildMember = (overrides: Record<string, unknown> = {}) => ({
  id: 'gm-1',
  groupId: 'group-1',
  userId: 'user-1',
  role: GroupMemberRole.MEMBER,
  status: GroupMemberStatus.ACTIVE,
  ...overrides
});

const buildChore = (overrides: Record<string, unknown> = {}) => ({
  id: 'chore-1',
  groupId: 'group-1',
  templateId: null,
  title: 'Take out trash',
  description: null,
  status: ChoreStatus.PENDING,
  dueOn: new Date('2026-03-05T00:00:00.000Z'),
  assignedToUserId: 'user-1',
  createdBy: 'user-1',
  completedAt: null,
  completedByUserId: null,
  createdAt: new Date('2026-03-05T00:00:00.000Z'),
  updatedAt: new Date('2026-03-05T00:00:00.000Z'),
  ...overrides
});

const createService = (
  txMock: Record<string, unknown>,
  generationOverrides: Record<string, unknown> = {}
) => {
  const prismaMock = {
    $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
  };
  const generationMock = {
    maintainGroupGenerationHorizon: jest.fn().mockResolvedValue(undefined),
    ...generationOverrides
  };

  return {
    service: new ChoresService(prismaMock as any, generationMock as any),
    prismaMock,
    generationMock
  };
};

describe('ChoresService', () => {
  it('requires assignee and dueOn for one-off chore creation', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember())
      }
    };

    const { service } = createService(txMock);

    await expect(
      service.createChore('user-1', 'group-1', {
        title: 'Take out trash'
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an active member to create a one-off chore only for themselves', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildMember())
          .mockResolvedValueOnce(buildMember())
      },
      chore: {
        create: jest.fn().mockResolvedValue(buildChore())
      },
      choreActivity: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const { service } = createService(txMock);
    const result = await service.createChore('user-1', 'group-1', {
      title: 'Take out trash',
      dueOn: new Date('2026-03-05T14:00:00.000Z'),
      assigneeUserId: 'user-1'
    } as any);

    expect(result.status).toBe(ChoreStatus.PENDING);
    expect(txMock.chore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedToUserId: 'user-1',
          dueOn: new Date('2026-03-05T00:00:00.000Z')
        })
      })
    );
  });

  it('prevents non-admin members from creating a one-off chore for someone else', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildMember())
          .mockResolvedValueOnce(buildMember({ userId: 'user-2' }))
      }
    };

    const { service } = createService(txMock);

    await expect(
      service.createChore('user-1', 'group-1', {
        title: 'Take out trash',
        dueOn: new Date('2026-03-05T00:00:00.000Z'),
        assigneeUserId: 'user-2'
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admins to create a one-off chore for any active group member', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildMember({ role: GroupMemberRole.ADMIN, userId: 'admin-1' }))
          .mockResolvedValueOnce(buildMember({ userId: 'user-2' }))
      },
      chore: {
        create: jest
          .fn()
          .mockResolvedValue(buildChore({ assignedToUserId: 'user-2', createdBy: 'admin-1' }))
      },
      choreActivity: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const { service } = createService(txMock);
    const result = await service.createChore('admin-1', 'group-1', {
      title: 'Take out trash',
      dueOn: new Date('2026-03-05T00:00:00.000Z'),
      assigneeUserId: 'user-2'
    } as any);

    expect(result.assigneeUserId).toBe('user-2');
  });

  it('tops up recurring generation when listing chores', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember())
      },
      chore: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([buildChore()])
      }
    };

    const { service, generationMock } = createService(txMock);

    await service.listGroupChores('user-1', 'group-1', {} as any);

    expect(generationMock.maintainGroupGenerationHorizon).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        tx: txMock
      })
    );
  });

  it('prevents non-members from listing chores', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const { service } = createService(txMock);

    await expect(service.listGroupChores('user-1', 'group-1', {} as any)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('prevents assigning a chore occurrence to a non-member', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(buildChore())
      },
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildMember({ role: GroupMemberRole.ADMIN }))
          .mockResolvedValueOnce(null)
      }
    };

    const { service } = createService(txMock);

    await expect(
      service.updateOccurrenceAssignee('user-1', 'chore-1', { assigneeUserId: 'user-2' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents non-admins from reassigning chore occurrences', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(buildChore())
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember())
      }
    };

    const { service } = createService(txMock);

    await expect(
      service.updateOccurrenceAssignee('user-1', 'chore-1', { assigneeUserId: 'user-2' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents reassigning non-pending occurrences', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(buildChore({ status: ChoreStatus.COMPLETED }))
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember({ role: GroupMemberRole.ADMIN }))
      }
    };

    const { service } = createService(txMock);

    await expect(
      service.updateOccurrenceAssignee('user-1', 'chore-1', { assigneeUserId: 'user-2' })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows admins to reassign pending chore occurrences', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(buildChore()),
        update: jest.fn().mockResolvedValue(buildChore({ assignedToUserId: 'user-2' }))
      },
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(buildMember({ role: GroupMemberRole.ADMIN }))
          .mockResolvedValueOnce(buildMember({ userId: 'user-2' }))
      },
      choreActivity: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const { service } = createService(txMock);
    const result = await service.updateOccurrenceAssignee('user-1', 'chore-1', {
      assigneeUserId: 'user-2'
    });

    expect(result.assigneeUserId).toBe('user-2');
    expect(txMock.choreActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: ChoreActivityType.ASSIGNED
        })
      })
    );
  });

  it('prevents non-assignee non-admin from completing a chore occurrence', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(buildChore({ assignedToUserId: 'user-2' }))
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember({ userId: 'user-3' }))
      }
    };

    const { service } = createService(txMock);

    await expect(service.completeOccurrence('user-3', 'chore-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('prevents completing cancelled chore occurrences', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(buildChore({ status: ChoreStatus.CANCELLED }))
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember())
      }
    };

    const { service } = createService(txMock);

    await expect(service.completeOccurrence('user-1', 'chore-1')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('allows the assignee to complete a chore occurrence and tracks the completion actor', async () => {
    const baseChore = buildChore({ assignedToUserId: 'user-2', createdBy: 'user-1' });
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(baseChore),
        update: jest.fn().mockResolvedValue({
          ...baseChore,
          status: ChoreStatus.COMPLETED,
          completedAt: new Date('2026-03-05T01:00:00.000Z'),
          completedByUserId: 'user-2'
        })
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember({ userId: 'user-2' }))
      },
      choreActivity: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const { service } = createService(txMock);
    const result = await service.completeOccurrence('user-2', 'chore-1');

    expect(result.status).toBe(ChoreStatus.COMPLETED);
    expect(result.completedByUserId).toBe('user-2');
    expect(txMock.chore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completedByUserId: 'user-2'
        })
      })
    );
  });

  it('throws not found when completing a missing chore occurrence', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const { service } = createService(txMock);

    await expect(service.completeOccurrence('user-1', 'chore-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('returns a flat calendar occurrence list sorted by dueOn', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember())
      },
      chore: {
        findMany: jest.fn().mockResolvedValue([
          buildChore({
            id: 'chore-2',
            templateId: 'template-1',
            assignedToUserId: 'user-2',
            dueOn: new Date('2026-03-06T00:00:00.000Z')
          })
        ])
      }
    };

    const { service, generationMock } = createService(txMock);
    const result = await service.getGroupChoreCalendar('user-1', 'group-1', {
      start: new Date('2026-03-01T00:00:00.000Z'),
      end: new Date('2026-04-26T00:00:00.000Z')
    } as any);

    expect(result.groupId).toBe('group-1');
    expect(result.occurrences).toEqual([
      expect.objectContaining({
        id: 'chore-2',
        assigneeUserId: 'user-2',
        dueOn: '2026-03-06'
      })
    ]);
    expect(generationMock.maintainGroupGenerationHorizon).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ tx: txMock })
    );
  });

  it('rejects an invalid calendar date range', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(buildMember())
      }
    };

    const { service } = createService(txMock);

    await expect(
      service.getGroupChoreCalendar('user-1', 'group-1', {
        start: new Date('2026-03-01T00:00:00.000Z'),
        end: new Date('2026-05-27T00:00:00.000Z')
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
