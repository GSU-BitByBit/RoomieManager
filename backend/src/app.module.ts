import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { PrismaModule } from './common/prisma/prisma.module';
import type { EnvConfig } from './config/env.schema';
import { validateEnv } from './config/env.schema';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvConfig, true>) => ({
        pinoHttp: {
          level: configService.get('LOG_LEVEL', { infer: true }) ?? 'info',
          genReqId: (request, response): string => {
            const incomingRequestId = request.headers?.['x-request-id'];
            const requestId =
              typeof incomingRequestId === 'string' && incomingRequestId.length > 0
                ? incomingRequestId
                : randomUUID();

            if (typeof response.setHeader === 'function') {
              response.setHeader('x-request-id', requestId);
            }

            return requestId;
          }
        }
      })
    }),
    PrismaModule,
    AuthModule,
    HealthModule
  ]
})
export class AppModule {}
