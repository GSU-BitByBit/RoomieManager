import { z } from 'zod';
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    PORT: z.ZodDefault<z.ZodNumber>;
    API_PREFIX: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodString;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace", "silent"]>>;
    CORS_ORIGINS: z.ZodDefault<z.ZodString>;
    SUPABASE_URL: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    SUPABASE_JWT_AUDIENCE: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    PORT: number;
    API_PREFIX: string;
    DATABASE_URL: string;
    LOG_LEVEL: "info" | "warn" | "error" | "fatal" | "debug" | "trace" | "silent";
    CORS_ORIGINS: string;
    SUPABASE_URL?: string | undefined;
    SUPABASE_JWT_AUDIENCE?: string | undefined;
}, {
    DATABASE_URL: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    PORT?: number | undefined;
    API_PREFIX?: string | undefined;
    LOG_LEVEL?: "info" | "warn" | "error" | "fatal" | "debug" | "trace" | "silent" | undefined;
    CORS_ORIGINS?: string | undefined;
    SUPABASE_URL?: string | undefined;
    SUPABASE_JWT_AUDIENCE?: string | undefined;
}>;
export type EnvConfig = z.infer<typeof envSchema>;
export declare function validateEnv(config: Record<string, unknown>): EnvConfig;
