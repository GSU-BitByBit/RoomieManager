"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    API_PREFIX: zod_1.z.string().min(1).default('api/v1'),
    DATABASE_URL: zod_1.z.string().min(1),
    LOG_LEVEL: zod_1.z.enum(logLevels).default('info'),
    CORS_ORIGINS: zod_1.z.string().default('http://localhost:3000'),
    SUPABASE_URL: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    SUPABASE_JWT_AUDIENCE: zod_1.z.string().optional().or(zod_1.z.literal(''))
});
function validateEnv(config) {
    const parsed = exports.envSchema.safeParse(config);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('; ');
        throw new Error(`Environment validation failed: ${issues}`);
    }
    return parsed.data;
}
