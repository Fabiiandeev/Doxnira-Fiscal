import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3333),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .startsWith("postgresql://", "DATABASE_URL must use PostgreSQL"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  CERT_ENCRYPTION_KEY: z.string().min(32),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().max(50).default(10),
  NSU_WAIT_137_MS: z.coerce.number().int().positive().default(3_600_000),
  NSU_WAIT_656_MS: z.coerce.number().int().positive().default(3_600_000),
  NSU_BATCH_DELAY_MS: z.coerce.number().int().nonnegative().default(3_000),
  NSU_MAX_BATCHES_PER_RUN: z.coerce.number().int().positive().max(100).default(20),
  SEFAZ_INTEGRATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SEFAZ_MANIFESTATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CTE_INTEGRATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ALLOW_PRODUCTION_SEFAZ: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SEFAZ_ENVIRONMENT: z.enum(["homologation", "production"]).default("homologation"),
  SEFAZ_DIST_DFE_PROD_URL: z.string().url(),
  SEFAZ_DIST_DFE_HOM_URL: z.string().url(),
  SEFAZ_EVENT_PROD_URL: z.string().url(),
  SEFAZ_EVENT_HOM_URL: z.string().url(),
  CTE_DIST_DFE_PROD_URL: z.string().default(""),
  CTE_DIST_DFE_HOM_URL: z.string().default(""),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${errors}`);
}

export const env = Object.freeze(parsedEnv.data);
