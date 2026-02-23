export interface ApiMeta {
    requestId: string;
    timestamp: string;
}
export interface ApiSuccess<T> {
    success: true;
    data: T;
    meta: ApiMeta;
}
export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta: ApiMeta;
}
