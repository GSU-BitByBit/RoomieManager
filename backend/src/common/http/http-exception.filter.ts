import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';

import type { ApiError } from '../types/api.types';
import { ErrorCode, mapStatusToErrorCode } from './http-error-code';
import { resolveRequestId, type RequestWithId } from './request-meta';

interface ExceptionResponseBody {
  message?: unknown;
  error?: unknown;
  details?: unknown;
  code?: unknown;
}

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const { status, message, code, details } = this.normalizeException(exception);

    const payload: ApiError = {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {})
      },
      meta: {
        requestId: resolveRequestId(request),
        timestamp: new Date().toISOString()
      }
    };

    response.status(status).json(payload);
  }

  private normalizeException(exception: unknown): {
    status: number;
    message: string;
    code: ErrorCode;
    details?: unknown;
  } {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnownRequestError(exception);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const { message, details, code } = this.extractHttpExceptionParts(response, status);

      return {
        status,
        message,
        code,
        ...(details !== undefined ? { details } : {})
      };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message || 'Internal server error',
        code: ErrorCode.InternalError
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: ErrorCode.InternalError
    };
  }

  private extractHttpExceptionParts(
    response: string | object,
    status: number
  ): {
    message: string;
    code: ErrorCode;
    details?: unknown;
  } {
    if (typeof response === 'string') {
      return {
        message: response,
        code: mapStatusToErrorCode(status)
      };
    }

    const body = response as ExceptionResponseBody;

    const message = this.normalizeMessage(body.message) ?? this.defaultMessageForStatus(status);
    const code = this.normalizeErrorCode(body.code) ?? mapStatusToErrorCode(status);
    const details = body.details;

    return {
      message,
      code,
      ...(details !== undefined ? { details } : {})
    };
  }

  private fromPrismaKnownRequestError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    code: ErrorCode;
    details?: unknown;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Resource already exists.',
          code: ErrorCode.Conflict,
          details: {
            target: exception.meta?.target
          }
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Resource not found.',
          code: ErrorCode.NotFound
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Database request error.',
          code: ErrorCode.BadRequest,
          details: {
            prismaCode: exception.code
          }
        };
    }
  }

  private normalizeMessage(message: unknown): string | undefined {
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }

    return undefined;
  }

  private normalizeErrorCode(code: unknown): ErrorCode | undefined {
    if (typeof code !== 'string') {
      return undefined;
    }

    const values = Object.values(ErrorCode);
    return values.includes(code as ErrorCode) ? (code as ErrorCode) : undefined;
  }

  private defaultMessageForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service unavailable';
      default:
        return 'Internal server error';
    }
  }
}
