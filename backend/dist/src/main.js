"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const nestjs_pino_1 = require("nestjs-pino");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/http/http-exception.filter");
const response_interceptor_1 = require("./common/http/response.interceptor");
function normalizeApiPrefix(prefix) {
    return prefix.replace(/^\/+/, '').replace(/\/+$/, '');
}
function parseCorsOrigins(raw) {
    const value = raw.trim();
    if (value === '*') {
        return true;
    }
    return value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true });
    const logger = app.get(nestjs_pino_1.Logger);
    app.useLogger(logger);
    app.enableShutdownHooks();
    const configService = app.get((config_1.ConfigService));
    const port = configService.get('PORT', { infer: true });
    const apiPrefix = normalizeApiPrefix(configService.get('API_PREFIX', { infer: true }));
    app.setGlobalPrefix(apiPrefix);
    app.enableCors({
        origin: parseCorsOrigins(configService.get('CORS_ORIGINS', { infer: true })),
        credentials: true
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
    }));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('RoomieManager Backend API')
        .setDescription('Module 1 platform foundation')
        .setVersion('1.0.0')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    await app.listen(port);
    common_1.Logger.log(`Backend listening on port ${port}`, 'Bootstrap');
}
void bootstrap();
