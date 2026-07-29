import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import * as repo from "./fiscal-ai.repository.js";
import { askFiscalAi, fiscalAiProviderStatus } from "./fiscal-ai.provider.js";

export function classifyIssue(issue) {
  if (issue.autoCorrectAvailable && issue.severity !== "CRITICAL") return "AUTO_SAFE";
  if (issue.autoCorrectValue) return "AUTO_CONFIRM";
  if (issue.severity === "INFO" || issue.severity === "ALERT") return "MANUAL_GUIDED";
  return "ACCOUNTANT_REVIEW";
}

const risk = (severity) => severity === "CRITICAL" ? "CRITICAL" : severity === "ERROR" ? "HIGH" : severity === "ALERT" ? "MEDIUM" : "LOW";

export async function autopilot(companyId) {
  const facts = await repo.fiscalFacts(companyId);
  const issues = facts.issues.map((item) => ({
    id: item.id, code: item.code, title: item.description, description: item.howToFix || item.impact || item.description,
    type: classifyIssue(item), riskLevel: risk(item.severity), status: "OPEN", responsible: "FISCAL_AI",
    financialImpact: 0, confidence: item.autoCorrectAvailable ? 95 : 70, ruleReference: item.baseLegal,
    createdAt: item.createdAt, relatedEntityIds: [item.validationResult.nfeDocumentId],
    autoFixAction: item.autoCorrectAvailable ? `Aplicar ${item.autoCorrectValue || "correção validada"}` : undefined,
  }));
  const groups = ["AUTO_SAFE", "AUTO_CONFIRM", "MANUAL_GUIDED", "ACCOUNTANT_REVIEW"].map((type) => ({
    type, label: type, items: issues.filter((i) => i.type === type), count: issues.filter((i) => i.type === type).length,
  })).filter((group) => group.count);
  const history = await repo.audits(companyId, "FISCAL_AI_ISSUE");
  return {
    summary: {
      totalIssues: issues.length, autoSafeCount: issues.filter((i) => i.type === "AUTO_SAFE").length,
      needsConfirmationCount: issues.filter((i) => i.type === "AUTO_CONFIRM").length,
      needsAccountantCount: issues.filter((i) => i.type === "ACCOUNTANT_REVIEW").length,
      financialImpact: 0, fiscalScore: calculateScore(facts).score, correctionsApplied: history.filter((h) => h.action === "FISCAL_AI_AUTO_SAFE").length,
    },
    categories: groups, issues,
    recentCorrections: history.map((h) => ({ id: h.id, action: h.action, entity: h.metadata?.issueCode || "Ocorrência fiscal", timestamp: h.createdAt, type: h.metadata?.classification || "", status: h.metadata?.after || "RECORDED" })),
  };
}

export async function act({ companyId, userId, body, request }) {
  const results = [];
  for (const id of body.issueIds) {
    const issue = await repo.findIssue(companyId, id);
    if (!issue && ["AUTO_SAFE", "AUTO_CONFIRM"].includes(body.action)) throw new AppError("Ocorrência não encontrada.", "ISSUE_NOT_FOUND", 404);
    const classification = issue ? classifyIssue(issue) : "MANUAL_GUIDED";
    if (body.action === "AUTO_SAFE" && classification !== "AUTO_SAFE") throw new AppError("Correção automática não é segura para esta ocorrência.", "UNSAFE_AUTO_FIX", 409);
    if (issue && ["AUTO_SAFE", "AUTO_CONFIRM"].includes(body.action)) await repo.resolveIssue(companyId, id);
    await repo.audit({ companyId, userId, action: `FISCAL_AI_${body.action}`, entityType: "FISCAL_AI_ISSUE", entityId: id, ipAddress: request.ip, userAgent: request.get("user-agent"), metadata: { issueCode: issue?.code || "RADAR_OCCURRENCE", classification, before: { resolved: issue?.resolved || false }, after: { resolved: Boolean(issue && ["AUTO_SAFE", "AUTO_CONFIRM"].includes(body.action)) }, justification: body.justification || null, assignee: body.assignee || null } });
    results.push({ id, status: body.action });
  }
  return { success: results.length, failed: 0, data: results };
}

