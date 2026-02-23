import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { HealthService } from '../src/modules/health/health.service';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const healthServiceMock = {
    getLiveness: jest.fn(async () => ({
      service: 'roomiemanager-backend',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    })),
    getReadiness: jest.fn(async () => ({
      checks: {
        database: 'ok' as const,
        migrations: 'ok' as const
      }
    }))
  } as jest.Mocked<Pick<HealthService, 'getLiveness' | 'getReadiness'>>;

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

  it('GET /api/v1/health/live returns 200 and success envelope', async () => {
    const response = await request(app!.getHttpServer()).get('/api/v1/health/live').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          service: 'roomiemanager-backend'
        }),
        meta: expect.objectContaining({
          requestId: expect.any(String),
          timestamp: expect.any(String)
        })
      })
    );
  });

  it('GET /api/v1/health/ready returns 200 when checks are ok', async () => {
    await request(app!.getHttpServer()).get('/api/v1/health/ready').expect(200);
  });

  it('GET /api/v1/health/ready returns 503 when checks fail', async () => {
    healthServiceMock.getReadiness.mockResolvedValueOnce({
      checks: {
        database: 'fail',
        migrations: 'ok'
      },
      details: {
        database: 'db down'
      }
    });

    const response = await request(app!.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('unknown route returns NOT_FOUND error envelope', async () => {
    const response = await request(app!.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('propagates x-request-id in response meta', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/health/live')
      .set('x-request-id', 'external-request-id')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('external-request-id');
    expect(response.body.meta.requestId).toBe('external-request-id');
  });
});
