import { Router } from "express";
import { z } from "zod";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  approveMonthlyClosing,
  calculateMonthlyClosing,
  getMonthlyClosing,
  listMonthlyClosings,
  reopenMonthlyClosing,
} from "../../services/monthly-tax-closing.service.js";
import { createXlsx } from "../../services/xlsx-export.service.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

const periodSchema = z.object({
  periodYear: z.coerce.number().int().min(2006).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
});

function rows(closing) {
  return [
    ["tipo", "fonte", "chave", "valor", "tributos"],
    ...closing.items.map((item) => [
      item.category,
      item.source,
      item.accessKey || "",
      item.amount,
      item.taxAmount,
    ]),
  ];
}

export const monthlyClosingRouter = Router({ mergeParams: true });

monthlyClosingRouter.post(
  "/",
  validate(periodSchema),
  asyncHandler(async (request, response) => {
    const closing = await calculateMonthlyClosing(
      request.company.id,
      request.body.periodYear,
      request.body.periodMonth,
    );
    await writeAudit({
      request,
      action: "monthly_closing.generated",
      companyId: request.company.id,
      entityType: "MonthlyTaxClosing",
      entityId: closing.id,
      metadata: {
        periodYear: closing.periodYear,
        periodMonth: closing.periodMonth,
        includedDocuments: closing.includedDocuments,
        ignoredDocuments: closing.ignoredDocuments,
      },
    });
    sendSuccess(response, closing, 201);
  }),
);

monthlyClosingRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    sendSuccess(response, await listMonthlyClosings(request.company.id, request.query));
  }),
);

monthlyClosingRouter.get(
  "/:closingId",
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await getMonthlyClosing(request.company.id, request.params.closingId),
    );
  }),
);

monthlyClosingRouter.post(
  "/:closingId/recalculate",
  asyncHandler(async (request, response) => {
    const current = await getMonthlyClosing(
      request.company.id,
      request.params.closingId,
    );
    sendSuccess(
      response,
      await calculateMonthlyClosing(
        request.company.id,
        current.periodYear,
        current.periodMonth,
      ),
    );
  }),
);

monthlyClosingRouter.post(
  "/:closingId/approve",
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await approveMonthlyClosing(request.company.id, request.params.closingId, { userId: request.user.id, note: request.body?.note }),
    );
  }),
);

monthlyClosingRouter.post(
  "/:closingId/reopen",
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await reopenMonthlyClosing(request.company.id, request.params.closingId, { userId: request.user.id, reason: request.body?.reason }),
    );
  }),
);

monthlyClosingRouter.get(
  "/:closingId/export-csv",
  asyncHandler(async (request, response) => {
    const closing = await getMonthlyClosing(
      request.company.id,
      request.params.closingId,
    );
    const csv = rows(closing)
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n");
    response
      .type("text/csv")
      .attachment(`fechamento-${closing.periodYear}-${closing.periodMonth}.csv`)
      .send(`\uFEFF${csv}`);
  }),
);

monthlyClosingRouter.get(
  "/:closingId/export-xlsx",
  asyncHandler(async (request, response) => {
    const closing = await getMonthlyClosing(
      request.company.id,
      request.params.closingId,
    );
    response
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment(`fechamento-${closing.periodYear}-${closing.periodMonth}.xlsx`)
      .send(createXlsx(rows(closing), "Fechamento fiscal"));
  }),
);
