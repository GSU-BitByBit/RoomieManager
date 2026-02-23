import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private normalizeException;
    private extractHttpExceptionParts;
    private fromPrismaKnownRequestError;
    private normalizeMessage;
    private normalizeErrorCode;
    private defaultMessageForStatus;
}
