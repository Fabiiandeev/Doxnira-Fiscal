import { Router } from "express";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import {
  benchmark, buildInsights, commerceIntelligence, decisionCenter,
  fiscalIntelligence, recordAction,
} from "./intelligence.service.js";

export const intelligenceRouter = Router({ mergeParams: true });

intelligenceRouter.get("/fiscal", asyncHandler(async (req, res) => sendSuccess(res, await fiscalIntelligence(req.company.id, req.query))));
intelligenceRouter.get("/commerce", asyncHandler(async (req, res) => sendSuccess(res, await commerceIntelligence(req.company.id, req.query))));
intelligenceRouter.get("/insights", asyncHandler(async (req, res) => sendSuccess(res, { data: await buildInsights(req.company.id, req.query) })));
intelligenceRouter.get("/decisions", asyncHandler(async (req, res) => sendSuccess(res, await decisionCenter(req.company.id, req.query))));
intelligenceRouter.get("/benchmark", asyncHandler(async (req, res) => sendSuccess(res, await benchmark(req.company.id, req.query))));

intelligenceRouter.post(["/insights/:key/actions", "/decisions/:key/actions"], asyncHandler(async (req, res) => {
  const kind = req.path.startsWith("/insights/") ? "insights" : "decisions";
  if (req.user.role === "VIEWER") throw new AppError("Permissão insuficiente.", "FORBIDDEN", 403);
  const allowed = kind === "insights"
    ? ["ANALYZED", "ASSIGNED", "EXECUTED", "IGNORED"]
    : ["ACCEPTED", "REJECTED", "REVIEW_REQUESTED", "ASSIGNED"];
  const action = String(req.body.action || "").toUpperCase();
  if (!allowed.includes(action)) throw new AppError("Ação inválida.", "INVALID_ACTION", 400);
  if (["IGNORED", "REJECTED", "REVIEW_REQUESTED"].includes(action) && !String(req.body.justification || "").trim()) {
    throw new AppError("Justificativa é obrigatória.", "JUSTIFICATION_REQUIRED", 400);
  }
  const prefix = kind === "insights" ? "INSIGHT" : "DECISION";
  const audit = await recordAction({
    companyId: req.company.id, userId: req.user.id, action: `${prefix}_${action}`,
    entityType: kind === "insights" ? "INTELLIGENCE_INSIGHT" : "INTELLIGENCE_DECISION",
    metadata: {
      insightKey: req.params.key,
      assignee: req.body.assignee || null,
      justification: req.body.justification || null,
    },
    request: req,
  });
  sendSuccess(res, { id: audit.id, status: action }, 201);
}));
