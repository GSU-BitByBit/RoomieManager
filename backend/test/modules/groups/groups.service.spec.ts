import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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

  it('throws forbidden when listing members without active membership', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.getGroupMembers('user-2', 'group-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('updates member role by admin and writes audit log', async () => {
    const adminMembership = {
      id: 'gm-admin',
      groupId: 'group-1',
      userId: 'admin-1',
      role: GroupMemberRole.ADMIN,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:00:00.000Z'),
      createdAt: new Date('2026-02-23T00:00:00.000Z'),
      updatedAt: new Date('2026-02-23T00:00:00.000Z')
    };
    const targetMembership = {
      id: 'gm-member',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupMemberRole.MEMBER,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:10:00.000Z'),
      createdAt: new Date('2026-02-23T00:10:00.000Z'),
      updatedAt: new Date('2026-02-23T00:10:00.000Z')
    };
    const updatedMembership = {
      ...targetMembership,
      role: GroupMemberRole.ADMIN,
      updatedAt: new Date('2026-02-23T00:20:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetMembership),
        update: jest.fn().mockResolvedValue(updatedMembership)
      },
      group: {
        findUnique: jest.fn().mockResolvedValue({ id: 'group-1' })
      },
      groupAuditLog: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.updateMemberRole('admin-1', 'group-1', 'user-2', {
      role: 'ADMIN'
    });

    expect(result.role).toBe(GroupMemberRole.ADMIN);
    expect(txMock.groupAuditLog.create).toHaveBeenCalled();
  });

  it('blocks demotion of the last admin', async () => {
    const adminMembership = {
      id: 'gm-admin',
      groupId: 'group-1',
      userId: 'admin-1',
      role: GroupMemberRole.ADMIN,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:00:00.000Z'),
      createdAt: new Date('2026-02-23T00:00:00.000Z'),
      updatedAt: new Date('2026-02-23T00:00:00.000Z')
    };
    const targetAdminMembership = {
      id: 'gm-admin-2',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupMemberRole.ADMIN,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:10:00.000Z'),
      createdAt: new Date('2026-02-23T00:10:00.000Z'),
      updatedAt: new Date('2026-02-23T00:10:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetAdminMembership),
        count: jest.fn().mockResolvedValue(1)
      },
      group: {
        findUnique: jest.fn().mockResolvedValue({ id: 'group-1' })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(
      service.updateMemberRole('admin-1', 'group-1', 'user-2', { role: 'MEMBER' })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks removing yourself from the group in admin remove endpoint', async () => {
    const adminMembership = {
      id: 'gm-admin',
      groupId: 'group-1',
      userId: 'admin-1',
      role: GroupMemberRole.ADMIN,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:00:00.000Z'),
      createdAt: new Date('2026-02-23T00:00:00.000Z'),
      updatedAt: new Date('2026-02-23T00:00:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValueOnce(adminMembership)
      },
      group: {
        findUnique: jest.fn().mockResolvedValue({ id: 'group-1' })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.removeMember('admin-1', 'group-1', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
