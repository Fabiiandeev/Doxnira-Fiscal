import { Router } from "express";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { prisma } from "../../config/prisma.js";
import { writeAudit } from "../audit/audit.service.js";
import { runNfeValidation, applyAutoCorrections } from "../../services/nfe-validation/nfe-validation-engine.js";

export const nfeValidationRouter = Router({ mergeParams: true });

// POST / - run a new NFe validation
nfeValidationRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const company = request.company; // injected by requireCompanyAccess
    const user = request.user; // injected by requireAuth
    const nfeData = request.body || {};
    // Run validation engine
    const result = await runNfeValidation(nfeData, company);
    // Persist result
    const record = await prisma.nfeValidationRun.create({
      data: {
        companyId: company.id,
        userId: user.id,
        nfeData,
        status: "COMPLETED",
        score: result.score,
        errorCount: result.errorCount,
        alertCount: result.alertCount,
        infoCount: result.infoCount,
        autoCorrections: result.autoCorrections ?? 0,
        rejectionProbability: result.rejectionProbability,
        situation: result.situation,
        canTransmit: result.canTransmit,
        issues: result.issues,
        phases: result.phases,
        durationMs: result.durationMs,
        validatedAt: result.validatedAt,
      },
    });

    await writeAudit({
      request,
      action: "nfe_validation.run",
      companyId: company.id,
      entityType: "NfeValidationRun",
      entityId: record.id,
      metadata: { score: result.score, canTransmit: result.canTransmit },
    });

    sendSuccess(response, record, 201);
  }),
);

// GET / - list validation runs for the company
nfeValidationRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const runs = await prisma.nfeValidationRun.findMany({
      where: { companyId: request.company.id },
      orderBy: { validatedAt: "desc" },
    });
    sendSuccess(response, { data: runs });
  }),
);

// GET /:runId - fetch a single validation run
nfeValidationRouter.get(
  "/:runId",
  asyncHandler(async (request, response) => {
    const run = await prisma.nfeValidationRun.findFirst({
      where: { id: request.params.runId, companyId: request.company.id },
    });
    if (!run) throw new AppError("Resultado de validação não encontrado.", "NFE_VALIDATION_NOT_FOUND", 404);
    sendSuccess(response, run);
  }),
);

// POST /:runId/auto-correct - apply auto‑corrections and re‑run validation
nfeValidationRouter.post(
  "/:runId/auto-correct",
  asyncHandler(async (request, response) => {
    const company = request.company;
    const user = request.user;
    const run = await prisma.nfeValidationRun.findFirst({
      where: { id: request.params.runId, companyId: company.id },
    });
    if (!run) throw new AppError("Resultado de validação não encontrado.", "NFE_VALIDATION_NOT_FOUND", 404);

    const { corrected, corrections, correctionCount } = applyAutoCorrections(run.issues, run.nfeData);

    // Re‑run validation on corrected data
    const newResult = await runNfeValidation(corrected, company);

    // Persist the new run (keeping original for audit)
    const newRecord = await prisma.nfeValidationRun.create({
      data: {
        companyId: company.id,
        userId: user.id,
        nfeData: corrected,
        status: "COMPLETED",
        score: newResult.score,
        errorCount: newResult.errorCount,
        alertCount: newResult.alertCount,
        infoCount: newResult.infoCount,
        autoCorrections: correctionCount,
        rejectionProbability: newResult.rejectionProbability,
        situation: newResult.situation,
        canTransmit: newResult.canTransmit,
        issues: newResult.issues,
        phases: newResult.phases,
        durationMs: newResult.durationMs,
        validatedAt: newResult.validatedAt,
      },
    });

    await writeAudit({
      request,
      action: "nfe_validation.auto_correct",
      companyId: company.id,
      entityType: "NfeValidationRun",
      entityId: newRecord.id,
      metadata: { originalRunId: run.id, corrections: correctionCount },
    });

    sendSuccess(response, { corrected, corrections, newRun: newRecord });
  }),
);
