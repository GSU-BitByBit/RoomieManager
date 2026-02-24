import { ConflictException, ForbiddenException } from '@nestjs/common';
import { GroupMemberRole, GroupMemberStatus } from '@prisma/client';

import { GroupsService } from '../../../src/modules/groups/groups.service';

describe('GroupsService', () => {
  it('creates a group with admin membership and join code', async () => {
    const txMock = {
      group: {
        create: jest.fn().mockResolvedValue({
          id: 'group-1',
          name: 'Apartment 12A',
          createdBy: 'user-1',
          createdAt: new Date('2026-02-23T00:00:00.000Z'),
          updatedAt: new Date('2026-02-23T00:00:00.000Z')
        })
      },
      groupMember: {
        create: jest.fn().mockResolvedValue({})
      },
      joinCode: {
        upsert: jest.fn().mockResolvedValue({})
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.createGroup('user-1', { name: 'Apartment 12A' });

    expect(txMock.group.create).toHaveBeenCalled();
    expect(txMock.groupMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        })
      })
    );
    expect(result.memberRole).toBe(GroupMemberRole.ADMIN);
    expect(result.joinCode).toBeDefined();
  });

  it('throws conflict when joining a group already joined', async () => {
    const txMock = {
      joinCode: {
        findUnique: jest.fn().mockResolvedValue({
          groupId: 'group-1',
          code: 'ABCD1234',
          group: {
            id: 'group-1',
            name: 'Apartment 12A',
            createdBy: 'user-1',
            createdAt: new Date('2026-02-23T00:00:00.000Z'),
            updatedAt: new Date('2026-02-23T00:00:00.000Z')
          }
        })
      },
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gm-1',
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

    const service = new GroupsService(prismaMock as any);

    await expect(service.joinGroup('user-2', { joinCode: 'ABCD1234' })).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('throws forbidden for non-admin reset', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
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

    const service = new GroupsService(prismaMock as any);

    await expect(service.resetJoinCode('user-2', 'group-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
