import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { ResponseInterceptor } from './common/http/response.interceptor';
import type { EnvConfig } from './config/env.schema';

function normalizeApiPrefix(prefix: string): string {
  return prefix.replace(/^\/+/, '').replace(/\/+$/, '');
}

function parseCorsOrigins(raw: string): string[] | boolean {
  const value = raw.trim();
  if (value === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(PinoLogger);
  app.useLogger(logger);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService<EnvConfig, true>);
  const port = configService.get('PORT', { infer: true });
  const apiPrefix = normalizeApiPrefix(configService.get('API_PREFIX', { infer: true }));

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: parseCorsOrigins(configService.get('CORS_ORIGINS', { infer: true })),
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RoomieManager Backend API')
    .setDescription('Module 1 platform foundation')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  Logger.log(`Backend listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
