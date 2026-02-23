const defaultDatabaseUrl =
  'postgresql://roomie:roomie@localhost:5432/' + 'roomiemanager?schema=public';

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3001';
process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? defaultDatabaseUrl;
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
