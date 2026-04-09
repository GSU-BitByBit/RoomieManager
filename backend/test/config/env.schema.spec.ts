import { validateEnv } from '../../src/config/env.schema';

describe('env schema', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    API_PREFIX: 'api/v1',
    DATABASE_URL:
      'postgresql://postgres.project-ref:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&schema=public',
    LOG_LEVEL: 'info',
    CORS_ORIGINS: 'http://localhost:5173'
  };

  it('accepts valid configuration and parses all fields', () => {
    const result = validateEnv(baseEnv);
    expect(result.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('test');
    expect(result.HOST).toBe('127.0.0.1');
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.API_PREFIX).toBe('api/v1');
    expect(result.CORS_ORIGINS).toBe('http://localhost:5173');
  });

  it('applies defaults for optional fields', () => {
    const result = validateEnv({ DATABASE_URL: baseEnv.DATABASE_URL });
    expect(result.NODE_ENV).toBe('development');
    expect(result.HOST).toBe('127.0.0.1');
    expect(result.PORT).toBe(3000);
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.API_PREFIX).toBe('api/v1');
    expect(result.CORS_ORIGINS).toBe('http://localhost:5173');
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => validateEnv({ ...baseEnv, DATABASE_URL: '' })).toThrow(
      /Environment validation failed/
    );
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow(
      /Environment validation failed/
    );
  });

  it('rejects invalid LOG_LEVEL', () => {
    expect(() => validateEnv({ ...baseEnv, LOG_LEVEL: 'verbose' })).toThrow(
      /Environment validation failed/
    );
  });

  it('rejects negative PORT', () => {
    expect(() => validateEnv({ ...baseEnv, PORT: '-1' })).toThrow(/Environment validation failed/);
  });
});