export function calculateScore(facts) {
  const certificateOk = Boolean(facts.certificate && facts.certificate.validUntil > new Date());
  const closingOk = Boolean(facts.closing && /APPROVED|CLOSED|CONCLUIDO/i.test(facts.closing.status));
  const components = [
    { id: "validations", label: "Validações fiscais", weight: 25, penalty: Math.min(25, facts.issues.length * 3), evidence: `${facts.issues.length} validações pendentes` },
    { id: "pendencies", label: "Pendências", weight: 15, penalty: Math.min(15, facts.alerts.length * 2), evidence: `${facts.alerts.length} alertas abertos` },
    { id: "certificate", label: "Certificado", weight: 15, penalty: certificateOk ? 0 : 15, evidence: certificateOk ? "Certificado válido" : "Certificado ausente ou vencido" },
    { id: "registrations", label: "Cadastros", weight: 15, penalty: Math.min(15, facts.products.length), evidence: `${facts.products.length} produtos incompletos` },
    { id: "closing", label: "Fechamento", weight: 15, penalty: closingOk ? 0 : 15, evidence: closingOk ? "Último fechamento concluído" : "Fechamento pendente" },
    { id: "rules", label: "Regras fiscais", weight: 15, penalty: facts.rules ? 0 : 15, evidence: `${facts.rules} regras ativas` },
  ];
  const score100 = Math.max(0, 100 - components.reduce((sum, item) => sum + item.penalty, 0));
  return { score: score100 * 10, score100, components, riskLevel: score100 >= 80 ? "LOW" : score100 >= 60 ? "MEDIUM" : score100 >= 40 ? "HIGH" : "CRITICAL" };
}

export async function score(companyId) {
  const facts = await repo.fiscalFacts(companyId);
  const result = calculateScore(facts);
  const items = result.components.map((c) => ({ id: c.id, label: c.label, weight: c.weight, status: c.penalty === 0 ? "OK" : c.penalty < c.weight ? "WARNING" : "ERROR", details: c.evidence }));
  return { ...result, closingScore: facts.closing ? Math.max(0, 100 - (facts.closing.pendingCount || 0) * 5) : 0, closingPeriod: facts.closing ? `${facts.closing.periodMonth}/${facts.closing.periodYear}` : "", items, evolution: [], positivePoints: items.filter((i) => i.status === "OK").map((i) => i.label), risks: items.filter((i) => i.status !== "OK").map((i) => i.details), criticalPendencies: items.filter((i) => i.status === "ERROR").map((i) => i.details), recommendedActions: items.filter((i) => i.status !== "OK").map((i) => `Revisar ${i.label.toLowerCase()}`) };
}

export async function radar(companyId, query) {
  const facts = await repo.fiscalFacts(companyId);
  const alerts = [
    ...facts.issues.map((i) => ({ id: i.id, title: i.description, description: i.howToFix || i.impact || i.description, riskLevel: risk(i.severity), estimatedImpact: 0, category: "DOCUMENT", actions: classifyIssue(i) === "AUTO_SAFE" ? ["AUTO_FIX"] : ["SEND_TO_ACCOUNTANT"], createdAt: i.createdAt })),
    ...(facts.certificate && facts.certificate.validUntil <= facts.certificateLimit ? [{ id: facts.certificate.id, title: "Certificado vencendo", description: `Validade: ${facts.certificate.validUntil.toISOString()}`, riskLevel: facts.certificate.validUntil < new Date() ? "CRITICAL" : "HIGH", estimatedImpact: 0, category: "CERTIFICATE", actions: ["SEND_TO_ACCOUNTANT"], createdAt: facts.certificate.updatedAt }] : []),
    ...facts.syncFailures.map((s) => ({ id: s.id, title: "Falha de sincronização", description: s.errorMessage || "Integração requer atenção", riskLevel: "HIGH", estimatedImpact: 0, category: "DOCUMENT", actions: ["SEND_TO_ACCOUNTANT"], createdAt: s.createdAt })),
  ];
  return alerts.filter((a) => (!query.riskLevel || a.riskLevel === query.riskLevel) && (!query.category || a.category === query.category));
}

export async function chat(companyId, userId, body, request) {
  const conversationId = body.conversationId || crypto.randomUUID();
  const [context, conversationHistory] = await Promise.all([
    repo.fiscalFacts(companyId),
    repo.conversationHistory(companyId, body.conversationId),
  ]);
  const result = await askFiscalAi({
    message: body.message,
    facts: context,
    hasDocumentContext: Boolean(body.documentId),
    conversationHistory,
  });
  if (!result.configured) return result;
  await repo.audit({
    companyId,
    userId,
    action: "FISCAL_AI_CHAT_MESSAGE",
    entityType: "FISCAL_AI_CHAT",
    ipAddress: request.ip,
    userAgent: request.get("user-agent"),
    metadata: {
      conversationId,
      documentId: body.documentId || null,
      question: body.message,
      answer: result.answer,
      provider: result.provider,
      knowledgeBaseUsed: result.knowledgeBaseUsed,
      sources: result.sources,
    },
  });
  return { ...result, conversationId, suggestions: [], actions: [] };
}

export const providerStatus = () => fiscalAiProviderStatus();
