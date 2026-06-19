import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

const alertSelect = {
  id: true,
  type: true,
  severity: true,
  title: true,
  message: true,
  status: true,
  readAt: true,
  resolvedAt: true,
  createdAt: true,
  fiscalDocumentId: true,
  fiscalDocument: {
    select: { id: true, accessKey: true, invoiceNumber: true, issuerName: true },
  },
};

async function findAlert(companyId, alertId) {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, companyId },
    select: alertSelect,
  });
  if (!alert) throw new AppError("Alerta não encontrado.", "ALERT_NOT_FOUND", 404);
  return alert;
}

export const alertsRouter = Router({ mergeParams: true });

alertsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, pageSize, skip, take } = getPagination(request.query, 20);
    const where = {
      companyId: request.company.id,
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(request.query.severity ? { severity: request.query.severity } : {}),
      ...(request.query.type ? { type: request.query.type } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        select: alertSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.alert.count({ where }),
    ]);
    sendSuccess(response, { data, pagination: paginationMeta(page, pageSize, total) });
  }),
);

alertsRouter.get("/:alertId", asyncHandler(async (request, response) => {
  sendSuccess(response, await findAlert(request.company.id, request.params.alertId));
}));

alertsRouter.patch(
  "/:alertId/read",
  asyncHandler(async (request, response) => {
    const alert = await findAlert(request.company.id, request.params.alertId);
    const updated = await prisma.alert.update({
      where: { id: alert.id },
      data: { readAt: new Date(), status: alert.status === "unread" ? "open" : alert.status },
      select: alertSelect,
    });
    await writeAudit({
      request,
      action: "alert.read",
      companyId: request.company.id,
      entityType: "Alert",
      entityId: alert.id,
    });
    sendSuccess(response, updated);
  }),
);

alertsRouter.patch(
  "/:alertId/resolve",
  asyncHandler(async (request, response) => {
    const alert = await findAlert(request.company.id, request.params.alertId);
    const updated = await prisma.alert.update({
      where: { id: alert.id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        readAt: alert.readAt || new Date(),
        assignedToId: request.user.id,
      },
      select: alertSelect,
    });
    await writeAudit({
      request,
      action: "alert.resolved",
      companyId: request.company.id,
      entityType: "Alert",
      entityId: alert.id,
    });
    sendSuccess(response, updated);
  }),
);

alertsRouter.patch(
  "/:alertId/reopen",
  asyncHandler(async (request, response) => {
    const alert = await findAlert(request.company.id, request.params.alertId);
    const updated = await prisma.alert.update({
      where: { id: alert.id },
      data: { status: "open", resolvedAt: null },
      select: alertSelect,
    });
    await writeAudit({
      request,
      action: "alert.reopened",
      companyId: request.company.id,
      entityType: "Alert",
      entityId: alert.id,
    });
    sendSuccess(response, updated);
  }),
);
