import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const authServiceMock = {
    register: jest.fn(async () => ({
      user: {
        id: 'user-1',
        email: 'alex@example.com'
      },
      session: null
    })),
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

  const jwtServiceMock = {
    verifyAccessToken: jest.fn(async (token: string) => {
      if (token === 'valid-token') {
        return {
          id: 'user-1',
          email: 'alex@example.com',
          role: 'authenticated',
          aud: 'authenticated'
        };
      }

      throw new UnauthorizedException('Invalid or expired access token.');
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
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
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

  it('POST /api/v1/auth/register returns wrapped response', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'alex@example.com',
        password: 'StrongPass123!',
        fullName: 'Alex Smith'
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'alex@example.com'
          },
          session: null
        }
      })
    );
  });

  it('POST /api/v1/auth/login returns wrapped response', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'alex@example.com',
        password: 'StrongPass123!'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.session.accessToken).toBe('access-token');
  });

  it('GET /api/v1/auth/me returns UNAUTHORIZED when token is missing', async () => {
    const response = await request(app!.getHttpServer()).get('/api/v1/auth/me').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/auth/me returns user for valid bearer token', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'alex@example.com'
      })
    );
  });
});
