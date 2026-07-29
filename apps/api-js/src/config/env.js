import { config } from "dotenv";

import { z } from "zod";
import { enforceTestDatabaseEnvironment } from "./test-database-safety.js";

if (process.env.NODE_ENV === "test") {
  config({ path: ".env.test", override: true });
  enforceTestDatabaseEnvironment();
} else {
  config();
}

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
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2592000).default(604800),
  SESSION_COOKIE_DOMAIN: z.string().default(""),
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  CSRF_SECRET: z.string().min(32).default("development-csrf-secret-change-me-32"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  API_ORIGIN: z.string().url().default("http://localhost:3333"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  WORKER_REQUIRED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  WORKER_HEARTBEAT_TTL_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  PAYMENT_PROVIDER: z.enum(["INFINITEPAY"]).default("INFINITEPAY"),
  INFINITEPAY_HANDLE: z.string().trim().default("phfabian"),
  INFINITEPAY_API_BASE_URL: z.string().url().default("https://api.checkout.infinitepay.io"),
  INFINITEPAY_REDIRECT_URL: z.string().url().or(z.literal("")).default(""),
  INFINITEPAY_WEBHOOK_URL: z.string().url().or(z.literal("")).default(""),
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

if (parsedEnv.data.NODE_ENV === "production") {
  const productionErrors = [];
  if (!parsedEnv.data.SESSION_COOKIE_SECURE) productionErrors.push("SESSION_COOKIE_SECURE must be true in production");
  if (parsedEnv.data.CSRF_SECRET === "development-csrf-secret-change-me-32") productionErrors.push("CSRF_SECRET must be configured in production");
  if (parsedEnv.data.CORS_ALLOWED_ORIGINS.split(",").map((value) => value.trim()).includes("*")) productionErrors.push("CORS_ALLOWED_ORIGINS cannot contain *");
  if (!parsedEnv.data.INFINITEPAY_REDIRECT_URL) productionErrors.push("INFINITEPAY_REDIRECT_URL must be configured in production");
  if (!parsedEnv.data.INFINITEPAY_WEBHOOK_URL) productionErrors.push("INFINITEPAY_WEBHOOK_URL must be configured in production");
  if (productionErrors.length) throw new Error(`Invalid production security configuration: ${productionErrors.join("; ")}`);
}
if (parsedEnv.data.SESSION_COOKIE_SAME_SITE === "none" && !parsedEnv.data.SESSION_COOKIE_SECURE) {
  throw new Error("SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE=true");
}

export const env = Object.freeze(parsedEnv.data);
