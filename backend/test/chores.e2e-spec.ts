import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ChoresService } from '../src/modules/chores/chores.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';

describe('Chores endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const choresServiceMock = {
    createChore: jest.fn(async () => ({
      id: 'chore-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: null,
      status: 'PENDING',
      dueDate: null,
      assignedToUserId: null,
      createdBy: 'user-1',
      completedAt: null,
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z'
    })),
    listGroupChores: jest.fn(async () => ({
      groupId: 'group-1',
      chores: [
        {
          id: 'chore-1',
          groupId: 'group-1',
          title: 'Take out trash',
          description: null,
          status: 'PENDING',
          dueDate: null,
          assignedToUserId: null,
          createdBy: 'user-1',
          completedAt: null,
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z'
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
    updateChoreAssignee: jest.fn(async () => ({
      id: 'chore-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: null,
      status: 'PENDING',
      dueDate: null,
      assignedToUserId: 'user-2',
      createdBy: 'user-1',
      completedAt: null,
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T01:00:00.000Z'
    })),
    completeChore: jest.fn(async () => ({
      id: 'chore-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: null,
      status: 'COMPLETED',
      dueDate: null,
      assignedToUserId: 'user-2',
      createdBy: 'user-1',
      completedAt: '2026-03-05T01:00:00.000Z',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T01:00:00.000Z'
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
      .overrideProvider(ChoresService)
      .useValue(choresServiceMock)
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

  it('POST /api/v1/groups/:groupId/chores requires auth', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chores`)
      .send({ title: 'Take out trash' })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/groups/:groupId/chores creates chore', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', 'Bearer valid-token')
      .send({ title: 'Take out trash' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Take out trash');
    expect(choresServiceMock.createChore).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({ title: 'Take out trash' })
    );
  });

  it('GET /api/v1/groups/:groupId/chores lists chores', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', 'Bearer valid-token')
      .query({ status: 'PENDING' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.chores).toHaveLength(1);
    expect(choresServiceMock.listGroupChores).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        status: 'PENDING',
        page: 1,
        pageSize: 20,
        sortBy: 'dueDate',
        sortOrder: 'asc'
      })
    );
  });

  it('GET /api/v1/groups/:groupId/chores rejects invalid sort order', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', 'Bearer valid-token')
      .query({ sortOrder: 'sideways' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(choresServiceMock.listGroupChores).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/chores/:choreId/assign updates assignee', async () => {
    const choreId = '550e8400-e29b-41d4-a716-446655440010';

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/chores/${choreId}/assign`)
      .set('Authorization', 'Bearer valid-token')
      .send({ assigneeUserId: 'user-2' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.assignedToUserId).toBe('user-2');
    expect(choresServiceMock.updateChoreAssignee).toHaveBeenCalledWith(
      'user-1',
      choreId,
      expect.objectContaining({ assigneeUserId: 'user-2' })
    );
  });

  it('PATCH /api/v1/chores/:choreId/complete completes chore', async () => {
    const choreId = '550e8400-e29b-41d4-a716-446655440010';

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/chores/${choreId}/complete`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('COMPLETED');
    expect(choresServiceMock.completeChore).toHaveBeenCalledWith('user-1', choreId);
  });
});
