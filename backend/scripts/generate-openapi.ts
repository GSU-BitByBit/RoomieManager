import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import { AppModule } from '../src/app.module';
import type { EnvConfig } from '../src/config/env.schema';

function normalizeApiPrefix(prefix: string): string {
  return prefix.replace(/^\/+/, '').replace(/\/+$/, '');
}

function sortObjectDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, sortObjectDeep(nested)]);

    return Object.fromEntries(sortedEntries) as T;
  }

  return value;
}

function buildSwaggerDocument(app: Awaited<ReturnType<typeof NestFactory.create>>): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RoomieManager Backend API')
    .setDescription('Module 1-2 platform and authentication')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase access token'
      },
      'bearer'
    )
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}

export async function generateOpenApi(outputPath: string): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  try {
    const configService = app.get(ConfigService<EnvConfig, true>);
    const apiPrefix = normalizeApiPrefix(configService.get('API_PREFIX', { infer: true }));
    app.setGlobalPrefix(apiPrefix);

    const rawDocument = buildSwaggerDocument(app);
    const stableDocument = sortObjectDeep(rawDocument);

    const outputFilePath = resolve(outputPath);
    await mkdir(dirname(outputFilePath), { recursive: true });
    await writeFile(outputFilePath, `${JSON.stringify(stableDocument, null, 2)}\n`, 'utf8');
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const outputPath = process.argv[2] ?? 'openapi/openapi.json';
  await generateOpenApi(outputPath);
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec generated at ${resolve(outputPath)}`);
}

if (require.main === module) {
  void main();
}
