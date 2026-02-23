"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_code_1 = require("../../common/http/http-error-code");
const health_service_1 = require("./health.service");
let HealthController = class HealthController {
    healthService;
    constructor(healthService) {
        this.healthService = healthService;
    }
    async getLiveness() {
        return this.healthService.getLiveness();
    }
    async getReadiness() {
        const readiness = await this.healthService.getReadiness();
        const isReady = readiness.checks.database === 'ok' && readiness.checks.migrations === 'ok';
        if (!isReady) {
            throw new common_1.ServiceUnavailableException({
                code: http_error_code_1.ErrorCode.ServiceUnavailable,
                message: 'Service is not ready.',
                details: readiness
            });
        }
        return {
            checks: readiness.checks
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)('live'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Liveness probe' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Service process is alive.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getLiveness", null);
__decorate([
    (0, common_1.Get)('ready'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Readiness probe' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Service is ready to accept traffic.' }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ description: 'Service is not ready.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getReadiness", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [health_service_1.HealthService])
], HealthController);
