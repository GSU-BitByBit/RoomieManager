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
    const generationServiceMock = {
      maintainGroupGenerationHorizon: jest.fn().mockResolvedValue({
        groupId: 'group-1',
        horizonThroughOn: '2026-05-01',
        processedTemplateCount: 2,
        createdOccurrenceCount: 6,
        templates: []
      })
    };

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
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(5)
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

    const service = new GroupsService(prismaMock as any, generationServiceMock as any);
    const result = await service.getGroupDashboard('user-1', 'group-1');

    expect(generationServiceMock.maintainGroupGenerationHorizon).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        tx: txMock,
        today: expect.any(Date)
      })
    );
    expect(result.group.joinCode).toBe('ABCD1234');
    expect(result.members).toEqual({
      totalActive: 3,
      adminCount: 1,
      memberCount: 2
    });
    expect(result.chores).toEqual({
      overdueCount: 1,
      dueTodayCount: 2,
      dueNext7DaysCount: 5,
      assignedToMeDueNext7DaysCount: 2
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

  it('reactivates an inactive membership and resets role to member when rejoining', async () => {
    const reactivatedMembership = {
      id: 'gm-1',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupMemberRole.MEMBER,
      status: GroupMemberStatus.ACTIVE,
      displayName: 'Jordan',
      joinedAt: new Date('2026-03-01T12:00:00.000Z'),
      createdAt: new Date('2026-02-23T00:10:00.000Z'),
      updatedAt: new Date('2026-03-01T12:00:00.000Z')
    };

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
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.INACTIVE,
          displayName: 'Jordan',
          joinedAt: new Date('2026-02-23T00:10:00.000Z'),
          createdAt: new Date('2026-02-23T00:10:00.000Z'),
          updatedAt: new Date('2026-02-23T00:10:00.000Z')
        }),
        update: jest.fn().mockResolvedValue(reactivatedMembership),
        count: jest.fn().mockResolvedValue(2)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.joinGroup('user-2', { joinCode: 'ABCD1234' }, 'Jordan');

    expect(result.memberRole).toBe(GroupMemberRole.MEMBER);
    expect(result.memberStatus).toBe(GroupMemberStatus.ACTIVE);
    expect(txMock.groupMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gm-1' },
        data: expect.objectContaining({
          role: GroupMemberRole.MEMBER,
          status: GroupMemberStatus.ACTIVE
        })
      })
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

  it('blocks removing a member who still has pending chore occurrences assigned', async () => {
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

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(2)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      },
      groupAuditLog: {
        create: jest.fn()
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    try {
      await service.removeMember('admin-1', 'group-1', 'user-2');
      throw new Error('Expected removeMember to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'CONFLICT',
          details: expect.objectContaining({
            pendingOccurrenceCount: 2,
            activeTemplateCount: 0,
            pausedTemplateCount: 0,
            financeBalances: []
          })
        })
      );
    }

    expect(txMock.groupAuditLog.create).not.toHaveBeenCalled();
  });

  it('blocks removing a member who still has active recurring chore templates assigned', async () => {
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

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.removeMember('admin-1', 'group-1', 'user-2')).rejects.toBeInstanceOf(
      ConflictException
    );

    expect(txMock.choreTemplate.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          groupId: 'group-1',
          status: 'ACTIVE',
          OR: expect.arrayContaining([
            {
              assignedToUserId: 'user-2'
            },
            {
              participants: {
                some: {
                  userId: 'user-2'
                }
              }
            }
          ])
        })
      })
    );
  });

  it('blocks removing a member who still participates in active round-robin templates', async () => {
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

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.removeMember('admin-1', 'group-1', 'user-2')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('blocks removing a member who still has paused recurring chore templates assigned', async () => {
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

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(2)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.removeMember('admin-1', 'group-1', 'user-2')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('blocks removing a member who still has unsettled finance balances', async () => {
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

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      }
    };
    const financeServiceMock = {
      getMemberNetBalancesByCurrency: jest
        .fn()
        .mockResolvedValue([{ currency: 'USD', netAmount: -12.5 }])
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(
      prismaMock as any,
      undefined as any,
      financeServiceMock as any
    );

    try {
      await service.removeMember('admin-1', 'group-1', 'user-2');
      throw new Error('Expected removeMember to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'CONFLICT',
          message:
            'Member cannot be removed while they still have unsettled group balances. Settle balances first.',
          details: expect.objectContaining({
            pendingOccurrenceCount: 0,
            activeTemplateCount: 0,
            pausedTemplateCount: 0,
            financeBalances: [{ currency: 'USD', netAmount: -12.5 }]
          })
        })
      );
    }
  });

  it('allows removing a member when only completed/cancelled occurrences and archived templates remain', async () => {
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
      status: GroupMemberStatus.INACTIVE,
      updatedAt: new Date('2026-02-23T00:30:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(adminMembership)
          .mockResolvedValueOnce(targetMembership),
        update: jest.fn().mockResolvedValue(updatedMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      },
      groupAuditLog: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.removeMember('admin-1', 'group-1', 'user-2');

    expect(result).toEqual({
      groupId: 'group-1',
      userId: 'user-2',
      status: GroupMemberStatus.INACTIVE,
      removed: true,
      updatedAt: '2026-02-23T00:30:00.000Z'
    });
    expect(txMock.groupMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GroupMemberStatus.INACTIVE
        })
      })
    );
    expect(txMock.groupAuditLog.create).toHaveBeenCalled();
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

  it('allows a regular member to leave when no blockers remain', async () => {
    const membership = {
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
      ...membership,
      status: GroupMemberStatus.INACTIVE,
      updatedAt: new Date('2026-02-23T00:30:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(membership),
        update: jest.fn().mockResolvedValue(updatedMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      },
      groupAuditLog: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.leaveGroup('user-2', 'group-1');

    expect(result).toEqual({
      groupId: 'group-1',
      userId: 'user-2',
      status: GroupMemberStatus.INACTIVE,
      left: true,
      updatedAt: '2026-02-23T00:30:00.000Z'
    });
    expect(txMock.groupAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'user-2',
          targetUserId: 'user-2',
          action: 'MEMBER_LEFT'
        })
      })
    );
  });

  it('allows an admin to leave when another active admin remains', async () => {
    const membership = {
      id: 'gm-admin',
      groupId: 'group-1',
      userId: 'admin-1',
      role: GroupMemberRole.ADMIN,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:00:00.000Z'),
      createdAt: new Date('2026-02-23T00:00:00.000Z'),
      updatedAt: new Date('2026-02-23T00:00:00.000Z')
    };
    const updatedMembership = {
      ...membership,
      status: GroupMemberStatus.INACTIVE,
      updatedAt: new Date('2026-02-23T00:40:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(membership),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue(updatedMembership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      },
      groupAuditLog: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.leaveGroup('admin-1', 'group-1');

    expect(result.left).toBe(true);
    expect(txMock.groupMember.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          groupId: 'group-1',
          status: GroupMemberStatus.ACTIVE,
          role: GroupMemberRole.ADMIN
        })
      })
    );
  });

  it('blocks the last active admin from leaving', async () => {
    const membership = {
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
        findUnique: jest.fn().mockResolvedValue(membership),
        count: jest.fn().mockResolvedValue(1)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.leaveGroup('admin-1', 'group-1')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('blocks leaving when the member still has pending chore occurrences assigned', async () => {
    const membership = {
      id: 'gm-member',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupMemberRole.MEMBER,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:10:00.000Z'),
      createdAt: new Date('2026-02-23T00:10:00.000Z'),
      updatedAt: new Date('2026-02-23T00:10:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(membership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(2)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.leaveGroup('user-2', 'group-1')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('blocks leaving when the member still participates in active round-robin templates', async () => {
    const membership = {
      id: 'gm-member',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupMemberRole.MEMBER,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:10:00.000Z'),
      createdAt: new Date('2026-02-23T00:10:00.000Z'),
      updatedAt: new Date('2026-02-23T00:10:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(membership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0)
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.leaveGroup('user-2', 'group-1')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('blocks leaving when the member still has unsettled finance balances', async () => {
    const membership = {
      id: 'gm-member',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupMemberRole.MEMBER,
      status: GroupMemberStatus.ACTIVE,
      joinedAt: new Date('2026-02-23T00:10:00.000Z'),
      createdAt: new Date('2026-02-23T00:10:00.000Z'),
      updatedAt: new Date('2026-02-23T00:10:00.000Z')
    };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(membership)
      },
      chore: {
        count: jest.fn().mockResolvedValue(0)
      },
      choreTemplate: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      }
    };
    const financeServiceMock = {
      getMemberNetBalancesByCurrency: jest
        .fn()
        .mockResolvedValue([{ currency: 'USD', netAmount: -14.75 }])
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(
      prismaMock as any,
      undefined as any,
      financeServiceMock as any
    );

    await expect(service.leaveGroup('user-2', 'group-1')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('allows the sole remaining active admin to destroy the group', async () => {
    const membership = {
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
        findUnique: jest.fn().mockResolvedValue(membership),
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1)
      },
      group: {
        delete: jest.fn().mockResolvedValue({ id: 'group-1' })
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);
    const result = await service.destroyGroup('admin-1', 'group-1');

    expect(result).toEqual({
      groupId: 'group-1',
      destroyed: true
    });
    expect(txMock.group.delete).toHaveBeenCalledWith({
      where: { id: 'group-1' }
    });
  });

  it('blocks group destruction when other active members still remain', async () => {
    const membership = {
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
        findUnique: jest.fn().mockResolvedValue(membership),
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)
      },
      group: {
        delete: jest.fn()
      }
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };

    const service = new GroupsService(prismaMock as any);

    await expect(service.destroyGroup('admin-1', 'group-1')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(txMock.group.delete).not.toHaveBeenCalled();
  });
});
