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
