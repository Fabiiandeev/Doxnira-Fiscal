import { createHash } from "node:crypto";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const RATE_LIMIT_POLICIES = Object.freeze({
  AUTH_STRICT: { windowMs: 15 * 60_000, max: 10, critical: true },
  SENSITIVE_WRITE: { windowMs: 60_000, max: 20, critical: true },
  EXTERNAL_CALLBACK: { windowMs: 60_000, max: 60, critical: true },
  WEBHOOK: { windowMs: 60_000, max: 120, critical: true },
  AI_PROVIDER: { windowMs: 60_000, max: 20, critical: true },
  GENERAL_API: { windowMs: 60_000, max: 300, critical: false },
});

export class RedisRateLimitStore {
  constructor(client = redis) { this.client = client; }
  async consume(key, windowMs) {
    const redisKey = `rate-limit:${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) await this.client.expire(redisKey, Math.max(1, Math.ceil(windowMs / 1000)));
    const ttl = await this.client.ttl(redisKey);
    return { count, retryAfter: Math.max(1, ttl) };
  }
}

const sharedStore = new RedisRateLimitStore();
export const buildRateLimitIdentity = (request, category) => createHash("sha256").update([
  category, request.ip, request.user?.id || "anonymous", request.params?.companyId || "none",
  request.params?.provider || "none", request.route?.path || request.path,
].join(":")).digest("hex");

export function rateLimit(options = {}) {
  const category = options.policy || options.key || "GENERAL_API";
  const policy = RATE_LIMIT_POLICIES[category] || { windowMs: options.windowMs || 60_000, max: options.max || 60, critical: true };
  const store = options.store || sharedStore;
  return async (request, response, next) => {
    if (request.path.startsWith("/api/health")) return next();
    try {
      const result = await store.consume(buildRateLimitIdentity(request, category), policy.windowMs);
      response.setHeader("RateLimit-Limit", String(policy.max));
      response.setHeader("RateLimit-Remaining", String(Math.max(0, policy.max - result.count)));
      if (result.count > policy.max) {
        response.setHeader("Retry-After", String(result.retryAfter));
        return next(new AppError("Limite de requisições excedido.", "RATE_LIMITED", 429));
      }
      return next();
    } catch {
      if (policy.critical || env.NODE_ENV === "production") return next(new AppError("Serviço temporariamente indisponível.", "RATE_LIMIT_STORE_UNAVAILABLE", 503));
      return next();
    }
  };
}
