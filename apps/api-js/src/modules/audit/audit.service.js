import { prisma } from "../../config/prisma.js";

export async function writeAudit({
  request,
  action,
  companyId = null,
  entityType = null,
  entityId = null,
  metadata = undefined,
  userId = request?.user?.id || null,
}) {
  return prisma.auditLog.create({
    data: {
      action,
      companyId,
      userId,
      entityType,
      entityId,
      ipAddress: request?.ip || null,
      userAgent: request?.get?.("user-agent") || null,
      metadata,
    },
  });
}
