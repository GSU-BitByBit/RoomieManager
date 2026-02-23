import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface ReadinessChecks {
  database: 'ok' | 'fail';
  migrations: 'ok' | 'fail';
}

export interface ReadinessResult {
  checks: ReadinessChecks;
  details?: {
    database?: string;
    migrations?: string;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getLiveness(): Promise<{ service: string; version: string; timestamp: string }> {
    return {
      service: 'roomiemanager-backend',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString()
    };
  }

  async getReadiness(): Promise<ReadinessResult> {
    const checks: ReadinessChecks = {
      database: 'ok',
      migrations: 'ok'
    };

    const details: ReadinessResult['details'] = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      checks.database = 'fail';
      checks.migrations = 'fail';
      details.database = this.describeError(error);

      return {
        checks,
        details
      };
    }

    try {
      const result = await this.prisma.$queryRaw<Array<{ failed_count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS failed_count
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL
      `);

      const failedCount = Number(result[0]?.failed_count ?? 0);
      if (failedCount > 0) {
        checks.migrations = 'fail';
        details.migrations = `Detected ${failedCount} pending failed migration(s).`;
      }
    } catch (error) {
      checks.migrations = 'fail';
      details.migrations = this.describeError(error);
    }

    return Object.keys(details).length > 0
      ? {
          checks,
          details
        }
      : {
          checks
        };
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
