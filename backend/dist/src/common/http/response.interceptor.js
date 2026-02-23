"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const request_meta_1 = require("./request-meta");
let ResponseInterceptor = class ResponseInterceptor {
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const requestId = (0, request_meta_1.resolveRequestId)(request);
        return next.handle().pipe((0, rxjs_1.map)((data) => {
            if (this.isAlreadyWrapped(data)) {
                return data;
            }
            return {
                success: true,
                data,
                meta: {
                    requestId,
                    timestamp: new Date().toISOString()
                }
            };
        }));
    }
    isAlreadyWrapped(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        if (data instanceof common_1.StreamableFile) {
            return true;
        }
        const value = data;
        return value.success === true && value.meta !== undefined;
    }
};
exports.ResponseInterceptor = ResponseInterceptor;
exports.ResponseInterceptor = ResponseInterceptor = __decorate([
    (0, common_1.Injectable)()
], ResponseInterceptor);
