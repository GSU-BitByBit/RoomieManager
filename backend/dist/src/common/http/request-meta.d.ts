import type { Request } from 'express';
export type RequestWithId = Request & {
    id?: string | number;
};
export declare function resolveRequestId(request: RequestWithId): string;
