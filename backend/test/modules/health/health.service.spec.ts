import { HealthService } from '../../../src/modules/health/health.service';

describe('HealthService', () => {
  it('returns readiness with failed database check when DB query fails', async () => {
    const prismaMock = {
      $queryRaw: jest.fn().mockRejectedValueOnce(new Error('db down'))
    };

    const service = new HealthService(prismaMock as any);
    const readiness = await service.getReadiness();

    expect(readiness.checks.database).toBe('fail');
    expect(readiness.checks.migrations).toBe('fail');
    expect(readiness.details?.database).toBe('Error');
  });

  it('returns readiness with failed migration check when failed rows exist', async () => {
    const prismaMock = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ failed_count: 2 }])
    };

    const service = new HealthService(prismaMock as any);
    const readiness = await service.getReadiness();

    expect(readiness.checks.database).toBe('ok');
    expect(readiness.checks.migrations).toBe('fail');
    expect(readiness.details?.migrations).toContain('Detected 2 incomplete');
  });
});
