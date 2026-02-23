import type { Request } from 'express';
import { randomUUID } from 'node:crypto';

export type RequestWithId = Request & { id?: string | number };

export function resolveRequestId(request: RequestWithId): string {
  const fromId = request.id;
  if (typeof fromId === 'string' && fromId.length > 0) {
    return fromId;
  }

  if (typeof fromId === 'number') {
    return String(fromId);
  }

  const headerValue = request.headers['x-request-id'];
  if (typeof headerValue === 'string' && headerValue.length > 0) {
    return headerValue;
  }

  if (Array.isArray(headerValue) && headerValue.length > 0) {
    return headerValue[0];
  }

  return randomUUID();
}
