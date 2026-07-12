import IORedis from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

const redisDisabled = process.env.REDIS_DISABLED === "true" || env.NODE_ENV === "test";
const disconnectedRedis = {
  status: "end",
  on() { return this; },
  async quit() {},
  disconnect() {},
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
