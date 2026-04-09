import {
  ConflictException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { GroupsService } from '../src/modules/groups/groups.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';

describe('Groups endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const groupsServiceMock = {
    listUserGroups: jest.fn(async () => ({
      groups: [
        {
          id: 'group-1',
          name: 'Apartment 12A',
          createdBy: 'user-1',
          createdAt: '2026-02-23T00:00:00.000Z',
          updatedAt: '2026-02-23T00:00:00.000Z',
          memberRole: 'ADMIN',
          memberStatus: 'ACTIVE',
          memberCount: 2,
          joinCode: 'ABCD1234'
        }
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })),
    createGroup: jest.fn(async () => ({
      id: 'group-1',
      name: 'Apartment 12A',
      createdBy: 'user-1',
      createdAt: '2026-02-23T00:00:00.000Z',
      updatedAt: '2026-02-23T00:00:00.000Z',
      memberRole: 'ADMIN',
      memberStatus: 'ACTIVE',
      memberCount: 1,
      joinCode: 'ABCD1234'
    })),
    joinGroup: jest.fn(async () => ({
      id: 'group-1',
      name: 'Apartment 12A',
      createdBy: 'user-1',
      createdAt: '2026-02-23T00:00:00.000Z',
      updatedAt: '2026-02-23T00:00:00.000Z',
      memberRole: 'MEMBER',
      memberStatus: 'ACTIVE',
      memberCount: 2
    })),
    resetJoinCode: jest.fn(async () => ({
      groupId: 'group-1',
      joinCode: 'ZXCV9876'
    })),
    getGroup: jest.fn(async () => ({
      id: 'group-1',
      name: 'Apartment 12A',
      createdBy: 'user-1',
      createdAt: '2026-02-23T00:00:00.000Z',
      updatedAt: '2026-02-23T00:00:00.000Z',
      memberRole: 'ADMIN',
      memberStatus: 'ACTIVE',
      memberCount: 2,
      joinCode: 'ZXCV9876'
    })),
    getGroupMembers: jest.fn(async () => ({
      groupId: 'group-1',
      members: [
        {
          userId: 'user-1',
          role: 'ADMIN',
          status: 'ACTIVE',
          joinedAt: '2026-02-23T00:00:00.000Z',
          createdAt: '2026-02-23T00:00:00.000Z',
          updatedAt: '2026-02-23T00:00:00.000Z'
        },
        {
          userId: 'user-2',
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: '2026-02-23T00:10:00.000Z',
          createdAt: '2026-02-23T00:10:00.000Z',
          updatedAt: '2026-02-23T00:10:00.000Z'
        }
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })),
    getGroupDashboard: jest.fn(async () => ({
      group: {
        id: 'group-1',
        name: 'Apartment 12A',
        createdBy: 'user-1',
        createdAt: '2026-02-23T00:00:00.000Z',
        updatedAt: '2026-02-23T00:00:00.000Z',
        memberRole: 'ADMIN',
        memberStatus: 'ACTIVE',
        memberCount: 2,
        joinCode: 'ABCD1234'
      },
      members: {
        totalActive: 2,
        adminCount: 1,
        memberCount: 1
      },
      chores: {
        overdueCount: 1,
        dueTodayCount: 1,
        dueNext7DaysCount: 4,
        assignedToMeDueNext7DaysCount: 2
      },
      finance: {
        billCount: 4,
        paymentCount: 6,
        latestBillIncurredAt: '2026-02-23T00:00:00.000Z',
        latestPaymentPaidAt: '2026-02-23T00:00:00.000Z'
      },
      contract: {
        hasDraft: true,
        publishedVersion: 2,
        updatedAt: '2026-02-23T00:00:00.000Z'
      }
    })),
    updateMemberRole: jest.fn(async () => ({
      groupId: 'group-1',
      userId: 'user-2',
      role: 'ADMIN',
      status: 'ACTIVE',
      updatedAt: '2026-02-23T00:20:00.000Z'
    })),
    removeMember: jest.fn(async () => ({
      groupId: 'group-1',
      userId: 'user-2',
      status: 'INACTIVE',
      removed: true,
      updatedAt: '2026-02-23T00:30:00.000Z'
    })),
    leaveGroup: jest.fn(async () => ({
      groupId: 'group-1',
      userId: 'user-1',
      status: 'INACTIVE',
      left: true,
      updatedAt: '2026-02-23T00:35:00.000Z'
    })),
    destroyGroup: jest.fn(async () => ({
      groupId: 'group-1',
      destroyed: true
    }))
  };

  const jwtServiceMock = {
    verifyAccessToken: jest.fn(async (token: string) => {
      if (token !== 'valid-token') {
        throw new UnauthorizedException('Invalid or expired access token.');
      }

      return {
        id: 'user-1',
        email: 'alex@example.com',
        role: 'authenticated',
        aud: 'authenticated'
      };
    })
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn()
      })
      .overrideProvider(GroupsService)
      .useValue(groupsServiceMock)
      .overrideProvider(SupabaseJwtService)
      .useValue(jwtServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    app = undefined;
    jest.clearAllMocks();
  });

  it('POST /api/v1/groups requires auth', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups')
      .send({ name: 'Apartment 12A' })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/groups lists current user groups', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.groups).toHaveLength(1);
    expect(response.body.data.pagination.page).toBe(1);
    expect(groupsServiceMock.listUserGroups).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      }),
      'Alex'
    );
  });

  it('GET /api/v1/groups rejects invalid pagination query', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups')
      .set('Authorization', 'Bearer valid-token')
      .query({ pageSize: 999 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(groupsServiceMock.listUserGroups).not.toHaveBeenCalled();
  });

  it('POST /api/v1/groups creates group', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Apartment 12A' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.joinCode).toBe('ABCD1234');
    expect(groupsServiceMock.createGroup).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ name: 'Apartment 12A' }),
      'Alex'
    );
  });

  it('POST /api/v1/groups rejects whitespace-only name', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '   ' })
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(groupsServiceMock.createGroup).not.toHaveBeenCalled();
  });

  it('POST /api/v1/groups/join joins by code', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups/join')
      .set('Authorization', 'Bearer valid-token')
      .send({ joinCode: 'ABCD1234' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.memberRole).toBe('MEMBER');
    expect(groupsServiceMock.joinGroup).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ joinCode: 'ABCD1234' }),
      'Alex'
    );
  });

  it('POST /api/v1/groups/:groupId/join-code/reset resets join code', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    groupsServiceMock.resetJoinCode.mockResolvedValueOnce({
      groupId,
      joinCode: 'ZXCV9876'
    });

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/join-code/reset`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.joinCode).toBe('ZXCV9876');
    expect(groupsServiceMock.resetJoinCode).toHaveBeenCalledWith('user-1', groupId);
  });

  it('GET /api/v1/groups/:groupId returns group', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    groupsServiceMock.getGroup.mockResolvedValueOnce({
      id: groupId,
      name: 'Apartment 12A',
      createdBy: 'user-1',
      createdAt: '2026-02-23T00:00:00.000Z',
      updatedAt: '2026-02-23T00:00:00.000Z',
      memberRole: 'ADMIN',
      memberStatus: 'ACTIVE',
      memberCount: 2,
      joinCode: 'ZXCV9876'
    });

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(groupId);
    expect(groupsServiceMock.getGroup).toHaveBeenCalledWith('user-1', groupId, 'Alex');
  });

  it('GET /api/v1/groups/:groupId/members returns members', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.members).toHaveLength(2);
    expect(response.body.data.pagination.page).toBe(1);
    expect(groupsServiceMock.getGroupMembers).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        sortBy: 'role',
        sortOrder: 'asc'
      }),
      'Alex'
    );
  });

  it('GET /api/v1/groups/:groupId/dashboard returns group dashboard aggregates', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/dashboard`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.group.id).toBe('group-1');
    expect(response.body.data.members.totalActive).toBe(2);
    expect(response.body.data.chores).toEqual({
      overdueCount: 1,
      dueTodayCount: 1,
      dueNext7DaysCount: 4,
      assignedToMeDueNext7DaysCount: 2
    });
    expect(response.body.data.finance.billCount).toBe(4);
    expect(response.body.data.contract.publishedVersion).toBe(2);
    expect(groupsServiceMock.getGroupDashboard).toHaveBeenCalledWith(
      'user-1',
      groupId,
      'Alex'
    );
  });

  it('GET /api/v1/groups/:groupId/dashboard rejects non-app-id groupId', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups/not-a-uuid/dashboard')
      .set('Authorization', 'Bearer valid-token')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(groupsServiceMock.getGroupDashboard).not.toHaveBeenCalled();
  });

  it('GET /api/v1/groups/:groupId/members rejects invalid pagination query', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', 'Bearer valid-token')
      .query({ page: 0 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(groupsServiceMock.getGroupMembers).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/groups/:groupId/members/:userId/role updates role', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '550e8400-e29b-41d4-a716-446655440001';

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/members/${userId}/role`)
      .set('Authorization', 'Bearer valid-token')
      .send({ role: 'ADMIN' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe('ADMIN');
    expect(groupsServiceMock.updateMemberRole).toHaveBeenCalledWith(
      'user-1',
      groupId,
      userId,
      expect.objectContaining({ role: 'ADMIN' })
    );
  });

  it('PATCH /api/v1/groups/:groupId/members/:userId/role validates role enum', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '550e8400-e29b-41d4-a716-446655440001';

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/members/${userId}/role`)
      .set('Authorization', 'Bearer valid-token')
      .send({ role: 'OWNER' })
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(groupsServiceMock.updateMemberRole).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/groups/:groupId/members/:userId removes member', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '550e8400-e29b-41d4-a716-446655440001';

    const response = await request(app!.getHttpServer())
      .delete(`/api/v1/groups/${groupId}/members/${userId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.removed).toBe(true);
    expect(groupsServiceMock.removeMember).toHaveBeenCalledWith('user-1', groupId, userId);
  });

  it('POST /api/v1/groups/:groupId/leave marks the current member inactive', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/leave`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      groupId: 'group-1',
      userId: 'user-1',
      status: 'INACTIVE',
      left: true,
      updatedAt: '2026-02-23T00:35:00.000Z'
    });
    expect(groupsServiceMock.leaveGroup).toHaveBeenCalledWith('user-1', groupId);
  });

  it('POST /api/v1/groups/:groupId/leave returns explicit conflict details when blockers remain', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    groupsServiceMock.leaveGroup.mockRejectedValueOnce(
      new ConflictException({
        code: 'CONFLICT',
        message:
          'You cannot leave this group while assigned pending chore occurrences or recurring chore templates remain. Reassign them first.',
        details: {
          pendingOccurrenceCount: 1,
          activeTemplateCount: 0,
          pausedTemplateCount: 0,
          financeBalances: []
        }
      })
    );

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/leave`)
      .set('Authorization', 'Bearer valid-token')
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.details).toEqual({
      pendingOccurrenceCount: 1,
      activeTemplateCount: 0,
      pausedTemplateCount: 0,
      financeBalances: []
    });
  });

  it('DELETE /api/v1/groups/:groupId destroys the group for the sole remaining admin', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .delete(`/api/v1/groups/${groupId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      groupId: 'group-1',
      destroyed: true
    });
    expect(groupsServiceMock.destroyGroup).toHaveBeenCalledWith('user-1', groupId);
  });

  it('DELETE /api/v1/groups/:groupId returns conflict when other active members remain', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    groupsServiceMock.destroyGroup.mockRejectedValueOnce(
      new ConflictException({
        code: 'CONFLICT',
        message:
          'Only the last remaining active member can destroy this group. Remove or have everyone else leave first.'
      })
    );

    const response = await request(app!.getHttpServer())
      .delete(`/api/v1/groups/${groupId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('DELETE /api/v1/groups/:groupId/members/:userId returns explicit conflict details for blocking chore dependencies', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '550e8400-e29b-41d4-a716-446655440001';

    groupsServiceMock.removeMember.mockRejectedValueOnce(
      new ConflictException({
        code: 'CONFLICT',
        message:
          'Member cannot be removed while assigned pending chore occurrences or recurring chore templates remain. Reassign them first.',
        details: {
          pendingOccurrenceCount: 2,
          activeTemplateCount: 1,
          pausedTemplateCount: 0
        }
      })
    );

    const response = await request(app!.getHttpServer())
      .delete(`/api/v1/groups/${groupId}/members/${userId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.details).toEqual({
      pendingOccurrenceCount: 2,
      activeTemplateCount: 1,
      pausedTemplateCount: 0
    });
  });

  it('DELETE /api/v1/groups/:groupId/members/:userId returns explicit conflict details for unsettled finance balances', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '550e8400-e29b-41d4-a716-446655440001';

    groupsServiceMock.removeMember.mockRejectedValueOnce(
      new ConflictException({
        code: 'CONFLICT',
        message:
          'Member cannot be removed while they still have unsettled group balances. Settle balances first.',
        details: {
          pendingOccurrenceCount: 0,
          activeTemplateCount: 0,
          pausedTemplateCount: 0,
          financeBalances: [{ currency: 'USD', netAmount: -12.5 }]
        }
      })
    );

    const response = await request(app!.getHttpServer())
      .delete(`/api/v1/groups/${groupId}/members/${userId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.details).toEqual({
      pendingOccurrenceCount: 0,
      activeTemplateCount: 0,
      pausedTemplateCount: 0,
      financeBalances: [{ currency: 'USD', netAmount: -12.5 }]
    });
  });

  it('rejects non-UUID groupId with 400', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups/not-a-uuid')
      .set('Authorization', 'Bearer valid-token')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(groupsServiceMock.getGroup).not.toHaveBeenCalled();
  });
});
