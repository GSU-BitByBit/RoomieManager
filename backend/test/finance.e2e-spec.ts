import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';
import { FinanceService } from '../src/modules/finance/finance.service';

describe('Finance endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const financeServiceMock = {
    createBill: jest.fn(async () => ({
      id: 'bill-1',
      groupId: 'group-1',
      title: 'Internet bill - March',
      description: 'Monthly ISP payment',
      totalAmount: 76.5,
      currency: 'USD',
      paidByUserId: 'user-1',
      splitMethod: 'CUSTOM',
      createdBy: 'user-1',
      incurredAt: '2026-03-05T00:00:00.000Z',
      dueDate: null,
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
      splits: [
        {
          id: 'split-1',
          userId: 'user-1',
          amount: 25.5,
          createdAt: '2026-03-05T00:00:00.000Z'
        },
        {
          id: 'split-2',
          userId: 'user-2',
          amount: 51,
          createdAt: '2026-03-05T00:00:00.000Z'
        }
      ]
    })),
    listBills: jest.fn(async () => ({
      groupId: 'group-1',
      bills: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })),
    createPayment: jest.fn(async () => ({
      id: 'payment-1',
      groupId: 'group-1',
      billId: 'bill-1',
      payerUserId: 'user-2',
      payeeUserId: 'user-1',
      amount: 20,
      currency: 'USD',
      note: 'Paid via Zelle',
      idempotencyKey: 'pay-1',
      paidAt: '2026-03-05T00:10:00.000Z',
      createdBy: 'user-2',
      createdAt: '2026-03-05T00:10:00.000Z',
      updatedAt: '2026-03-05T00:10:00.000Z'
    })),
    getBalances: jest.fn(async () => ({
      groupId: 'group-1',
      balances: [
        {
          currency: 'USD',
          settlements: [
            {
              fromUserId: 'user-2',
              toUserId: 'user-1',
              amount: 31
            }
          ],
          memberBalances: [
            {
              userId: 'user-1',
              netAmount: 31
            },
            {
              userId: 'user-2',
              netAmount: -31
            }
          ]
        }
      ]
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

  it('POST /api/v1/groups/:groupId/bills requires auth', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/bills`)
      .send({
        title: 'Internet bill - March',
        totalAmount: 76.5,
        paidByUserId: 'user-1',
        splits: [{ userId: 'user-1', amount: 76.5 }]
      })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/groups/:groupId/bills creates bill', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Internet bill - March',
        totalAmount: 76.5,
        paidByUserId: 'user-1',
        splits: [
          { userId: 'user-1', amount: 25.5 },
          { userId: 'user-2', amount: 51 }
        ]
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Internet bill - March');
    expect(financeServiceMock.createBill).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        title: 'Internet bill - March'
      })
    );
  });

  it('GET /api/v1/groups/:groupId/bills lists bills', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination.page).toBe(1);
    expect(financeServiceMock.listBills).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        sortBy: 'incurredAt',
        sortOrder: 'desc'
      })
    );
  });

  it('GET /api/v1/groups/:groupId/bills rejects pageSize above max', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', 'Bearer valid-token')
      .query({ pageSize: 101 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(financeServiceMock.listBills).not.toHaveBeenCalled();
  });

  it('POST /api/v1/groups/:groupId/payments records payment', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        payerUserId: 'user-2',
        payeeUserId: 'user-1',
        amount: 20,
        billId: 'bill-1',
        idempotencyKey: 'pay-1'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.amount).toBe(20);
    expect(financeServiceMock.createPayment).toHaveBeenCalledWith(
      'user-1',
      groupId,
      expect.objectContaining({
        payerUserId: 'user-2',
        payeeUserId: 'user-1',
        amount: 20,
        billId: 'bill-1',
        idempotencyKey: 'pay-1'
      })
    );
  });

  it('GET /api/v1/groups/:groupId/balances returns balances', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/balances`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.balances).toHaveLength(1);
    expect(response.body.data.balances[0].currency).toBe('USD');
    expect(financeServiceMock.getBalances).toHaveBeenCalledWith('user-1', groupId);
  });

  it('rejects non-UUID groupId', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups/not-a-uuid/balances')
      .set('Authorization', 'Bearer valid-token')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(financeServiceMock.getBalances).not.toHaveBeenCalled();
  });
});
