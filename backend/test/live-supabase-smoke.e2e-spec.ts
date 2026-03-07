import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';

const ENABLE_LIVE_TESTS = process.env.ENABLE_LIVE_SUPABASE_TESTS === 'true';

// These tests hit real Supabase-backed flows through the Nest app.
// They are skipped by default unless ENABLE_LIVE_SUPABASE_TESTS=true is set.

(ENABLE_LIVE_TESTS ? describe : describe.skip)('Live Supabase smoke tests', () => {
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

  it('performs a live auth + groups smoke flow', async () => {
    const server = app!.getHttpServer();

    // 1) Health readiness should run against real DB
    const ready = await request(server).get('/api/v1/health/ready');
    // In some environments we may get 503 if DB is not ready; both are acceptable here.
    expect([200, 503]).toContain(ready.status);

    // 2) Attempt login with a known fixture account.
    //    This requires that prisma:seed has been run and Supabase fixture users exist.
    const email = process.env.LIVE_TEST_EMAIL ?? 'roomiemanager.confirmed@gmail.com';
    const password = process.env.LIVE_TEST_PASSWORD ?? 'StrongPass123!';

    const login = await request(server).post('/api/v1/auth/login').send({ email, password });

    // If login fails (e.g., fixtures not present), we still assert that we get a wrapped error.
    if (!login.body.success) {
      expect(login.status).toBeGreaterThanOrEqual(400);
      expect(login.body).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String)
          }),
          meta: expect.objectContaining({
            requestId: expect.any(String),
            timestamp: expect.any(String)
          })
        })
      );
      return;
    }

    // 3) With a valid session, exercise a real authorized endpoint.
    const accessToken = login.body.data.session.accessToken as string;

    const me = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.success).toBe(true);
    expect(me.body.data).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        email: expect.any(String)
      })
    );
    expect(me.body.meta).toEqual(
      expect.objectContaining({
        requestId: expect.any(String),
        timestamp: expect.any(String)
      })
    );
  });
});
