import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { GroupMemberRole, GroupMemberStatus } from '@prisma/client';

import { GroupsService } from '../../../src/modules/groups/groups.service';

describe('GroupsService', () => {
  it('lists active groups for a user with pagination and role-aware join code visibility', async () => {
    const txMock = {
      groupMember: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'gm-1',
            groupId: 'group-1',
            userId: 'user-1',
            role: GroupMemberRole.ADMIN,
            status: GroupMemberStatus.ACTIVE,
            joinedAt: new Date('2026-02-23T00:00:00.000Z'),
            createdAt: new Date('2026-02-23T00:00:00.000Z'),
            updatedAt: new Date('2026-02-23T00:00:00.000Z'),
            group: {
              id: 'group-1',
              name: 'Apartment 12A',
              createdBy: 'user-1',
              createdAt: new Date('2026-02-23T00:00:00.000Z'),
              updatedAt: new Date('2026-02-23T00:10:00.000Z'),
              joinCode: { code: 'ABCD1234' }
            }
          },
          {
            id: 'gm-2',
            groupId: 'group-2',
            userId: 'user-1',
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.ACTIVE,
            joinedAt: new Date('2026-02-24T00:00:00.000Z'),
            createdAt: new Date('2026-02-24T00:00:00.000Z'),
            updatedAt: new Date('2026-02-24T00:00:00.000Z'),
            group: {
              id: 'group-2',
              name: 'Townhouse',
              createdBy: 'user-9',
              createdAt: new Date('2026-02-24T00:00:00.000Z'),
              updatedAt: new Date('2026-02-24T00:10:00.000Z'),
              joinCode: { code: 'ZXCV9876' }
            }
          }
        ]),
        groupBy: jest.fn().mockResolvedValue([
          { groupId: 'group-1', _count: { _all: 2 } },
          { groupId: 'group-2', _count: { _all: 3 } }
        ])
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.listUserGroups('user-1');

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].joinCode).toBe('ABCD1234');
    expect(result.groups[0].memberCount).toBe(2);
    expect(result.groups[1].joinCode).toBeUndefined();
    expect(result.groups[1].memberCount).toBe(3);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(txMock.groupMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          status: GroupMemberStatus.ACTIVE
        },
        skip: 0,
        take: 20
      })
    );
  });

  it('returns empty groups list when user has no active memberships', async () => {
    const txMock = {
      groupMember: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn()
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.listUserGroups('user-1');

    expect(result.groups).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(txMock.groupMember.groupBy).not.toHaveBeenCalled();
  });

  it('returns dashboard aggregates for active member with role-aware join code visibility', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gm-1',
          groupId: 'group-1',
          userId: 'user-1',
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE,
          joinedAt: new Date('2026-03-05T10:00:00.000Z'),
          createdAt: new Date('2026-03-05T10:00:00.000Z'),
          updatedAt: new Date('2026-03-05T10:00:00.000Z'),
          group: {
            id: 'group-1',
            name: 'Apartment 12A',
            createdBy: 'user-1',
            createdAt: new Date('2026-03-05T10:00:00.000Z'),
            updatedAt: new Date('2026-03-05T10:05:00.000Z')
          }
        }),
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1)
      },
      joinCode: {
        findUnique: jest.fn().mockResolvedValue({ code: 'ABCD1234' })
      },
      chore: {
        count: jest
          .fn()
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2)
      },
      bill: {
        count: jest.fn().mockResolvedValue(5),
        findFirst: jest.fn().mockResolvedValue({ incurredAt: new Date('2026-03-05T12:00:00.000Z') })
      },
      payment: {
        count: jest.fn().mockResolvedValue(7),
        findFirst: jest.fn().mockResolvedValue({ paidAt: new Date('2026-03-05T13:00:00.000Z') })
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue({
          draftContent: 'current draft',
          publishedVersion: 2,
          updatedAt: new Date('2026-03-05T11:00:00.000Z')
        })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.getGroupDashboard('user-1', 'group-1');

    expect(result.group.joinCode).toBe('ABCD1234');
    expect(result.members).toEqual({
      totalActive: 3,
      adminCount: 1,
      memberCount: 2
    });
    expect(result.chores).toEqual({
      pendingCount: 4,
      completedCount: 8,
      overdueCount: 1,
      assignedToMePendingCount: 2
    });
    expect(result.finance).toEqual({
      billCount: 5,
      paymentCount: 7,
      latestBillIncurredAt: '2026-03-05T12:00:00.000Z',
      latestPaymentPaidAt: '2026-03-05T13:00:00.000Z'
    });
    expect(result.contract).toEqual({
      hasDraft: true,
      publishedVersion: 2,
      updatedAt: '2026-03-05T11:00:00.000Z'
    });
  });

  it('hides join code in dashboard for non-admin member', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gm-1',
          groupId: 'group-1',
          userId: 'user-1',
          role: GroupMemberRole.MEMBER,
          status: GroupMemberStatus.ACTIVE,
          joinedAt: new Date('2026-03-05T10:00:00.000Z'),
          createdAt: new Date('2026-03-05T10:00:00.000Z'),
          updatedAt: new Date('2026-03-05T10:00:00.000Z'),
          group: {
            id: 'group-1',
            name: 'Apartment 12A',
            createdBy: 'user-2',
            createdAt: new Date('2026-03-05T10:00:00.000Z'),
            updatedAt: new Date('2026-03-05T10:05:00.000Z')
          }
        }),
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1)
      },
      joinCode: {
        findUnique: jest.fn()
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      bill: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      payment: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.getGroupDashboard('user-1', 'group-1');

    expect(result.group.joinCode).toBeUndefined();
    expect(txMock.joinCode.findUnique).not.toHaveBeenCalled();
  });

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
    expect(result.joinCode).toMatch(/^[A-Z2-9]{8}$/);
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
