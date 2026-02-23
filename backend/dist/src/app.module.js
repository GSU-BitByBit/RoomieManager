"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nestjs_pino_1 = require("nestjs-pino");
const node_crypto_1 = require("node:crypto");
const prisma_module_1 = require("./common/prisma/prisma.module");
const env_schema_1 = require("./config/env.schema");
const health_module_1 = require("./modules/health/health.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                validate: env_schema_1.validateEnv
            }),
            nestjs_pino_1.LoggerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    pinoHttp: {
                        level: configService.get('LOG_LEVEL', { infer: true }) ?? 'info',
                        genReqId: (request, response) => {
                            const incomingRequestId = request.headers?.['x-request-id'];
                            const requestId = typeof incomingRequestId === 'string' && incomingRequestId.length > 0
                                ? incomingRequestId
                                : (0, node_crypto_1.randomUUID)();
                            if (typeof response.setHeader === 'function') {
                                response.setHeader('x-request-id', requestId);
                            }
                            return requestId;
                        }
                    }
                })
            }),
            prisma_module_1.PrismaModule,
            health_module_1.HealthModule
        ]
    })
], AppModule);
