import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { inventoryConflict } from "./operation-errors.js";

export const sensitiveActions = new Set(["MOVE_INVENTORY","ISSUE_FISCAL_DOCUMENT","CANCEL_FISCAL_DOCUMENT","CHANGE_MARKETPLACE_PRICE","PAY_FINANCIAL_ENTRY","RECEIVE_FINANCIAL_ENTRY"]);
const secretPattern = /token|secret|password|senha|certificate|certificado|private.?key|encrypted|rawxml|xml/i;
export const sanitizeAutomationPayload = (value, key = "") => {
  if (secretPattern.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => sanitizeAutomationPayload(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeAutomationPayload(entryValue, entryKey)]));
  return value;
};
const at = (payload, path) => path.split(".").reduce((current, part) => current?.[part], payload);
export const evaluateCondition = (condition, payload) => {
  const actual = at(payload, condition.field), expected = condition.value;
  const empty = actual === null || actual === undefined || actual === "";
  const result = {
    EQUALS: () => actual === expected, NOT_EQUALS: () => actual !== expected,
    GREATER_THAN: () => Number(actual) > Number(expected), GREATER_OR_EQUAL: () => Number(actual) >= Number(expected),
    LESS_THAN: () => Number(actual) < Number(expected), LESS_OR_EQUAL: () => Number(actual) <= Number(expected),
    CONTAINS: () => String(actual ?? "").includes(String(expected ?? "")),
    IN: () => Array.isArray(expected) && expected.includes(actual),
    IS_EMPTY: () => empty, IS_NOT_EMPTY: () => !empty,
  }[condition.operator]?.() ?? false;
  return { ...condition, actual: sanitizeAutomationPayload(actual), result };
};
export const evaluateAutomation = (automation, payload) => {
  const results = automation.conditions.map((condition) => evaluateCondition(condition, payload));
  return { logic: automation.conditionLogic, matched: results.length === 0 || (automation.conditionLogic === "OR" ? results.some((item) => item.result) : results.every((item) => item.result)), conditions: results };
};
const executeSafeAction = async (tx, automation, run, action) => {
  const config = action.config || {};
  if (action.type === "START_MARKETPLACE_SYNC") {
    const connection = await tx.marketplaceConnection.findFirst({ where: { id: String(config.connectionId || ""), companyId: automation.companyId } });
    if (!connection) return { type: action.type, status: "SKIPPED", reason: "Conexão Marketplace não encontrada." };
    const existing = await tx.marketplaceSyncJob.findUnique({ where: { idempotencyKey: action.idempotencyKey || `${run.idempotencyKey}:${action.type}` } });
    if (existing) return { type: action.type, status: "COMPLETED", entityId: existing.id, duplicate: true };
    const job = await tx.marketplaceSyncJob.create({ data: { companyId: automation.companyId, connectionId: connection.id, type: String(config.syncType || "FULL"), idempotencyKey: action.idempotencyKey || `${run.idempotencyKey}:${action.type}` } });
    return { type: action.type, status: "COMPLETED", entityId: job.id };
  }
  const alert = await tx.alert.create({ data: {
    companyId: automation.companyId, type: action.type, severity: String(config.severity || "info"),
    title: String(config.title || automation.name).slice(0, 180),
    message: String(config.message || `Automação ${automation.name}: ${action.type}`),
    assignedToId: action.type === "ASSIGN_RESPONSIBLE" ? automation.responsibleId : null,
  } });
  return { type: action.type, status: "COMPLETED", entityId: alert.id };
};
export const runAutomation = async (automation, input, userId = null) => {
  const duplicate = await prisma.operationAutomationRun.findUnique({ where: { companyId_idempotencyKey: { companyId: automation.companyId, idempotencyKey: input.idempotencyKey } } });
  if (duplicate) return duplicate;
  const now = new Date();
  const recentCount = await prisma.operationAutomationRun.count({ where: { automationId: automation.id, status: { in: ["COMPLETED","PARTIAL"] } } });
  const last = await prisma.operationAutomationRun.findFirst({ where: { automationId: automation.id }, orderBy: { createdAt: "desc" } });
  let skipReason = null;
  if (automation.status !== "ACTIVE" || (automation.startsAt && automation.startsAt > now) || (automation.endsAt && automation.endsAt < now)) skipReason = "Regra inativa ou fora da vigência.";
  else if (input.depth > automation.maxDepth) skipReason = "Profundidade máxima excedida.";
  else if (automation.executionLimit && recentCount >= automation.executionLimit) skipReason = "Limite de execução atingido.";
  else if (last && automation.cooldownSeconds > 0 && now.getTime() - last.createdAt.getTime() < automation.cooldownSeconds * 1000) skipReason = "Automação em cooldown.";
  else if (!automation.allowSelfTrigger && input.origin === `AUTOMATION:${automation.id}`) skipReason = "Loop da própria automação bloqueado.";
  const payload = sanitizeAutomationPayload(input.payload);
  const run = await prisma.operationAutomationRun.create({ data: {
    companyId: automation.companyId, automationId: automation.id, event: input.event || automation.event,
    payload, status: skipReason ? "SKIPPED" : "RUNNING", attempt: input.attempt || 1,
    requestId: input.requestId || randomUUID(), correlationId: input.correlationId || randomUUID(),
    causationId: input.causationId, depth: input.depth, idempotencyKey: input.idempotencyKey,
    origin: input.origin, userId, startedAt: skipReason ? null : now,
    ...(skipReason ? { error: skipReason, completedAt: now, finishedAt: now, durationMs: 0 } : {}),
  } });
  if (skipReason) return run;
  const evaluation = evaluateAutomation(automation, payload);
  if (!evaluation.matched) return prisma.operationAutomationRun.update({ where: { id: run.id }, data: { evaluation, status: "SKIPPED", completedAt: new Date(), finishedAt: new Date(), durationMs: Date.now() - now.getTime() } });
  const executed = [], skipped = [], blocked = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const action of automation.actions) {
        if (sensitiveActions.has(action.type)) {
          const authorized = input.confirmSensitive && action.safetyClassification === "SAFE_CONFIRMED" && Boolean(action.idempotencyKey);
          if (!authorized) { blocked.push({ type: action.type, reason: "Ação sensível exige confirmação, classificação segura e idempotencyKey." }); continue; }
          blocked.push({ type: action.type, reason: "Ação sensível encaminhada para confirmação humana; execução automática indisponível." });
          continue;
        }
        const result = await executeSafeAction(tx, automation, run, action);
        (result.status === "SKIPPED" ? skipped : executed).push(result);
      }
      await tx.auditLog.create({ data: { companyId: automation.companyId, userId, action: "operation.automation.executed", entityType: "OperationAutomationRun", entityId: run.id, metadata: { automationId: automation.id, event: run.event, executed, skipped, blocked } } });
    });
    const status = blocked.length || skipped.length ? executed.length ? "PARTIAL" : "SKIPPED" : "COMPLETED";
    return prisma.operationAutomationRun.update({ where: { id: run.id }, data: { evaluation, executedActions: executed, skippedActions: skipped, blockedActions: blocked, status, completedAt: new Date(), finishedAt: new Date(), durationMs: Date.now() - now.getTime() } });
  } catch (error) {
    return prisma.operationAutomationRun.update({ where: { id: run.id }, data: { evaluation, executedActions: executed, skippedActions: skipped, blockedActions: blocked, status: "FAILED", error: error instanceof Error ? error.message : "Falha segura", completedAt: new Date(), finishedAt: new Date(), durationMs: Date.now() - now.getTime() } });
  }
};
export const cancelAutomationRun = async (companyId, id) => {
  const run = await prisma.operationAutomationRun.findFirst({ where: { id, companyId } });
  if (!run) throw inventoryConflict("Execução não encontrada.");
  if (!["QUEUED","RUNNING"].includes(run.status)) throw inventoryConflict("Execução não pode mais ser cancelada.");
  return prisma.operationAutomationRun.update({ where: { id }, data: { status: "CANCELED", completedAt: new Date(), finishedAt: new Date() } });
};
