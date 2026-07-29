import { sanitizeAuditPayload } from "./settings.service.js";
export async function queryAudit(prisma, companyId, filters) {
  const where = { companyId, ...(filters.userId ? { userId: filters.userId } : {}), ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" } } : {}), ...((filters.from || filters.to) ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}) };
  const [rows, total] = await Promise.all([prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }), prisma.auditLog.count({ where })]);
  return { items: rows.map((row) => ({ ...row, metadata: sanitizeAuditPayload(row.metadata) })), pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) } };
}
