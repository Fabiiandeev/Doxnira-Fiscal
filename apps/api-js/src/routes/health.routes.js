import { Router } from "express";

import { checkDatabaseConnection } from "../config/prisma.js";
import { checkRedisConnection } from "../config/redis.js";
import { env } from "../config/env.js";
import { runtimeState } from "../config/runtime-state.js";
import { evaluateReadiness } from "../config/readiness.js";
import { getSyncWorkerStatus } from "../modules/sync/sync.worker.js";

export const healthRouter = Router();

healthRouter.get("/", async (request, response) => {
  try {
    await checkDatabaseConnection();

    response.status(200).json({
      status: "ok",
      service: "NS Fiscal Cloud API",
      database: "connected",
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  } catch {
    response.status(503).json({
      status: "error",
      service: "NS Fiscal Cloud API",
      database: "disconnected",
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  }
});

healthRouter.get("/live", (request, response) => {
  response.status(200).json({ status: "live", requestId: request.id });
});

healthRouter.get("/ready", async (request, response) => {
  const checks = { database: "down", redis: "down", worker: env.WORKER_REQUIRED ? "down" : "disabled", prisma: "down" };
  if (!runtimeState.shuttingDown) {
    try { await checkDatabaseConnection(); checks.database = "up"; checks.prisma = "up"; } catch {}
    try { if (await checkRedisConnection()) checks.redis = "up"; } catch {}
    if (checks.redis === "up") {
      try { checks.worker = await getSyncWorkerStatus(); } catch {}
    }
  }
  const ready = evaluateReadiness(checks, { shuttingDown: runtimeState.shuttingDown, workerRequired: env.WORKER_REQUIRED });
  response.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks, requestId: request.id });
});
