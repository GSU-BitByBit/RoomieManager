import { PrismaService } from '../../common/prisma/prisma.service';
export interface ReadinessChecks {
    database: 'ok' | 'fail';
    migrations: 'ok' | 'fail';
}
export interface ReadinessResult {
    checks: ReadinessChecks;
    details?: {
        database?: string;
        migrations?: string;
    };
}
export declare class HealthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getLiveness(): Promise<{
        service: string;
        version: string;
        timestamp: string;
    }>;
    getReadiness(): Promise<ReadinessResult>;
    private describeError;
}
