import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

import { ErrorCode } from './http-error-code';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{8,}$/;

@Injectable()
export class ParseAppIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const normalized = value?.trim();

    if (normalized && (UUID_PATTERN.test(normalized) || CUID_PATTERN.test(normalized))) {
      return normalized;
    }

    throw new BadRequestException({
      code: ErrorCode.BadRequest,
      message: 'Validation failed (expected uuid or cuid).'
    });
  }
}
