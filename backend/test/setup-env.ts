const defaultDatabaseUrl =
  'postgresql://postgres:password@db.project-ref.supabase.co:5432/' +
  'postgres?sslmode=require&schema=public';

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
