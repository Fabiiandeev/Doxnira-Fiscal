import { settingsErrors } from "./settings-errors.js";
const sensitive = /password|senha|token|secret|certificate|certificado|private.?key|encrypted|rawXml|xml/i;
export function sanitizeAuditPayload(value) {
  if (Array.isArray(value)) return value.map(sanitizeAuditPayload);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? "[REDACTED]" : sanitizeAuditPayload(item)]));
  return value;
}
export function assertSettingsWrite(request) {
  if (request.user.role === "VIEWER") throw settingsErrors.writeForbidden();
}
export async function updateCompanySettings(prisma, request, payload) {
  assertSettingsWrite(request);
  const current = await prisma.company.findUnique({ where: { id: request.company.id } });
  if ((payload.taxRegime && payload.taxRegime !== current.taxRegime) || (payload.environment && payload.environment !== current.environment)) {
    if (!payload.confirmCriticalChange) throw settingsErrors.confirmationRequired();
  }
  const { confirmCriticalChange: _, ...data } = payload;
  const updated = await prisma.company.update({ where: { id: request.company.id }, data });
  await prisma.auditLog.create({ data: { companyId: request.company.id, userId: request.user.id, action: "settings.company.updated", entityType: "Company", entityId: request.company.id, ipAddress: request.ip, userAgent: request.get("user-agent"), metadata: sanitizeAuditPayload({ before: current, after: updated, requestId: request.id }) } });
  return updated;
}
