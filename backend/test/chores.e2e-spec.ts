import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';
import { ChoreTemplatesService } from '../src/modules/chores/chore-templates.service';
import { ChoresService } from '../src/modules/chores/chores.service';

describe('Chores endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const choresServiceMock = {
    createChore: jest.fn(async () => ({
      id: 'chore-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: null,
      status: 'PENDING',
      dueOn: '2026-03-05',
      assigneeUserId: 'user-1',
      createdBy: 'user-1',
      templateId: null,
      completedByUserId: null,
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
          dueOn: '2026-03-05',
          assigneeUserId: 'user-1',
          createdBy: 'user-1',
          templateId: null,
          completedByUserId: null,
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
    getGroupChoreCalendar: jest.fn(async () => ({
      groupId: 'group-1',
      start: '2026-03-01',
      end: '2026-04-26',
      occurrences: [
        {
          id: 'chore-1',
          templateId: 'template-1',
          title: 'Take out trash',
          description: null,
          dueOn: '2026-03-05',
          assigneeUserId: 'user-1',
          status: 'PENDING',
          completedAt: null,
          completedByUserId: null
        }
      ]
    })),
    updateOccurrenceAssignee: jest.fn(async () => ({
      id: 'chore-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: null,
      status: 'PENDING',
      dueOn: '2026-03-05',
      assigneeUserId: 'user-2',
      createdBy: 'user-1',
      templateId: null,
      completedByUserId: null,
      completedAt: null,
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T01:00:00.000Z'
    })),
    completeOccurrence: jest.fn(async () => ({
      id: 'chore-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: null,
      status: 'COMPLETED',
      dueOn: '2026-03-05',
      assigneeUserId: 'user-2',
      createdBy: 'user-1',
      templateId: null,
      completedByUserId: 'user-1',
      completedAt: '2026-03-05T01:00:00.000Z',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T01:00:00.000Z'
    }))
  };

  const choreTemplatesServiceMock = {
    listGroupTemplates: jest.fn(async () => ({
      groupId: 'group-1',
      templates: [
        {
          id: 'template-1',
          groupId: 'group-1',
          title: 'Take out trash',
          description: 'Kitchen bins',
          status: 'ACTIVE',
          startsOn: '2026-03-09',
          endsOn: null,
          repeatEveryDays: 7,
          assignmentStrategy: 'FIXED',
          assigneeUserId: 'user-2',
          participants: [],
          createdBy: 'user-1',
          updatedBy: 'user-1',
          generatedThroughOn: '2026-05-04',
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z'
        }
      ]
    })),
    createTemplate: jest.fn(async () => ({
      id: 'template-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: 'Kitchen bins',
      status: 'ACTIVE',
      startsOn: '2026-03-09',
      endsOn: null,
      repeatEveryDays: 7,
      assignmentStrategy: 'FIXED',
      assigneeUserId: 'user-2',
      participants: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      generatedThroughOn: '2026-05-04',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z'
    })),
    updateTemplate: jest.fn(async () => ({
      id: 'template-1',
      groupId: 'group-1',
      title: 'Take out trash and recycling',
      description: 'Kitchen bins',
      status: 'ACTIVE',
      startsOn: '2026-03-09',
      endsOn: null,
      repeatEveryDays: 7,
      assignmentStrategy: 'FIXED',
      assigneeUserId: 'user-2',
      participants: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      generatedThroughOn: '2026-05-04',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    })),
    pauseTemplate: jest.fn(async () => ({
      id: 'template-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: 'Kitchen bins',
      status: 'PAUSED',
      startsOn: '2026-03-09',
      endsOn: null,
      repeatEveryDays: 7,
      assignmentStrategy: 'FIXED',
      assigneeUserId: 'user-2',
      participants: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      generatedThroughOn: '2026-05-04',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    })),
    resumeTemplate: jest.fn(async () => ({
      id: 'template-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: 'Kitchen bins',
      status: 'ACTIVE',
      startsOn: '2026-03-09',
      endsOn: null,
      repeatEveryDays: 7,
      assignmentStrategy: 'FIXED',
      assigneeUserId: 'user-2',
      participants: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      generatedThroughOn: '2026-05-11',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    })),
    archiveTemplate: jest.fn(async () => ({
      id: 'template-1',
      groupId: 'group-1',
      title: 'Take out trash',
      description: 'Kitchen bins',
      status: 'ARCHIVED',
      startsOn: '2026-03-09',
      endsOn: null,
      repeatEveryDays: 7,
      assignmentStrategy: 'FIXED',
      assigneeUserId: 'user-2',
      participants: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      generatedThroughOn: '2026-05-04',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
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
      .overrideProvider(ChoreTemplatesService)
      .useValue(choreTemplatesServiceMock)
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
      .send({ title: 'Take out trash', dueOn: '2026-03-05', assigneeUserId: 'user-1' })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/groups/:groupId/chores creates one-off occurrence with required dueOn and assignee', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', 'Bearer valid-token')
      .send({ title: 'Take out trash', dueOn: '2026-03-05', assigneeUserId: 'user-1' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Take out trash');
    expect(response.body.data.assigneeUserId).toBe('user-1');
    expect(choresServiceMock.createChore).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        title: 'Take out trash',
        dueOn: new Date('2026-03-05T00:00:00.000Z'),
        assigneeUserId: 'user-1'
      })
    );
  });

  it('GET /api/v1/groups/:groupId/chores lists occurrences', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', 'Bearer valid-token')
      .query({ status: 'PENDING' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.chores).toHaveLength(1);
    expect(response.body.data.chores[0].assigneeUserId).toBe('user-1');
    expect(choresServiceMock.listGroupChores).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        status: 'PENDING',
        page: 1,
        pageSize: 20,
        sortBy: 'dueOn',
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

  it('GET /api/v1/groups/:groupId/chores/calendar returns a flat occurrence list for the requested range', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/chores/calendar`)
      .set('Authorization', 'Bearer valid-token')
      .query({ start: '2026-03-01', end: '2026-04-26' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.occurrences).toHaveLength(1);
    expect(response.body.data.occurrences[0].assigneeUserId).toBe('user-1');
    expect(choresServiceMock.getGroupChoreCalendar).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        start: new Date('2026-03-01T00:00:00.000Z'),
        end: new Date('2026-04-26T00:00:00.000Z')
      })
    );
  });

  it('GET /api/v1/groups/:groupId/chores/calendar rejects an invalid date range', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/chores/calendar`)
      .set('Authorization', 'Bearer valid-token')
      .query({ start: '2026-03-01', end: '2026-05-27' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(choresServiceMock.getGroupChoreCalendar).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/chores/:occurrenceId/assignee reassigns an occurrence', async () => {
    const occurrenceId = '550e8400-e29b-41d4-a716-446655440010';

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/chores/${occurrenceId}/assignee`)
      .set('Authorization', 'Bearer valid-token')
      .send({ assigneeUserId: 'user-2' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.assigneeUserId).toBe('user-2');
    expect(choresServiceMock.updateOccurrenceAssignee).toHaveBeenCalledWith(
      'user-1',
      occurrenceId,
      expect.objectContaining({ assigneeUserId: 'user-2' })
    );
  });

  it('PATCH /api/v1/chores/:occurrenceId/complete completes an occurrence', async () => {
    const occurrenceId = '550e8400-e29b-41d4-a716-446655440010';

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/chores/${occurrenceId}/complete`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('COMPLETED');
    expect(choresServiceMock.completeOccurrence).toHaveBeenCalledWith('user-1', occurrenceId);
  });

  it('GET /api/v1/groups/:groupId/chore-templates lists recurring templates', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/chore-templates`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.templates).toHaveLength(1);
    expect(choreTemplatesServiceMock.listGroupTemplates).toHaveBeenCalledWith('user-1', groupId);
  });

  it('POST /api/v1/groups/:groupId/chore-templates creates a recurring template', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chore-templates`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Take out trash',
        description: 'Kitchen bins',
        startsOn: '2026-03-09',
        repeatEveryDays: 7,
        assignmentStrategy: 'FIXED',
        assigneeUserId: 'user-2'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ACTIVE');
    expect(choreTemplatesServiceMock.createTemplate).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        title: 'Take out trash',
        startsOn: new Date('2026-03-09T00:00:00.000Z'),
        repeatEveryDays: 7,
        assignmentStrategy: 'FIXED',
        assigneeUserId: 'user-2'
      })
    );
  });

  it('POST /api/v1/groups/:groupId/chore-templates supports round-robin payloads', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chore-templates`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Bathroom reset',
        description: 'Rotate the weekly bathroom deep clean.',
        startsOn: '2026-03-09',
        repeatEveryDays: 7,
        assignmentStrategy: 'ROUND_ROBIN',
        participantUserIds: ['user-2', 'user-3']
      })
      .expect(201);

    expect(choreTemplatesServiceMock.createTemplate).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        title: 'Bathroom reset',
        startsOn: new Date('2026-03-09T00:00:00.000Z'),
        repeatEveryDays: 7,
        assignmentStrategy: 'ROUND_ROBIN',
        participantUserIds: ['user-2', 'user-3']
      })
    );
  });

  it('PATCH /api/v1/groups/:groupId/chore-templates/:templateId updates a recurring template', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const templateId = '550e8400-e29b-41d4-a716-446655440011';

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/chore-templates/${templateId}`)
      .set('Authorization', 'Bearer valid-token')
      .send({ title: 'Take out trash and recycling' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Take out trash and recycling');
    expect(choreTemplatesServiceMock.updateTemplate).toHaveBeenCalledWith(
      'user-1',
      groupId,
      templateId,
      expect.objectContaining({ title: 'Take out trash and recycling' })
    );
  });

  it('POST /api/v1/groups/:groupId/chore-templates/:templateId/pause pauses a recurring template', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const templateId = '550e8400-e29b-41d4-a716-446655440011';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chore-templates/${templateId}/pause`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('PAUSED');
    expect(choreTemplatesServiceMock.pauseTemplate).toHaveBeenCalledWith(
      'user-1',
      groupId,
      templateId
    );
  });

  it('POST /api/v1/groups/:groupId/chore-templates/:templateId/resume resumes a recurring template', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const templateId = '550e8400-e29b-41d4-a716-446655440011';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chore-templates/${templateId}/resume`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ACTIVE');
    expect(choreTemplatesServiceMock.resumeTemplate).toHaveBeenCalledWith(
      'user-1',
      groupId,
      templateId
    );
  });

  it('POST /api/v1/groups/:groupId/chore-templates/:templateId/archive archives a recurring template', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';
    const templateId = '550e8400-e29b-41d4-a716-446655440011';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/chore-templates/${templateId}/archive`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ARCHIVED');
    expect(choreTemplatesServiceMock.archiveTemplate).toHaveBeenCalledWith(
      'user-1',
      groupId,
      templateId
    );
  });
});
