import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import type { ApiSuccess } from '../types/api.types';
import { resolveRequestId, type RequestWithId } from './request-meta';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const requestId = resolveRequestId(request);

    return next.handle().pipe(
      map((data) => {
        if (this.isAlreadyWrapped(data)) {
          return data as ApiSuccess<T>;
        }

        return {
          success: true,
          data,
          meta: {
            requestId,
            timestamp: new Date().toISOString()
          }
        };
      })
    );
  }

  private isAlreadyWrapped(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (data instanceof StreamableFile) {
      return true;
    }

    const value = data as Record<string, unknown>;
    return (
      value.success === true &&
      typeof value.meta === 'object' &&
      value.meta !== null &&
      'requestId' in (value.meta as object)
    );
  }
}
