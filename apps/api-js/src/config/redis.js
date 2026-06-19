import IORedis from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", (error) => {
  logger.warn({ err: error }, "Redis connection unavailable");
});

export function createRedisConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function disconnectRedis() {
  if (redis.status !== "end") await redis.quit().catch(() => redis.disconnect());
}
