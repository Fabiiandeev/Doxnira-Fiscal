import { createServer } from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { disconnectDatabase } from "./config/prisma.js";
import { closeQueues } from "./config/queue.js";
import { disconnectRedis } from "./config/redis.js";
import {
  closeSyncWorker,
  createSyncWorker,
} from "./modules/sync/sync.worker.js";

const server = createServer(app);
let isShuttingDown = false;

createSyncWorker();

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      apiUrl: `http://localhost:${env.PORT}/api`,
    },
    "NS Fiscal Cloud API started",
  );
});

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Shutting down API");

  const forceTimer = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();

  server.closeIdleConnections?.();
  const httpClosed = new Promise((resolve) => {
    server.close((serverError) => {
      if (serverError) {
        logger.error({ err: serverError }, "Failed to close HTTP server");
        process.exitCode = 1;
      }
      resolve();
    });
  });

  const results = await Promise.allSettled([
    closeSyncWorker(),
    closeQueues(),
    disconnectRedis(),
    disconnectDatabase(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      logger.error({ err: result.reason }, "Failed to close backend resource");
      process.exitCode = 1;
    }
  }

  server.closeAllConnections?.();
  await httpClosed;
  clearTimeout(forceTimer);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "Unhandled promise rejection");
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  shutdown("uncaughtException");
});
