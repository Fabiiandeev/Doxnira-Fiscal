import { prisma } from "../../config/prisma.js";

const sensitive = /token|secret|password|senha|credential|certificate|certificado|authorization/i;
export function sanitizeAuditPayload(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toJSON === "function") return sanitizeAuditPayload(value.toJSON());
  if (Array.isArray(value)) return value.map(sanitizeAuditPayload);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,sensitive.test(key)?"[REDACTED]":sanitizeAuditPayload(item)]));
  return value;
}

export async function writeAudit({
  request,
  action,
  companyId = null,
  entityType = null,
  entityId = null,
  metadata = undefined,
  userId = request?.user?.id || null,
  client = prisma,
  origin = "API",
  correlationId = request?.id || null,
  idempotencyKey = request?.get?.("idempotency-key") || null,
  beforeState = undefined,
  afterState = undefined,
  justification = null,
  documentId = null,
}) {
  return client.auditLog.create({
    data: {
      action,
      companyId,
      userId,
      entityType,
      entityId,
      ipAddress: request?.ip || null,
      userAgent: request?.get?.("user-agent") || null,
      metadata: sanitizeAuditPayload(metadata),
      origin,
      correlationId,
      idempotencyKey,
      beforeState: sanitizeAuditPayload(beforeState),
      afterState: sanitizeAuditPayload(afterState),
      justification,
      documentId,
    },
  });
}

export async function writeFinancialAudit({client,request,action,companyId,entityType,entityId,beforeState,afterState,justification=null,metadata,origin="FINANCIAL_API",idempotencyKey=null}) {
  const correlationId=request?.id;
  const safeBefore=sanitizeAuditPayload(beforeState),safeAfter=sanitizeAuditPayload(afterState),safeMetadata=sanitizeAuditPayload(metadata);
  const event=await client.financialEvent.create({data:{companyId,userId:request?.user?.id||null,entityType,entityId,action,origin,correlationId,idempotencyKey:idempotencyKey||request?.get?.("idempotency-key")||null,beforeState:safeBefore,afterState:safeAfter,justification,metadata:safeMetadata}});
  const audit=await writeAudit({client,request,action:`financial.${action}`,companyId,entityType,entityId,beforeState:safeBefore,afterState:safeAfter,justification,metadata:{...safeMetadata,financialEventId:event.id},origin,correlationId,idempotencyKey});
  return {event,audit};
}
