import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_KEYS_TO_IMPORT = new Set([
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_JWT_AUDIENCE',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LIVE_TEST_EMAIL',
  'LIVE_TEST_PASSWORD'
]);

const defaultDatabaseUrl =
  'postgresql://postgres.project-ref:password@aws-1-us-east-1.pooler.supabase.com:5432/' +
  'postgres?sslmode=require&schema=public';

loadEnvFromFileIfPresent();

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3001';
process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';
const configuredDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL =
  configuredDatabaseUrl && configuredDatabaseUrl.length > 0
    ? configuredDatabaseUrl
    : defaultDatabaseUrl;
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://project-ref.supabase.co';
process.env.SUPABASE_JWT_AUDIENCE = process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'anon-key-for-tests';

function loadEnvFromFileIfPresent(): void {
  const envPath = resolve(__dirname, '..', '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (key.length === 0 || !ENV_KEYS_TO_IMPORT.has(key) || process.env[key]) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    const isWrappedInDoubleQuotes = value.startsWith('"') && value.endsWith('"');
    const isWrappedInSingleQuotes = value.startsWith("'") && value.endsWith("'");

    if (isWrappedInDoubleQuotes || isWrappedInSingleQuotes) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
