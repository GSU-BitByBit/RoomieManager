export declare enum ErrorCode {
    BadRequest = "BAD_REQUEST",
    Unauthorized = "UNAUTHORIZED",
    Forbidden = "FORBIDDEN",
    NotFound = "NOT_FOUND",
    Conflict = "CONFLICT",
    InternalError = "INTERNAL_ERROR",
    ServiceUnavailable = "SERVICE_UNAVAILABLE"
}
export declare function mapStatusToErrorCode(status: number): ErrorCode;
