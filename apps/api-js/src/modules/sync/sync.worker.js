import { Worker } from "bullmq";

import { createRedisConnection } from "../../config/redis.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../config/prisma.js";
import { syncQueue } from "../../config/queue.js";
import { executeSefazSync } from "../../services/sefaz-gateway.service.js";

let worker;

export function createSyncWorker() {
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
  return worker;
}

export async function closeSyncWorker() {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}

if (process.argv[1]?.endsWith("sync.worker.js")) {
  createSyncWorker();
  logger.info("NS Fiscal Cloud synchronization worker started");
}
