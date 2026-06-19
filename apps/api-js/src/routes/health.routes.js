import { Router } from "express";

import { checkDatabaseConnection } from "../config/prisma.js";

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
