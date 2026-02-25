import { validateEnv } from '../../src/config/env.schema';

describe('env schema', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    API_PREFIX: 'api/v1',
    DATABASE_URL:
      'postgresql://postgres.project-ref:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&schema=public',
    LOG_LEVEL: 'info',
    CORS_ORIGINS: 'http://localhost:3000'
  };

  it('accepts valid configuration', () => {
    const result = validateEnv(baseEnv);
    expect(result.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
    expect(result.PORT).toBe(3000);
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => validateEnv({ ...baseEnv, DATABASE_URL: '' })).toThrow(
      /Environment validation failed/
    );
  });
});
