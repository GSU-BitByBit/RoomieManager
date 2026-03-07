import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags
} from '@nestjs/swagger';

import { ErrorCode } from '../../common/http/http-error-code';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    description: 'Service process is alive.',
    schema: {
      example: {
        success: true,
        data: {
          service: 'roomiemanager-backend',
          version: '0.1.0',
          timestamp: '2026-03-05T16:00:00.000Z'
        },
        meta: {
          requestId: '205e20fe-b28d-4b95-bdd3-39e98bc2c7ef',
          timestamp: '2026-03-05T16:00:00.000Z'
        }
      }
    }
  })
  async getLiveness(): Promise<{ service: string; version: string; timestamp: string }> {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({
    description: 'Service is ready to accept traffic.',
    schema: {
      example: {
        success: true,
        data: {
          checks: {
            database: 'ok',
            migrations: 'ok'
          }
        },
        meta: {
          requestId: '4ea71158-1763-4f0f-8f8d-f6bbdc8c4d6c',
          timestamp: '2026-03-05T16:01:00.000Z'
        }
      }
    }
  })
  @ApiServiceUnavailableResponse({
    description: 'Service is not ready.',
    schema: {
      example: {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service is not ready.',
          details: {
            checks: {
              database: 'fail',
              migrations: 'fail'
            }
          }
        },
        meta: {
          requestId: 'f43624b8-8c3d-49e5-bd7c-c7b2f36f8a0c',
          timestamp: '2026-03-05T16:01:00.000Z'
        }
      }
    }
  })
  async getReadiness(): Promise<{
    checks: { database: 'ok' | 'fail'; migrations: 'ok' | 'fail' };
  }> {
    const readiness = await this.healthService.getReadiness();

    const isReady = readiness.checks.database === 'ok' && readiness.checks.migrations === 'ok';
    if (!isReady) {
      throw new ServiceUnavailableException({
        code: ErrorCode.ServiceUnavailable,
        message: 'Service is not ready.',
        details: { checks: readiness.checks }
      });
    }

    return {
      checks: readiness.checks
    };
  }
}
