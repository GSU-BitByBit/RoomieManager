import {
  ConflictException,
  ForbiddenException,
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
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';
import { FinanceService } from '../src/modules/finance/finance.service';

describe('Finance endpoints (e2e)', () => {
  let app: INestApplication | undefined;
  const USER_ONE = '550e8400-e29b-41d4-a716-446655440001';
  const USER_TWO = '550e8400-e29b-41d4-a716-446655440002';
  const USER_THREE = '550e8400-e29b-41d4-a716-446655440003';
  const ADMIN_USER = '550e8400-e29b-41d4-a716-446655440099';
  const BILL_ID = '550e8400-e29b-41d4-a716-446655440555';

  const financeServiceMock = {
    createBill: jest.fn(async () => ({
      id: 'bill-1',
      groupId: 'group-1',
      title: 'Internet bill - March',
      description: 'Monthly ISP payment',
      totalAmount: 76.5,
      currency: 'USD',
      paidByUserId: USER_ONE,
      splitMethod: 'CUSTOM',
      createdBy: USER_ONE,
      incurredAt: '2026-03-05T00:00:00.000Z',
      dueDate: null,
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
      splits: [
        {
          id: 'split-1',
          userId: USER_ONE,
          amount: 25.5,
          createdAt: '2026-03-05T00:00:00.000Z'
        },
        {
          id: 'split-2',
          userId: USER_TWO,
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
      billId: BILL_ID,
      payerUserId: USER_TWO,
      payeeUserId: USER_ONE,
      amount: 20,
      currency: 'USD',
      note: 'Paid via Zelle',
      idempotencyKey: 'pay-1',
      paidAt: '2026-03-05T00:10:00.000Z',
      createdBy: USER_TWO,
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
              fromUserId: USER_TWO,
              toUserId: USER_ONE,
              amount: 31
            }
          ],
          memberBalances: [
            {
              userId: USER_ONE,
              netAmount: 31
            },
            {
              userId: USER_TWO,
              netAmount: -31
            }
          ]
        }
      ]
    }))
  };

  const jwtServiceMock = {
    verifyAccessToken: jest.fn(async (token: string) => {
      if (token === 'valid-token') {
        return {
          id: USER_ONE,
          email: 'alex@example.com',
          role: 'authenticated',
          aud: 'authenticated'
        };
      }

      if (token === 'payer-token') {
        return {
          id: USER_TWO,
          email: 'morgan@example.com',
          role: 'authenticated',
          aud: 'authenticated'
        };
      }

      if (token === 'admin-token') {
        return {
          id: ADMIN_USER,
          email: 'avery@example.com',
          role: 'authenticated',
          aud: 'authenticated'
        };
      }

      if (token !== 'valid-token') {
        throw new UnauthorizedException('Invalid or expired access token.');
      }
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
        paidByUserId: USER_ONE,
        splits: [{ userId: USER_ONE, amount: 76.5 }]
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
        paidByUserId: USER_ONE,
        splits: [
          { userId: USER_ONE, amount: 25.5 },
          { userId: USER_TWO, amount: 51 }
        ]
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Internet bill - March');
    expect(financeServiceMock.createBill).toHaveBeenCalledWith(
      USER_ONE,
      groupId,
      expect.objectContaining({
        title: 'Internet bill - March'
      })
    );
  });

  it('POST /api/v1/groups/:groupId/bills rejects non-UUID member ids', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Internet bill - March',
        totalAmount: 76.5,
        paidByUserId: 'not-a-uuid',
        splits: [{ userId: USER_ONE, amount: 76.5 }]
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(financeServiceMock.createBill).not.toHaveBeenCalled();
  });

  it('POST /api/v1/groups/:groupId/bills rejects duplicate split member ids', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Internet bill - March',
        totalAmount: 76.5,
        paidByUserId: USER_ONE,
        splits: [
          { userId: USER_ONE, amount: 25.5 },
          { userId: USER_ONE, amount: 51 }
        ]
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(financeServiceMock.createBill).not.toHaveBeenCalled();
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
      USER_ONE,
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
      .set('Authorization', 'Bearer payer-token')
      .send({
        payerUserId: USER_TWO,
        payeeUserId: USER_ONE,
        amount: 20,
        billId: BILL_ID,
        idempotencyKey: 'pay-1'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.amount).toBe(20);
    expect(financeServiceMock.createPayment).toHaveBeenCalledWith(
      USER_TWO,
      groupId,
      expect.objectContaining({
        payerUserId: USER_TWO,
        payeeUserId: USER_ONE,
        amount: 20,
        billId: BILL_ID,
        idempotencyKey: 'pay-1'
      })
    );
  });

  it('POST /api/v1/groups/:groupId/payments rejects non-UUID member ids', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('Authorization', 'Bearer payer-token')
      .send({
        payerUserId: 'not-a-uuid',
        payeeUserId: USER_ONE,
        amount: 20
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(financeServiceMock.createPayment).not.toHaveBeenCalled();
  });

  it('POST /api/v1/groups/:groupId/payments rejects non-admin third-party payment creation', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    financeServiceMock.createPayment.mockRejectedValueOnce(
      new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the payer or a group admin can record this payment.'
      })
    );

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        payerUserId: USER_TWO,
        payeeUserId: USER_THREE,
        amount: 20
      })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toBe(
      'Only the payer or a group admin can record this payment.'
    );
    expect(financeServiceMock.createPayment).toHaveBeenCalledWith(
      USER_ONE,
      groupId,
      expect.objectContaining({
        payerUserId: USER_TWO,
        payeeUserId: USER_THREE,
        amount: 20
      })
    );
  });

  it('POST /api/v1/groups/:groupId/payments surfaces idempotency conflicts explicitly', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440000';

    financeServiceMock.createPayment.mockRejectedValueOnce(
      new ConflictException({
        code: 'CONFLICT',
        message: 'This idempotency key has already been used for a different payment payload.',
        details: {
          idempotencyKey: 'pay-1',
          existingPaymentId: 'payment-1'
        }
      })
    );

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('Authorization', 'Bearer payer-token')
      .send({
        payerUserId: USER_TWO,
        payeeUserId: USER_ONE,
        amount: 20,
        idempotencyKey: 'pay-1'
      })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe(
      'This idempotency key has already been used for a different payment payload.'
    );
    expect(response.body.error.details).toEqual({
      idempotencyKey: 'pay-1',
      existingPaymentId: 'payment-1'
    });
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
    expect(financeServiceMock.getBalances).toHaveBeenCalledWith(USER_ONE, groupId);
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
