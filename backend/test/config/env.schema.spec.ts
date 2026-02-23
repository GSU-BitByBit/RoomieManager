import { validateEnv } from '../../src/config/env.schema';

describe('env schema', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    API_PREFIX: 'api/v1',
    DATABASE_URL: 'postgresql://roomie:roomie@localhost:5432/roomiemanager?schema=public',
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
