import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';
import { ChoresService } from '../src/modules/chores/chores.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { FinanceService } from '../src/modules/finance/finance.service';
import { GroupsService } from '../src/modules/groups/groups.service';
import { HealthService } from '../src/modules/health/health.service';
import { assertErrorEnvelope, assertSuccessEnvelope } from './common/http/envelope.assertions';

describe('Response envelope contracts (e2e)', () => {
  let app: INestApplication | undefined;

  const groupId = '550e8400-e29b-41d4-a716-446655440000';

  const healthServiceMock = {
    getLiveness: jest.fn(async () => ({
      service: 'roomiemanager-backend',
      version: '0.1.0',
      timestamp: '2026-03-05T00:00:00.000Z'
    }))
  };

  const authServiceMock = {
    login: jest.fn(async () => ({
      user: {
        id: 'user-1',
        email: 'alex@example.com'
      },
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer'
      }
    }))
  };

  const groupsServiceMock = {
    listUserGroups: jest.fn(async () => ({
      groups: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })),
    getGroupDashboard: jest.fn(async () => ({
      group: {
        id: groupId,
        name: 'Apartment 12A',
        createdBy: 'user-1',
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        memberRole: 'ADMIN',
        memberStatus: 'ACTIVE',
        memberCount: 1,
        joinCode: 'ABCD1234'
      },
      members: {
        totalActive: 1,
        adminCount: 1,
        memberCount: 0
      },
      chores: {
        pendingCount: 0,
        completedCount: 0,
        overdueCount: 0,
        assignedToMePendingCount: 0
      },
      finance: {
        billCount: 0,
        paymentCount: 0,
        latestBillIncurredAt: null,
        latestPaymentPaidAt: null
      },
      contract: {
        hasDraft: false,
        publishedVersion: null,
        updatedAt: null
      }
    }))
  };

  const choresServiceMock = {
    listGroupChores: jest.fn(async () => ({
      groupId,
      chores: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    }))
  };

  const contractsServiceMock = {
    getContract: jest.fn(async () => ({
      contract: {
        id: '',
        groupId,
        draftContent: '',
        publishedVersion: null,
        updatedBy: null,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z'
      },
      latestPublishedContent: null
    }))
  };

  const financeServiceMock = {
    getBalances: jest.fn(async () => ({
      groupId,
      currencies: [],
      settlements: []
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
      .overrideProvider(HealthService)
      .useValue(healthServiceMock)
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(GroupsService)
      .useValue(groupsServiceMock)
      .overrideProvider(ChoresService)
      .useValue(choresServiceMock)
      .overrideProvider(ContractsService)
      .useValue(contractsServiceMock)
      .overrideProvider(FinanceService)
      .useValue(financeServiceMock)
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

  it('wraps success envelope for GET /api/v1/health/live', async () => {
    const response = await request(app!.getHttpServer()).get('/api/v1/health/live').expect(200);

    assertSuccessEnvelope(response.body);
  });

  it('wraps success envelope for POST /api/v1/auth/login', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alex@example.com', password: 'StrongPass123!' })
      .expect(200);

    assertSuccessEnvelope(response.body);
  });

  it('wraps success envelope for GET /api/v1/groups', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    assertSuccessEnvelope(response.body);
  });

  it('wraps success envelope for GET /api/v1/groups/:groupId/dashboard', async () => {
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/dashboard`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    assertSuccessEnvelope(response.body);
  });

  it('wraps success envelope for GET /api/v1/groups/:groupId/chores', async () => {
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    assertSuccessEnvelope(response.body);
  });

  it('wraps success envelope for GET /api/v1/groups/:groupId/contract', async () => {
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/contract`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    assertSuccessEnvelope(response.body);
  });

  it('wraps success envelope for GET /api/v1/groups/:groupId/balances', async () => {
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/balances`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    assertSuccessEnvelope(response.body);
  });

  it('wraps error envelope for missing auth on protected routes', async () => {
    const response = await request(app!.getHttpServer()).get('/api/v1/groups').expect(401);

    assertErrorEnvelope(response.body, 'UNAUTHORIZED');
  });

  it('wraps error envelope for unknown routes', async () => {
    const response = await request(app!.getHttpServer()).get('/api/v1/does-not-exist').expect(404);

    assertErrorEnvelope(response.body, 'NOT_FOUND');
  });
});
