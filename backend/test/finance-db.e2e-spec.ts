import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';

interface TestSession {
  id: string;
  email: string;
  token: string;
}

interface GroupContext {
  groupId: string;
  joinCode: string;
}

const TEST_USERS = {
  admin: {
    id: '550e8400-e29b-41d4-a716-446655440101',
    email: 'finance.admin@example.com',
    token: 'finance-admin-token'
  },
  memberOne: {
    id: '550e8400-e29b-41d4-a716-446655440102',
    email: 'finance.member1@example.com',
    token: 'finance-member-1-token'
  },
  memberTwo: {
    id: '550e8400-e29b-41d4-a716-446655440103',
    email: 'finance.member2@example.com',
    token: 'finance-member-2-token'
  },
  memberThree: {
    id: '550e8400-e29b-41d4-a716-446655440104',
    email: 'finance.member3@example.com',
    token: 'finance-member-3-token'
  }
} satisfies Record<string, TestSession>;

describe('Finance DB-backed integrity (e2e)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  const createdGroupIds = new Set<string>();

  beforeAll(async () => {
    const tokenMap = new Map(
      Object.values(TEST_USERS).map((session) => [
        session.token,
        {
          id: session.id,
          email: session.email,
          role: 'authenticated',
          aud: 'authenticated'
        }
      ])
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(SupabaseJwtService)
      .useValue({
        verifyAccessToken: jest.fn(async (token: string) => {
          const session = tokenMap.get(token);
          if (!session) {
            throw new UnauthorizedException('Invalid or expired access token.');
          }

          return session;
        })
      })
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
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    if (createdGroupIds.size > 0) {
      await prisma.group.deleteMany({
        where: {
          id: {
            in: Array.from(createdGroupIds)
          }
        }
      });
      createdGroupIds.clear();
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('creates custom-split bills, isolates currencies, and treats bill-linked payments as reference-only metadata', async () => {
    const { groupId } = await createGroupWithMembers([TEST_USERS.memberOne, TEST_USERS.memberTwo]);

    const usdBill = await createBill(groupId, TEST_USERS.admin, {
      title: 'Utilities',
      totalAmount: 100,
      currency: 'USD',
      paidByUserId: TEST_USERS.admin.id,
      splits: [
        { userId: TEST_USERS.admin.id, amount: 20 },
        { userId: TEST_USERS.memberOne.id, amount: 30 },
        { userId: TEST_USERS.memberTwo.id, amount: 50 }
      ],
      incurredAt: '2026-04-01T00:00:00.000Z'
    });

    await createBill(groupId, TEST_USERS.memberOne, {
      title: 'Cleaning Supplies',
      totalAmount: 60,
      currency: 'EUR',
      paidByUserId: TEST_USERS.memberOne.id,
      splits: [
        { userId: TEST_USERS.admin.id, amount: 10 },
        { userId: TEST_USERS.memberOne.id, amount: 30 },
        { userId: TEST_USERS.memberTwo.id, amount: 20 }
      ],
      incurredAt: '2026-04-02T00:00:00.000Z'
    });

    const storedUsdBill = await prisma.bill.findUnique({
      where: { id: usdBill.id },
      include: {
        splits: {
          orderBy: { userId: 'asc' }
        }
      }
    });

    expect(storedUsdBill).not.toBeNull();
    expect(storedUsdBill?.splitMethod).toBe('CUSTOM');
    expect(
      storedUsdBill?.splits.map((split) => ({
        userId: split.userId,
        amount: Number(split.amount.toString())
      }))
    ).toEqual([
      { userId: TEST_USERS.admin.id, amount: 20 },
      { userId: TEST_USERS.memberOne.id, amount: 30 },
      { userId: TEST_USERS.memberTwo.id, amount: 50 }
    ]);

    const payment = await createPayment(groupId, TEST_USERS.memberTwo, {
      payerUserId: TEST_USERS.memberTwo.id,
      payeeUserId: TEST_USERS.admin.id,
      amount: 20,
      currency: 'USD',
      billId: usdBill.id,
      note: 'Partial reimbursement',
      paidAt: '2026-04-03T00:00:00.000Z'
    });

    expect(payment.billId).toBe(usdBill.id);

    const balances = await getBalances(groupId, TEST_USERS.admin);
    const usd = getCurrencyBalance(balances, 'USD');
    const eur = getCurrencyBalance(balances, 'EUR');

    expect(toMemberBalanceMap(usd.memberBalances)).toEqual({
      [TEST_USERS.admin.id]: 60,
      [TEST_USERS.memberOne.id]: -30,
      [TEST_USERS.memberTwo.id]: -30
    });
    expect(usd.settlements).toEqual(
      expect.arrayContaining([
        { fromUserId: TEST_USERS.memberOne.id, toUserId: TEST_USERS.admin.id, amount: 30 },
        { fromUserId: TEST_USERS.memberTwo.id, toUserId: TEST_USERS.admin.id, amount: 30 }
      ])
    );

    expect(toMemberBalanceMap(eur.memberBalances)).toEqual({
      [TEST_USERS.admin.id]: -10,
      [TEST_USERS.memberOne.id]: 30,
      [TEST_USERS.memberTwo.id]: -20
    });
    expect(eur.settlements).toEqual(
      expect.arrayContaining([
        { fromUserId: TEST_USERS.admin.id, toUserId: TEST_USERS.memberOne.id, amount: 10 },
        { fromUserId: TEST_USERS.memberTwo.id, toUserId: TEST_USERS.memberOne.id, amount: 20 }
      ])
    );
  });

  it('blocks member removal on non-zero balances and allows removal after settlement', async () => {
    const { groupId } = await createGroupWithMembers([TEST_USERS.memberOne]);

    await createBill(groupId, TEST_USERS.admin, {
      title: 'Internet',
      totalAmount: 50,
      currency: 'USD',
      paidByUserId: TEST_USERS.admin.id,
      splits: [{ userId: TEST_USERS.memberOne.id, amount: 50 }],
      incurredAt: '2026-04-04T00:00:00.000Z'
    });

    const blockedRemoval = await request(app!.getHttpServer())
      .delete(`/api/v1/groups/${groupId}/members/${TEST_USERS.memberOne.id}`)
      .set('Authorization', `Bearer ${TEST_USERS.admin.token}`)
      .expect(409);

    expect(blockedRemoval.body.success).toBe(false);
    expect(blockedRemoval.body.error.code).toBe('CONFLICT');
    expect(blockedRemoval.body.error.details).toEqual(
      expect.objectContaining({
        financeBalances: [{ currency: 'USD', netAmount: -50 }]
      })
    );

    await createPayment(groupId, TEST_USERS.memberOne, {
      payerUserId: TEST_USERS.memberOne.id,
      payeeUserId: TEST_USERS.admin.id,
      amount: 50,
      currency: 'USD',
      paidAt: '2026-04-05T00:00:00.000Z'
    });

    const allowedRemoval = await request(app!.getHttpServer())
      .delete(`/api/v1/groups/${groupId}/members/${TEST_USERS.memberOne.id}`)
      .set('Authorization', `Bearer ${TEST_USERS.admin.token}`)
      .expect(200);

    expect(allowedRemoval.body.success).toBe(true);
    expect(allowedRemoval.body.data.removed).toBe(true);

    const balances = await getBalances(groupId, TEST_USERS.admin);
    const usd = getCurrencyBalance(balances, 'USD');

    expect(usd.memberBalances.map((balance) => balance.userId)).not.toContain(
      TEST_USERS.memberOne.id
    );
    expect(usd.settlements).toHaveLength(0);
  });

  it('enforces that only the payer or an admin may record payments', async () => {
    const { groupId } = await createGroupWithMembers([
      TEST_USERS.memberOne,
      TEST_USERS.memberTwo,
      TEST_USERS.memberThree
    ]);

    const forbiddenResponse = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('Authorization', `Bearer ${TEST_USERS.memberOne.token}`)
      .send({
        payerUserId: TEST_USERS.memberTwo.id,
        payeeUserId: TEST_USERS.admin.id,
        amount: 15,
        currency: 'USD',
        paidAt: '2026-04-06T00:00:00.000Z'
      })
      .expect(403);

    expect(forbiddenResponse.body.error.code).toBe('FORBIDDEN');
    expect(forbiddenResponse.body.error.message).toBe(
      'Only the payer or a group admin can record this payment.'
    );

    const adminCreatedPayment = await createPayment(groupId, TEST_USERS.admin, {
      payerUserId: TEST_USERS.memberTwo.id,
      payeeUserId: TEST_USERS.admin.id,
      amount: 15,
      currency: 'USD',
      paidAt: '2026-04-06T00:00:00.000Z'
    });

    const storedPayment = await prisma.payment.findUnique({
      where: { id: adminCreatedPayment.id }
    });

    expect(storedPayment?.createdBy).toBe(TEST_USERS.admin.id);
  });

  it('supports safe idempotent replay and conflicts on payload mismatch', async () => {
    const { groupId } = await createGroupWithMembers([TEST_USERS.memberOne]);
    const idempotencyKey = `finance-replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      payerUserId: TEST_USERS.memberOne.id,
      payeeUserId: TEST_USERS.admin.id,
      amount: 12.5,
      currency: 'USD',
      note: 'April reimbursement',
      paidAt: '2026-04-07T00:00:00.000Z',
      idempotencyKey
    };

    const firstPayment = await createPayment(groupId, TEST_USERS.memberOne, payload);
    const replayPayment = await createPayment(groupId, TEST_USERS.memberOne, payload);

    expect(replayPayment.id).toBe(firstPayment.id);

    const [paymentCount, paymentLedgerCount] = await Promise.all([
      prisma.payment.count({ where: { groupId, idempotencyKey } }),
      prisma.ledgerEntry.count({
        where: {
          groupId,
          paymentId: firstPayment.id
        }
      })
    ]);

    expect(paymentCount).toBe(1);
    expect(paymentLedgerCount).toBe(1);

    const conflictResponse = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('Authorization', `Bearer ${TEST_USERS.memberOne.token}`)
      .send({
        ...payload,
        note: 'Changed note'
      })
      .expect(409);

    expect(conflictResponse.body.error.code).toBe('CONFLICT');
    expect(conflictResponse.body.error.message).toBe(
      'This idempotency key has already been used for a different payment payload.'
    );
    expect(conflictResponse.body.error.details).toEqual(
      expect.objectContaining({
        idempotencyKey,
        existingPaymentId: firstPayment.id
      })
    );
  });

  it('rejects actionable balances when a legacy inactive member still has a non-zero balance', async () => {
    const { groupId } = await createGroupWithMembers([TEST_USERS.memberOne]);

    await createBill(groupId, TEST_USERS.admin, {
      title: 'Streaming Service',
      totalAmount: 25,
      currency: 'USD',
      paidByUserId: TEST_USERS.admin.id,
      splits: [{ userId: TEST_USERS.memberOne.id, amount: 25 }],
      incurredAt: '2026-04-08T00:00:00.000Z'
    });

    await prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: TEST_USERS.memberOne.id
        }
      },
      data: {
        status: 'INACTIVE'
      }
    });

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${TEST_USERS.admin.token}`)
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toContain('inactive members still have non-zero balances');
    expect(response.body.error.details).toEqual(
      expect.objectContaining({
        inactiveMemberBalances: [
          {
            userId: TEST_USERS.memberOne.id,
            currency: 'USD',
            netAmount: -25
          }
        ]
      })
    );
  });

  async function createGroupWithMembers(members: TestSession[]): Promise<GroupContext> {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${TEST_USERS.admin.token}`)
      .send({
        name: `Finance Integrity ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      })
      .expect(201);

    const groupId = response.body.data.id as string;
    const joinCode = response.body.data.joinCode as string;
    createdGroupIds.add(groupId);

    for (const member of members) {
      await request(app!.getHttpServer())
        .post('/api/v1/groups/join')
        .set('Authorization', `Bearer ${member.token}`)
        .send({ joinCode })
        .expect(200);
    }

    return { groupId, joinCode };
  }

  async function createBill(
    groupId: string,
    actor: TestSession,
    payload: Record<string, unknown>
  ): Promise<{ id: string }> {
    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    return response.body.data as { id: string };
  }

  async function createPayment(
    groupId: string,
    actor: TestSession,
    payload: Record<string, unknown>
  ): Promise<{
    id: string;
    billId: string | null;
  }> {
    const response = await request(app!.getHttpServer())
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    return response.body.data as { id: string; billId: string | null };
  }

  async function getBalances(
    groupId: string,
    actor: TestSession
  ): Promise<{
    balances: Array<{
      currency: string;
      settlements: Array<{ fromUserId: string; toUserId: string; amount: number }>;
      memberBalances: Array<{ userId: string; netAmount: number }>;
    }>;
  }> {
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    return response.body.data;
  }

  function getCurrencyBalance(
    balancesResponse: {
      balances: Array<{
        currency: string;
        settlements: Array<{ fromUserId: string; toUserId: string; amount: number }>;
        memberBalances: Array<{ userId: string; netAmount: number }>;
      }>;
    },
    currency: string
  ) {
    const balance = balancesResponse.balances.find((entry) => entry.currency === currency);
    expect(balance).toBeDefined();
    return balance!;
  }

  function toMemberBalanceMap(memberBalances: Array<{ userId: string; netAmount: number }>) {
    return Object.fromEntries(memberBalances.map((balance) => [balance.userId, balance.netAmount]));
  }
});
