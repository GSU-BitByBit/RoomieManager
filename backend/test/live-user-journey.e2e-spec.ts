import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';

const ENABLE_LIVE_TESTS = process.env.ENABLE_LIVE_SUPABASE_TESTS === 'true';

interface LiveSession {
  userId: string;
  token: string;
  email: string;
}

(ENABLE_LIVE_TESTS ? describe : describe.skip)('Live Supabase user journey (optional)', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

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

  afterAll(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  async function login(server: any, email: string, password: string): Promise<LiveSession | null> {
    const loginResponse = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password });

    if (!loginResponse.body?.success) {
      return null;
    }

    const token = loginResponse.body?.data?.session?.accessToken;
    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }

    const meResponse = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (!meResponse.body?.success || typeof meResponse.body?.data?.id !== 'string') {
      return null;
    }

    return {
      token,
      userId: meResponse.body.data.id,
      email
    };
  }

  it('exercises core authenticated flows with pagination and idempotency checks', async () => {
    const server = app!.getHttpServer();

    const primaryEmail = process.env.LIVE_TEST_EMAIL ?? 'roomiemanager.confirmed@gmail.com';
    const primaryPassword = process.env.LIVE_TEST_PASSWORD ?? 'StrongPass123!';
    const secondaryEmail = process.env.LIVE_MEMBER_EMAIL ?? 'roomiemanager.member@gmail.com';
    const secondaryPassword = process.env.LIVE_MEMBER_PASSWORD ?? primaryPassword;

    const primary = await login(server, primaryEmail, primaryPassword);
    if (!primary) {
      // Live environments may not have seeded/confirmed users available.
      // In that case, keep this suite non-blocking and exit early.
      return;
    }

    const uniqueSuffix = Date.now().toString(36);

    let secondary = await login(server, secondaryEmail, secondaryPassword);

    if (!secondary) {
      const registerEmail = `live.journey.${uniqueSuffix}@example.com`;
      const registerResponse = await request(server)
        .post('/api/v1/auth/register')
        .send({
          email: registerEmail,
          password: primaryPassword,
          fullName: `Live Journey ${uniqueSuffix}`
        });

      if (registerResponse.body?.success) {
        secondary = await login(server, registerEmail, primaryPassword);
      }
    }

    const secondaryUser = secondary && secondary.userId !== primary.userId ? secondary : null;
    const hasDistinctSecondary = secondaryUser !== null;

    const createGroup = await request(server)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${primary.token}`)
      .send({ name: `Live Journey ${uniqueSuffix}` })
      .expect(201);

    expect(createGroup.body.success).toBe(true);
    const groupId = createGroup.body.data.id as string;
    const joinCode = createGroup.body.data.joinCode as string;

    if (hasDistinctSecondary) {
      const joinGroup = await request(server)
        .post('/api/v1/groups/join')
        .set('Authorization', `Bearer ${secondaryUser.token}`)
        .send({ joinCode })
        .expect(200);

      expect(joinGroup.body.success).toBe(true);
      expect(joinGroup.body.data.id).toBe(groupId);
    }

    const requestId = `live-journey-${uniqueSuffix}`;
    const members = await request(server)
      .get(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${primary.token}`)
      .set('x-request-id', requestId)
      .query({ page: 1, pageSize: 10, sortBy: 'joinedAt', sortOrder: 'asc' })
      .expect(200);

    expect(members.body.success).toBe(true);
    expect(members.body.meta.requestId).toBe(requestId);
    expect(members.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        totalItems: expect.any(Number),
        totalPages: expect.any(Number)
      })
    );

    const memberIds = (members.body.data.members as Array<{ userId: string }>).map((m) => m.userId);
    expect(memberIds).toContain(primary.userId);
    if (secondaryUser) {
      expect(memberIds).toContain(secondaryUser.userId);
    }

    const createChorePayload = {
      title: `Trash ${uniqueSuffix}`,
      dueOn: '2026-04-06',
      assigneeUserId: secondaryUser ? secondaryUser.userId : primary.userId
    };

    const createChore = await request(server)
      .post(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', `Bearer ${primary.token}`)
      .send(createChorePayload)
      .expect(201);

    expect(createChore.body.success).toBe(true);
    const choreId = createChore.body.data.id as string;

    const choreReaderToken = secondaryUser ? secondaryUser.token : primary.token;
    const assigneeUserId = secondaryUser ? secondaryUser.userId : primary.userId;

    const listChores = await request(server)
      .get(`/api/v1/groups/${groupId}/chores`)
      .set('Authorization', `Bearer ${choreReaderToken}`)
      .query({ status: 'PENDING', assigneeUserId, page: 1, pageSize: 5 })
      .expect(200);

    expect(listChores.body.success).toBe(true);
    expect(listChores.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 5,
        totalItems: expect.any(Number)
      })
    );

    const completeChore = await request(server)
      .patch(`/api/v1/chores/${choreId}/complete`)
      .set('Authorization', `Bearer ${choreReaderToken}`)
      .expect(200);
    expect(completeChore.body.success).toBe(true);
    expect(completeChore.body.data.status).toBe('COMPLETED');

    const draftContent = `Live contract ${uniqueSuffix}`;
    const updateContract = await request(server)
      .put(`/api/v1/groups/${groupId}/contract`)
      .set('Authorization', `Bearer ${primary.token}`)
      .send({ content: draftContent })
      .expect(200);
    expect(updateContract.body.success).toBe(true);

    const publishContract = await request(server)
      .post(`/api/v1/groups/${groupId}/contract/publish`)
      .set('Authorization', `Bearer ${primary.token}`)
      .expect(201);
    expect(publishContract.body.success).toBe(true);

    const versions = await request(server)
      .get(`/api/v1/groups/${groupId}/contract/versions`)
      .set('Authorization', `Bearer ${primary.token}`)
      .query({ page: 1, pageSize: 1, sortBy: 'version', sortOrder: 'desc' })
      .expect(200);

    expect(versions.body.success).toBe(true);
    expect(versions.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1,
        totalItems: expect.any(Number)
      })
    );
    expect((versions.body.data.versions as Array<{ content: string }>)[0].content).toBe(
      draftContent
    );

    const createBillPayload: {
      title: string;
      totalAmount: number;
      paidByUserId: string;
      splits: Array<{ userId: string; amount: number }>;
    } = secondaryUser
      ? {
          title: `Internet ${uniqueSuffix}`,
          totalAmount: 100,
          paidByUserId: primary.userId,
          splits: [
            { userId: primary.userId, amount: 40 },
            { userId: secondaryUser.userId, amount: 60 }
          ]
        }
      : {
          title: `Internet ${uniqueSuffix}`,
          totalAmount: 100,
          paidByUserId: primary.userId,
          splits: [{ userId: primary.userId, amount: 100 }]
        };

    const createBill = await request(server)
      .post(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', `Bearer ${primary.token}`)
      .send(createBillPayload)
      .expect(201);

    expect(createBill.body.success).toBe(true);
    const billId = createBill.body.data.id as string;

    if (secondaryUser) {
      const paymentKey = `pay-${uniqueSuffix}`;
      const paymentPayload = {
        payerUserId: secondaryUser.userId,
        payeeUserId: primary.userId,
        amount: 60,
        billId,
        idempotencyKey: paymentKey
      };

      const payment = await request(server)
        .post(`/api/v1/groups/${groupId}/payments`)
        .set('Authorization', `Bearer ${secondaryUser.token}`)
        .send(paymentPayload)
        .expect(201);

      expect(payment.body.success).toBe(true);

      const paymentReplay = await request(server)
        .post(`/api/v1/groups/${groupId}/payments`)
        .set('Authorization', `Bearer ${secondaryUser.token}`)
        .send(paymentPayload)
        .expect(201);

      expect(paymentReplay.body.success).toBe(true);
      expect(paymentReplay.body.data.id).toBe(payment.body.data.id);
    }

    const bills = await request(server)
      .get(`/api/v1/groups/${groupId}/bills`)
      .set('Authorization', `Bearer ${primary.token}`)
      .query({ page: 1, pageSize: 5, sortBy: 'incurredAt', sortOrder: 'desc' })
      .expect(200);

    expect(bills.body.success).toBe(true);
    expect(bills.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 5,
        totalItems: expect.any(Number)
      })
    );
    expect(
      (bills.body.data.bills as Array<{ id: string }>).some((bill) => bill.id === billId)
    ).toBe(true);

    const balances = await request(server)
      .get(`/api/v1/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${primary.token}`)
      .expect(200);

    expect(balances.body.success).toBe(true);
    expect(Array.isArray(balances.body.data.balances)).toBe(true);
  });
});
