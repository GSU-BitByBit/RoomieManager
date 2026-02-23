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
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let HealthService = class HealthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getLiveness() {
        return {
            service: 'roomiemanager-backend',
            version: process.env.npm_package_version ?? '0.1.0',
            timestamp: new Date().toISOString()
        };
    }
    async getReadiness() {
        const checks = {
            database: 'ok',
            migrations: 'ok'
        };
        const details = {};
        try {
            await this.prisma.$queryRaw `SELECT 1`;
        }
        catch (error) {
            checks.database = 'fail';
            checks.migrations = 'fail';
            details.database = this.describeError(error);
            return {
                checks,
                details
            };
        }
        try {
            const result = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT COUNT(*)::int AS failed_count
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL
      `);
            const failedCount = Number(result[0]?.failed_count ?? 0);
            if (failedCount > 0) {
                checks.migrations = 'fail';
                details.migrations = `Detected ${failedCount} pending failed migration(s).`;
            }
        }
        catch (error) {
            checks.migrations = 'fail';
            details.migrations = this.describeError(error);
        }
        return Object.keys(details).length > 0
            ? {
                checks,
                details
            }
            : {
                checks
            };
    }
    describeError(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return 'Unknown error';
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HealthService);
