import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { EnvConfig } from '../../config/env.schema';
import { ErrorCode } from '../http/http-error-code';

export function resolveSupabaseUrl(configService: ConfigService<EnvConfig, true>): string {
  const rawUrl = configService.get('SUPABASE_URL', { infer: true })?.trim();

  if (!rawUrl) {
    throw new ServiceUnavailableException({
      code: ErrorCode.ServiceUnavailable,
      message: 'SUPABASE_URL is not configured.'
    });
  }

  return rawUrl.replace(/\/+$/, '');
}
