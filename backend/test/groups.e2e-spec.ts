import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter';
import { ResponseInterceptor } from '../src/common/http/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { GroupsService } from '../src/modules/groups/groups.service';
import { SupabaseJwtService } from '../src/modules/auth/supabase-jwt.service';

describe('Groups endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const groupsServiceMock = {
    createGroup: jest.fn(async () => ({
      id: 'group-1',
      name: 'Apartment 12A',
      createdBy: 'user-1',
      createdAt: '2026-02-23T00:00:00.000Z',
      updatedAt: '2026-02-23T00:00:00.000Z',
      memberRole: 'ADMIN',
      memberStatus: 'ACTIVE',
      memberCount: 1,
      joinCode: 'ABCD1234'
    })),
    joinGroup: jest.fn(async () => ({
      id: 'group-1',
      name: 'Apartment 12A',
      createdBy: 'user-1',
      createdAt: '2026-02-23T00:00:00.000Z',
      updatedAt: '2026-02-23T00:00:00.000Z',
      memberRole: 'MEMBER',
      memberStatus: 'ACTIVE',
      memberCount: 2
    })),
    resetJoinCode: jest.fn(async () => ({
      groupId: 'group-1',
      joinCode: 'ZXCV9876'
    })),
    getGroup: jest.fn(async () => ({
      id: 'group-1',
      name: 'Apartment 12A',
      createdBy: 'user-1',
      createdAt: '2026-02-23T00:00:00.000Z',
      updatedAt: '2026-02-23T00:00:00.000Z',
      memberRole: 'ADMIN',
      memberStatus: 'ACTIVE',
      memberCount: 2,
      joinCode: 'ZXCV9876'
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
      .overrideProvider(GroupsService)
      .useValue(groupsServiceMock)
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

  it('POST /api/v1/groups requires auth', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups')
      .send({ name: 'Apartment 12A' })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/groups creates group', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Apartment 12A' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.joinCode).toBe('ABCD1234');
  });

  it('POST /api/v1/groups rejects whitespace-only name', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '   ' })
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(groupsServiceMock.createGroup).not.toHaveBeenCalled();
  });

  it('POST /api/v1/groups/join joins by code', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups/join')
      .set('Authorization', 'Bearer valid-token')
      .send({ joinCode: 'ABCD1234' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.memberRole).toBe('MEMBER');
  });

  it('POST /api/v1/groups/:groupId/join-code/reset resets join code', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/groups/group-1/join-code/reset')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.joinCode).toBe('ZXCV9876');
  });

  it('GET /api/v1/groups/:groupId returns group', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/groups/group-1')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('group-1');
  });
});
