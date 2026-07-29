import { Router } from "express";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { actionSchema, messageSchema, ruleSchema } from "./fiscal-ai.schemas.js";
import * as service from "./fiscal-ai.service.js";
import * as repo from "./fiscal-ai.repository.js";

export const fiscalAiRouter = Router({ mergeParams: true });
const writable = (req) => { if (req.user.role === "VIEWER") throw new AppError("Permissão insuficiente.", "FORBIDDEN", 403); };
const parse = (schema, value) => { const result = schema.safeParse(value); if (!result.success) throw new AppError(result.error.issues[0].message, "VALIDATION_ERROR", 400); return result.data; };

fiscalAiRouter.get("/autopilot", asyncHandler(async (req, res) => sendSuccess(res, await service.autopilot(req.company.id))));
fiscalAiRouter.post("/autopilot/actions", asyncHandler(async (req, res) => { writable(req); sendSuccess(res, await service.act({ companyId: req.company.id, userId: req.user.id, body: parse(actionSchema, req.body), request: req })); }));
fiscalAiRouter.get("/radar", asyncHandler(async (req, res) => sendSuccess(res, { data: await service.radar(req.company.id, req.query) })));
fiscalAiRouter.get("/score", asyncHandler(async (req, res) => sendSuccess(res, await service.score(req.company.id))));
fiscalAiRouter.get("/chat/status", asyncHandler(async (_req, res) => sendSuccess(res, service.providerStatus())));
fiscalAiRouter.post("/chat/messages", asyncHandler(async (req, res) => sendSuccess(res, await service.chat(req.company.id, req.user.id, parse(messageSchema, req.body), req))));
fiscalAiRouter.get("/chat/conversations", asyncHandler(async (req, res) => { const logs = await repo.audits(req.company.id, "FISCAL_AI_CHAT"); sendSuccess(res, { data: logs.map((l) => ({ id: l.metadata?.conversationId, question: l.metadata?.question, answer: l.metadata?.answer, documentId: l.metadata?.documentId, createdAt: l.createdAt })) }); }));
fiscalAiRouter.get("/rules", asyncHandler(async (req, res) => { const [data, total] = await Promise.all([repo.listRules(req.company.id, req.query), repo.countRules(req.company.id, req.query)]); sendSuccess(res, { data, total }); }));
fiscalAiRouter.post("/rules", asyncHandler(async (req, res) => { writable(req); sendSuccess(res, await repo.createRule(req.company.id, parse(ruleSchema, req.body)), 201); }));
fiscalAiRouter.get("/rules/:id", asyncHandler(async (req, res) => { const rule = await repo.getRule(req.company.id, req.params.id); if (!rule) throw new AppError("Regra não encontrada.", "RULE_NOT_FOUND", 404); sendSuccess(res, rule); }));
fiscalAiRouter.put("/rules/:id", asyncHandler(async (req, res) => { writable(req); const rule = await repo.getRule(req.company.id, req.params.id); if (!rule) throw new AppError("Regra não encontrada.", "RULE_NOT_FOUND", 404); await repo.updateRule(req.company.id, rule.id, parse(ruleSchema.partial(), req.body)); await repo.audit({ companyId: req.company.id, userId: req.user.id, action: "FISCAL_RULE_UPDATED", entityType: "TAX_RULE", entityId: rule.id, metadata: { before: rule, changes: req.body } }); sendSuccess(res, await repo.getRule(req.company.id, rule.id)); }));
fiscalAiRouter.post("/rules/:id/version", asyncHandler(async (req, res) => { writable(req); const rule = await repo.getRule(req.company.id, req.params.id); if (!rule) throw new AppError("Regra não encontrada.", "RULE_NOT_FOUND", 404); await repo.updateRule(req.company.id, rule.id, { effectiveUntil: new Date() }); const { id, companyId, createdAt, updatedAt, effectiveUntil, ...copy } = rule; sendSuccess(res, await repo.createRule(req.company.id, { ...copy, ...parse(ruleSchema.partial(), req.body), effectiveFrom: new Date() }), 201); }));
fiscalAiRouter.post("/rules/:id/toggle", asyncHandler(async (req, res) => { writable(req); const rule = await repo.getRule(req.company.id, req.params.id); if (!rule) throw new AppError("Regra não encontrada.", "RULE_NOT_FOUND", 404); await repo.updateRule(req.company.id, rule.id, { effectiveUntil: rule.effectiveUntil ? null : new Date() }); sendSuccess(res, await repo.getRule(req.company.id, rule.id)); }));
fiscalAiRouter.post("/rules/:id/test", asyncHandler(async (req, res) => { const rule = await repo.getRule(req.company.id, req.params.id); if (!rule) throw new AppError("Regra não encontrada.", "RULE_NOT_FOUND", 404); sendSuccess(res, { matched: (!req.body.cfop || rule.cfop === req.body.cfop) && (!req.body.ncm || rule.ncm === req.body.ncm), rate: Number(rule.rate), impact: { documents: 0, note: "Teste determinístico; nenhum documento foi alterado." } }); }));
