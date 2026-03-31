import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { PrismaModule } from './common/prisma/prisma.module';
import type { EnvConfig } from './config/env.schema';
import { validateEnv } from './config/env.schema';
import { AuthModule } from './modules/auth/auth.module';
import { GroupsModule } from './modules/groups/groups.module';
import { HealthModule } from './modules/health/health.module';
import { ChoresModule } from './modules/chores/chores.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { FinanceModule } from './modules/finance/finance.module';

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
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.apikey',
              'req.body.password',
              'req.body.refreshToken',
              'res.headers["set-cookie"]'
            ],
            censor: '[REDACTED]'
          },
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
    GroupsModule,
    HealthModule,
    ChoresModule,
    ContractsModule,
    FinanceModule
  ]
})
export class AppModule {}
