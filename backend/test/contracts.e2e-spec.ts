import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';

describe('Contracts endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const contractsServiceMock = {
    getContract: jest.fn(async () => ({
      contract: {
        id: 'contract-1',
        groupId: 'group-1',
        draftContent: 'Draft content here.',
        publishedVersion: 1,
        updatedBy: 'user-1',
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z'
      },
      latestPublishedContent: 'Published content v1.'
    })),
    updateDraft: jest.fn(async () => ({
      id: 'contract-1',
      groupId: 'group-1',
      draftContent: 'Updated draft.',
      publishedVersion: 1,
      updatedBy: 'user-1',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T01:00:00.000Z'
    })),
    publishVersion: jest.fn(async () => ({
      id: 'cv-2',
      version: 2,
      content: 'Updated draft.',
      publishedBy: 'user-1',
      createdAt: '2026-03-05T01:00:00.000Z'
    })),
    listVersions: jest.fn(async () => ({
      groupId: 'group-1',
      versions: [
        {
          id: 'cv-2',
          version: 2,
          content: 'Updated draft.',
          publishedBy: 'user-1',
          createdAt: '2026-03-05T01:00:00.000Z'
        },
        {
          id: 'cv-1',
          version: 1,
          content: 'Published content v1.',
          publishedBy: 'user-1',
          createdAt: '2026-03-05T00:00:00.000Z'
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
      .overrideProvider(ContractsService)
      .useValue(contractsServiceMock)
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

  it('GET /api/v1/groups/:groupId/contract requires auth', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/contract`)
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/groups/:groupId/contract returns contract detail', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/contract`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.contract.draftContent).toBe('Draft content here.');
    expect(response.body.data.latestPublishedContent).toBe('Published content v1.');
    expect(contractsServiceMock.getContract).toHaveBeenCalledWith('user-1', groupId);
  });

  it('PUT /api/v1/groups/:groupId/contract requires auth', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .put(`/api/v1/groups/${groupId}/contract`)
      .send({ content: 'Updated draft.' })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('PUT /api/v1/groups/:groupId/contract updates draft', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .put(`/api/v1/groups/${groupId}/contract`)
      .set('Authorization', 'Bearer valid-token')
      .send({ content: 'Updated draft.' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.draftContent).toBe('Updated draft.');
    expect(contractsServiceMock.updateDraft).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({ content: 'Updated draft.' })
    );
  });

  it('PUT /api/v1/groups/:groupId/contract rejects missing content', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .put(`/api/v1/groups/${groupId}/contract`)
      .set('Authorization', 'Bearer valid-token')
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('POST /api/v1/groups/:groupId/contract/publish requires auth', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/contract/publish`)
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/groups/:groupId/contract/publish publishes version', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/contract/publish`)
      .set('Authorization', 'Bearer valid-token')
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.version).toBe(2);
    expect(contractsServiceMock.publishVersion).toHaveBeenCalledWith('user-1', groupId);
  });

  it('GET /api/v1/groups/:groupId/contract/versions lists versions', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/contract/versions`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.versions).toHaveLength(2);
    expect(response.body.data.versions[0].version).toBe(2);
    expect(response.body.data.pagination.page).toBe(1);
    expect(contractsServiceMock.listVersions).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        sortBy: 'version',
        sortOrder: 'desc'
      })
    );
  });

  it('GET /api/v1/groups/:groupId/contract/versions rejects invalid sortBy', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/contract/versions`)
      .set('Authorization', 'Bearer valid-token')
      .query({ sortBy: 'status' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(contractsServiceMock.listVersions).not.toHaveBeenCalled();
  });

  it('rejects non-UUID groupId', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups/not-a-uuid/contract')
      .set('Authorization', 'Bearer valid-token')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
  });
});
