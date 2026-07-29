import { AppError } from "../../utils/app-error.js";
const transitions = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "WAITING_COMPANY", "RESOLVED", "DISMISSED"],
  ASSIGNED: ["IN_PROGRESS", "WAITING_COMPANY", "RESOLVED", "DISMISSED"],
  IN_PROGRESS: ["WAITING_COMPANY", "WAITING_ACCOUNTANT", "RESOLVED", "DISMISSED"],
  WAITING_COMPANY: ["IN_PROGRESS", "WAITING_ACCOUNTANT", "RESOLVED"],
  WAITING_ACCOUNTANT: ["IN_PROGRESS", "WAITING_COMPANY", "RESOLVED"],
  RESOLVED: ["REOPENED"], DISMISSED: ["REOPENED"], REOPENED: ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "DISMISSED"],
};
function requireReason(action, reason) {
  if (["resolve", "dismiss", "reopen", "request-information"].includes(action) && !reason?.trim()) throw new AppError("Justificativa obrigatória.", "ACCOUNTANT_QUEUE_REASON_REQUIRED", 422);
}
export async function mutateQueue(prisma, repository, scope, actorId, itemId, action, payload) {
  const item = await repository.findQueue(scope.office.id, itemId);
  if (!item || !scope.companyIds.includes(item.companyId)) throw new AppError("Ocorrência não encontrada.", "ACCOUNTANT_QUEUE_NOT_FOUND", 404);
  requireReason(action, payload.reason);
  const target = { assign: "ASSIGNED", start: "IN_PROGRESS", "request-information": "WAITING_COMPANY", resolve: "RESOLVED", dismiss: "DISMISSED", reopen: "REOPENED" }[action];
  if (target && !transitions[item.status]?.includes(target)) throw new AppError("Transição de status inválida.", "ACCOUNTANT_QUEUE_INVALID_TRANSITION", 409);
  const data = action === "change-priority" ? { priority: payload.priority } : {
    status: target, ...(action === "assign" ? { responsibleUserId: payload.responsibleUserId || actorId } : {}),
    ...(action === "resolve" ? { resolutionReason: payload.reason, resolvedAt: new Date() } : {}),
    ...(action === "dismiss" ? { dismissedReason: payload.reason, resolvedAt: new Date() } : {}),
    ...(action === "reopen" ? { reopenReason: payload.reason, resolvedAt: null } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.accountantFiscalQueueItem.update({ where: { id: item.id, officeId: scope.office.id }, data });
    await tx.auditLog.create({ data: { companyId: item.companyId, userId: actorId, action: `ACCOUNTANT_QUEUE_${action.toUpperCase().replaceAll("-", "_")}`, entityType: "AccountantFiscalQueueItem", entityId: item.id, metadata: { officeId: scope.office.id, fromStatus: item.status, toStatus: updated.status, reason: payload.reason || null } } });
    return updated;
  });
}
