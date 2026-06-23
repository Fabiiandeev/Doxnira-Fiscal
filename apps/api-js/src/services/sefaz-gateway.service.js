import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { executeRealSefazSync } from "./sefaz-real.service.js";

async function markSyncError(syncLogId, message) {
  if (!syncLogId) return;
  await prisma.syncLog.update({
    where: { id: syncLogId },
    data: {
      status: "ERROR",
      errorMessage: message,
      finishedAt: new Date(),
    },
  }).catch(() => undefined);
}

export async function executeSefazSync(input) {
  if (!env.SEFAZ_INTEGRATION_ENABLED) {
    const message = "Sincronização real com a SEFAZ desativada. Nenhum documento fictício foi salvo.";
    await markSyncError(input.syncLogId, message);
    throw new AppError(message, "REAL_SEFAZ_DISABLED", 409);
  }

  try {
    return await executeRealSefazSync(input);
  } catch (error) {
    const message = "A sincronização real com a SEFAZ falhou. Nenhum documento fictício foi salvo.";
    await markSyncError(input.syncLogId, message);
    throw new AppError(
      message,
      "REAL_SEFAZ_SYNC_FAILED",
      error instanceof AppError ? error.statusCode : 502,
      [{ causeCode: error?.code || "SEFAZ_REAL_ERROR" }],
    );
  }
}
