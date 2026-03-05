import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChoreStatus, ChoreActivityType, GroupMemberRole, GroupMemberStatus } from '@prisma/client';

import { ChoresService } from '../../../src/modules/chores/chores.service';

describe('ChoresService', () => {
  it('creates a chore for an active group member and logs activity', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gm-1',
          groupId: 'group-1',
          userId: 'user-1',
          role: GroupMemberRole.MEMBER,
          status: GroupMemberStatus.ACTIVE
        })
      },
      chore: {
        create: jest.fn().mockResolvedValue({
          id: 'chore-1',
          groupId: 'group-1',
          title: 'Take out trash',
          description: null,
          status: ChoreStatus.PENDING,
          dueDate: null,
          assignedToUserId: null,
          createdBy: 'user-1',
          completedAt: null,
          createdAt: new Date('2026-03-05T00:00:00.000Z'),
          updatedAt: new Date('2026-03-05T00:00:00.000Z')
        })
      },
      choreActivity: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoresService(prismaMock as any);
    const result = await service.createChore('user-1', 'group-1', {
      title: 'Take out trash'
    } as any);

    expect(txMock.groupMember.findUnique).toHaveBeenCalled();
    expect(txMock.chore.create).toHaveBeenCalled();
    expect(txMock.choreActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: ChoreActivityType.CREATED
        })
      })
    );
    expect(result.status).toBe(ChoreStatus.PENDING);
    expect(result.title).toBe('Take out trash');
  });

  it('throws forbidden when non-member tries to list chores', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      chore: {
        findMany: jest.fn()
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoresService(prismaMock as any);

    await expect(
      service.listGroupChores('user-1', 'group-1', {
        status: ChoreStatus.PENDING
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents assigning chore to non-member', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'chore-1',
          groupId: 'group-1',
          title: 'Take out trash',
          description: null,
          status: ChoreStatus.PENDING,
          dueDate: null,
          assignedToUserId: null,
          createdBy: 'user-1',
          completedAt: null,
          createdAt: new Date('2026-03-05T00:00:00.000Z'),
          updatedAt: new Date('2026-03-05T00:00:00.000Z')
        })
      },
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'gm-1',
            groupId: 'group-1',
            userId: 'user-1',
            role: GroupMemberRole.ADMIN,
            status: GroupMemberStatus.ACTIVE
          })
          .mockResolvedValueOnce(null)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoresService(prismaMock as any);

    await expect(
      service.updateChoreAssignee('user-1', 'chore-1', { assigneeUserId: 'user-2' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents non-admin from assigning chore to someone else', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'chore-1',
          groupId: 'group-1',
          title: 'Take out trash',
          description: null,
          status: ChoreStatus.PENDING,
          dueDate: null,
          assignedToUserId: null,
          createdBy: 'user-1',
          completedAt: null,
          createdAt: new Date('2026-03-05T00:00:00.000Z'),
          updatedAt: new Date('2026-03-05T00:00:00.000Z')
        })
      },
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'gm-1',
            groupId: 'group-1',
            userId: 'user-1',
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.ACTIVE
          })
          .mockResolvedValueOnce({
            id: 'gm-2',
            groupId: 'group-1',
            userId: 'user-2',
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.ACTIVE
          })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoresService(prismaMock as any);

    await expect(
      service.updateChoreAssignee('user-1', 'chore-1', { assigneeUserId: 'user-2' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents non-assignee non-admin from completing chore', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'chore-1',
          groupId: 'group-1',
          title: 'Take out trash',
          description: null,
          status: ChoreStatus.PENDING,
          dueDate: null,
          assignedToUserId: 'user-2',
          createdBy: 'user-1',
          completedAt: null,
          createdAt: new Date('2026-03-05T00:00:00.000Z'),
          updatedAt: new Date('2026-03-05T00:00:00.000Z')
        })
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gm-1',
          groupId: 'group-1',
          userId: 'user-3',
          role: GroupMemberRole.MEMBER,
          status: GroupMemberStatus.ACTIVE
        })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoresService(prismaMock as any);

    await expect(service.completeChore('user-3', 'chore-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('allows assignee to complete chore', async () => {
    const baseChore = {
      id: 'chore-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: null,
      status: ChoreStatus.PENDING,
      dueDate: null,
      assignedToUserId: 'user-2',
      createdBy: 'user-1',
      completedAt: null,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z')
    };

    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(baseChore),
        update: jest.fn().mockResolvedValue({
          ...baseChore,
          status: ChoreStatus.COMPLETED,
          completedAt: new Date('2026-03-05T01:00:00.000Z')
        })
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gm-2',
          groupId: 'group-1',
          userId: 'user-2',
          role: GroupMemberRole.MEMBER,
          status: GroupMemberStatus.ACTIVE
        })
      },
      choreActivity: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoresService(prismaMock as any);
    const result = await service.completeChore('user-2', 'chore-1');

    expect(result.status).toBe(ChoreStatus.COMPLETED);
    expect(result.completedAt).toBeDefined();
    expect(txMock.choreActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: ChoreActivityType.COMPLETED
        })
      })
    );
  });

  it('throws not found when completing missing chore', async () => {
    const txMock = {
      chore: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new ChoresService(prismaMock as any);

    await expect(service.completeChore('user-1', 'chore-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
