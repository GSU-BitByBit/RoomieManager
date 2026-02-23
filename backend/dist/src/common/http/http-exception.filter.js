"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const http_error_code_1 = require("./http-error-code");
const request_meta_1 = require("./request-meta");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const { status, message, code, details } = this.normalizeException(exception);
        const payload = {
            success: false,
            error: {
                code,
                message,
                ...(details !== undefined ? { details } : {})
            },
            meta: {
                requestId: (0, request_meta_1.resolveRequestId)(request),
                timestamp: new Date().toISOString()
            }
        };
        response.status(status).json(payload);
    }
    normalizeException(exception) {
        if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return this.fromPrismaKnownRequestError(exception);
        }
        if (exception instanceof common_1.HttpException) {
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
                status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: exception.message || 'Internal server error',
                code: http_error_code_1.ErrorCode.InternalError
            };
        }
        return {
            status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
            code: http_error_code_1.ErrorCode.InternalError
        };
    }
    extractHttpExceptionParts(response, status) {
        if (typeof response === 'string') {
            return {
                message: response,
                code: (0, http_error_code_1.mapStatusToErrorCode)(status)
            };
        }
        const body = response;
        const message = this.normalizeMessage(body.message) ?? this.defaultMessageForStatus(status);
        const code = this.normalizeErrorCode(body.code) ?? (0, http_error_code_1.mapStatusToErrorCode)(status);
        const details = body.details;
        return {
            message,
            code,
            ...(details !== undefined ? { details } : {})
        };
    }
    fromPrismaKnownRequestError(exception) {
        switch (exception.code) {
            case 'P2002':
                return {
                    status: common_1.HttpStatus.CONFLICT,
                    message: 'Resource already exists.',
                    code: http_error_code_1.ErrorCode.Conflict,
                    details: {
                        target: exception.meta?.target
                    }
                };
            case 'P2025':
                return {
                    status: common_1.HttpStatus.NOT_FOUND,
                    message: 'Resource not found.',
                    code: http_error_code_1.ErrorCode.NotFound
                };
            default:
                return {
                    status: common_1.HttpStatus.BAD_REQUEST,
                    message: 'Database request error.',
                    code: http_error_code_1.ErrorCode.BadRequest,
                    details: {
                        prismaCode: exception.code
                    }
                };
        }
    }
    normalizeMessage(message) {
        if (typeof message === 'string') {
            return message;
        }
        if (Array.isArray(message) && message.length > 0) {
            return message.join(', ');
        }
        return undefined;
    }
    normalizeErrorCode(code) {
        if (typeof code !== 'string') {
            return undefined;
        }
        const values = Object.values(http_error_code_1.ErrorCode);
        return values.includes(code) ? code : undefined;
    }
    defaultMessageForStatus(status) {
        switch (status) {
            case common_1.HttpStatus.BAD_REQUEST:
                return 'Bad request';
            case common_1.HttpStatus.UNAUTHORIZED:
                return 'Unauthorized';
            case common_1.HttpStatus.FORBIDDEN:
                return 'Forbidden';
            case common_1.HttpStatus.NOT_FOUND:
                return 'Not found';
            case common_1.HttpStatus.CONFLICT:
                return 'Conflict';
            case common_1.HttpStatus.SERVICE_UNAVAILABLE:
                return 'Service unavailable';
            default:
                return 'Internal server error';
        }
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Injectable)(),
    (0, common_1.Catch)()
], HttpExceptionFilter);
