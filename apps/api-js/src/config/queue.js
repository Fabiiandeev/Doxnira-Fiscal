import { Queue } from "bullmq";

import { createRedisConnection } from "./redis.js";

export const syncQueue = new Queue("nfe-sync", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export const marketplaceQueue = new Queue("marketplace-sync", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export async function closeQueues() {
  await Promise.all([syncQueue.close(), marketplaceQueue.close()]);
}
