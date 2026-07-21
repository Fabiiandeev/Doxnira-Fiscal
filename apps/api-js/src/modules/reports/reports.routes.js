import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import {
  CLOSING_SOURCES,
  IGNORED_CLOSING_SOURCES,
  closingPeriod,
  decimal,
} from "../../services/fiscal-summary.service.js";
import { listMonthlyClosings } from "../../services/monthly-tax-closing.service.js";
import { createXlsx } from "../../services/xlsx-export.service.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { requireSubscriptionFeature } from "../subscription/subscription-gates.middleware.js";

function periodFromQuery(query) {
  const now = new Date();
  const year = Number(query.periodYear || now.getFullYear());
  const month = Number(query.periodMonth || now.getMonth() + 1);
  return { year, month, range: closingPeriod(year, month) };
}

async function accountingData(companyId, query) {
  const period = periodFromQuery(query);
  const documents = await prisma.fiscalDocument.findMany({
    where: {
      companyId,
      source: { in: CLOSING_SOURCES },
      emissionDate: period.range,
    },
    select: {
      documentType: true,
      operationDirection: true,
      source: true,
      accessKey: true,
      invoiceNumber: true,
      emissionDate: true,
      totalAmount: true,
      taxAmount: true,
      status: true,
      isCancelled: true,
      isSummary: true,
      _count: { select: { transportLinks: true } },
    },
    orderBy: { emissionDate: "asc" },
  });
  const ignoredDocuments = await prisma.fiscalDocument.count({
    where: {
      companyId,
      source: { in: IGNORED_CLOSING_SOURCES },
      emissionDate: period.range,
    },
  });
  const totals = documents.reduce(
    (result, item) => {
      const amount = decimal(item.totalAmount);
      if (item.operationDirection === "INBOUND") result.inbound += amount;
      if (item.operationDirection === "OUTBOUND") result.outbound += amount;
      if (item.documentType === "CTE") result.freight += amount;
      result.taxes += decimal(item.taxAmount);
      if (item.isCancelled) result.cancelled += 1;
      if (item.isSummary) result.missingXml += 1;
      if (item._count.transportLinks) result.linkedCte += 1;
      return result;
    },
    {
      inbound: 0,
      outbound: 0,
      freight: 0,
      taxes: 0,
      cancelled: 0,
      missingXml: 0,
      linkedCte: 0,
    },
  );
  return {
    periodYear: period.year,
    periodMonth: period.month,
    totals,
    ignoredDocuments,
    documents: documents.map((item) => ({
      ...item,
      totalAmount: decimal(item.totalAmount),
      taxAmount: decimal(item.taxAmount),
    })),
  };
}

function reportRows(data) {
  return [
    ["tipo", "operacao", "fonte", "numero", "chave", "emissao", "valor", "tributos", "status"],
    ...data.documents.map((document) => [
      document.documentType,
      document.operationDirection,
      document.source,
      document.invoiceNumber || "",
      document.accessKey || "",
      document.emissionDate?.toISOString() || "",
      document.totalAmount,
      document.taxAmount,
      document.status || "",
    ]),
  ];
}

export const reportsRouter = Router({ mergeParams: true });

reportsRouter.get(
  "/accounting-summary",
  asyncHandler(async (request, response) => {
    sendSuccess(response, await accountingData(request.company.id, request.query));
  }),
);

reportsRouter.get(
  "/tax-closing",
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await listMonthlyClosings(request.company.id, request.query),
    );
  }),
);

reportsRouter.get(
  "/export-csv",
  requireSubscriptionFeature("exports.advanced"),
  asyncHandler(async (request, response) => {
    const data = await accountingData(request.company.id, request.query);
    const csv = reportRows(data)
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n");
    response
      .type("text/csv")
      .attachment(`relatorio-contabil-${data.periodYear}-${data.periodMonth}.csv`)
      .send(`\uFEFF${csv}`);
  }),
);

reportsRouter.get(
  "/export-xlsx",
  requireSubscriptionFeature("exports.advanced"),
  asyncHandler(async (request, response) => {
    const data = await accountingData(request.company.id, request.query);
    response
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment(`relatorio-contabil-${data.periodYear}-${data.periodMonth}.xlsx`)
      .send(createXlsx(reportRows(data), "Relatorio contabil"));
  }),
);
