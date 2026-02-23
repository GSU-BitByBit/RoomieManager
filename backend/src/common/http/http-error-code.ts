import { HttpStatus } from '@nestjs/common';

export enum ErrorCode {
  BadRequest = 'BAD_REQUEST',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  InternalError = 'INTERNAL_ERROR',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE'
}

export function mapStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.BadRequest;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.Unauthorized;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.Forbidden;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NotFound;
    case HttpStatus.CONFLICT:
      return ErrorCode.Conflict;
    case HttpStatus.SERVICE_UNAVAILABLE:
      return ErrorCode.ServiceUnavailable;
    default:
      return ErrorCode.InternalError;
  }
}
