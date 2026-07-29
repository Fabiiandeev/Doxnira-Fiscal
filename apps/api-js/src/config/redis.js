import IORedis from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

const redisDisabled = process.env.REDIS_DISABLED === "true" || env.NODE_ENV === "test";
const disabledValues = new Map();
const disconnectedRedis = {
  status: "end",
  on() { return this; },
  async quit() {},
  disconnect() {},
  async get(key) { return disabledValues.get(key) ?? null; },
  async set(key, value) { disabledValues.set(key, value); return "OK"; },
  async del(key) { return disabledValues.delete(key) ? 1 : 0; },
  async incr(key) { const value = Number(disabledValues.get(key) || 0) + 1; disabledValues.set(key, String(value)); return value; },
  async expire() { return 1; },
  async ttl() { return 60; },
  async ping() { return "PONG"; },
};

export const redis = redisDisabled ? disconnectedRedis : new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", (error) => {
  logger.warn({ err: error }, "Redis connection unavailable");
});

export function createRedisConnection() {
  if (redisDisabled) return disconnectedRedis;
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function disconnectRedis() {
  if (redis.status !== "end") await redis.quit().catch(() => redis.disconnect());
}

export async function checkRedisConnection() {
  return (await redis.ping()) === "PONG";
}
