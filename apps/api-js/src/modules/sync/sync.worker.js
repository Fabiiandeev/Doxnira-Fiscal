import { Worker } from "bullmq";

import { createRedisConnection, disconnectRedis } from "../../config/redis.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../config/prisma.js";
import { closeQueues, syncQueue } from "../../config/queue.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { executeSefazSync } from "../../services/sefaz-gateway.service.js";
import { marketplaceService } from "../marketplace/marketplace.service.js";

let worker;
let marketplaceWorker;
let heartbeatTimer;
const heartbeatKey = "worker:sync:heartbeat";
const workerVersion = process.env.npm_package_version || "unknown";

async function heartbeat() {
  await redis.set(heartbeatKey, JSON.stringify({ version: workerVersion, timestamp: Date.now() }), "EX", env.WORKER_HEARTBEAT_TTL_SECONDS);
}

export async function getSyncWorkerStatus() {
  if (!env.WORKER_REQUIRED) return "disabled";
  const raw = await redis.get(heartbeatKey);
  if (!raw) return "down";
  try {
    const value = JSON.parse(raw);
    return Date.now() - Number(value.timestamp) <= env.WORKER_HEARTBEAT_TTL_SECONDS * 1000 ? "up" : "down";
  } catch { return "down"; }
}

export function createSyncWorker() {
  if (!env.WORKER_REQUIRED) return null;
  if (worker) return worker;
  worker = new Worker(
    "nfe-sync",
    async (job) => {
      await prisma.syncLog.update({
        where: { id: job.data.syncLogId },
        data: { status: "RUNNING" },
      });
      const result = await executeSefazSync(job.data);
      if (result.hasMore) {
        const continuation = await prisma.syncLog.create({
          data: {
            companyId: job.data.companyId,
            service: "NFeDistribuicaoDFe",
            requestType: "distNSU",
            requestNsu: result.lastNsu,
            mode: result.mode || "real",
            environment: result.environment || null,
            status: "QUEUED",
            startedAt: new Date(),
          },
        });
        await syncQueue.add(
          "sync-company-continuation",
          { companyId: job.data.companyId, syncLogId: continuation.id },
          {
            jobId: `company-${job.data.companyId}-${continuation.id}`,
            delay: 5_000,
          },
        );
      }
      return result;
    },
    {
      connection: createRedisConnection(),
      concurrency: 2,
      lockDuration: 30_000,
    },
  );
  marketplaceWorker = new Worker(
    "marketplace-sync",
    (job) => marketplaceService.executeSyncJob(job.data.jobId),
    {
      connection: createRedisConnection(),
      concurrency: 1,
      lockDuration: 60_000,
    },
  );
  worker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, result }, "Fiscal synchronization completed");
  });
  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "Fiscal synchronization failed");
    if (job?.data?.syncLogId) {
      prisma.syncLog.update({
        where: { id: job.data.syncLogId },
        data: {
          status: "ERROR",
          errorMessage: error?.message || "Falha controlada no processamento da sincronização.",
          finishedAt: new Date(),
        },
      }).catch((err) => {
        logger.error({ syncLogId: job.data.syncLogId, err }, "Erro ao atualizar sync log");
      });
    }
  });
  worker.on("error", (error) => {
    logger.warn({ err: error }, "Synchronization worker unavailable");
  });
  marketplaceWorker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "Marketplace synchronization failed");
  });
  marketplaceWorker.on("error", (error) => {
    logger.warn({ err: error }, "Marketplace synchronization worker unavailable");
  });
  heartbeat().catch((error) => logger.warn({ err: error }, "Worker heartbeat unavailable"));
  heartbeatTimer = setInterval(() => heartbeat().catch((error) => logger.warn({ err: error }, "Worker heartbeat unavailable")), Math.max(5_000, Math.floor(env.WORKER_HEARTBEAT_TTL_SECONDS * 500)));
  heartbeatTimer.unref();
  return worker;
}

export async function closeSyncWorker() {
  const ownsHeartbeat = Boolean(worker || heartbeatTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
  if (ownsHeartbeat) await redis.del(heartbeatKey).catch(() => {});
  if (worker) {
    await worker.close();
    worker = undefined;
  }
  if (marketplaceWorker) {
    await marketplaceWorker.close();
    marketplaceWorker = undefined;
  }
}

if (process.argv[1]?.endsWith("sync.worker.js")) {
  createSyncWorker();
  logger.info("NS Fiscal Cloud synchronization worker started");
  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, "Shutting down synchronization worker");
    await closeSyncWorker();
    await closeQueues();
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
