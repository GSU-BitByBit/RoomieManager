import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    getLiveness(): Promise<{
        service: string;
        version: string;
        timestamp: string;
    }>;
    getReadiness(): Promise<{
        checks: {
            database: 'ok' | 'fail';
            migrations: 'ok' | 'fail';
        };
    }>;
}
