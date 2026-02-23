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
  @ApiOkResponse({ description: 'Service process is alive.' })
  async getLiveness(): Promise<{ service: string; version: string; timestamp: string }> {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({ description: 'Service is ready to accept traffic.' })
  @ApiServiceUnavailableResponse({ description: 'Service is not ready.' })
  async getReadiness(): Promise<{
    checks: { database: 'ok' | 'fail'; migrations: 'ok' | 'fail' };
  }> {
    const readiness = await this.healthService.getReadiness();

    const isReady = readiness.checks.database === 'ok' && readiness.checks.migrations === 'ok';
    if (!isReady) {
      throw new ServiceUnavailableException({
        code: ErrorCode.ServiceUnavailable,
        message: 'Service is not ready.',
        details: readiness
      });
    }

    return {
      checks: readiness.checks
    };
  }
}
