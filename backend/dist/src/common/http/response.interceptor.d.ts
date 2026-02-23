import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { ApiSuccess } from '../types/api.types';
export declare class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>>;
    private isAlreadyWrapped;
}
