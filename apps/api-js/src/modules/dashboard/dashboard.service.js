import { prisma } from "../../config/prisma.js";
import { remember } from "../../utils/cache.js";
import { CLOSING_SOURCES, closingPeriod } from "../../services/fiscal-summary.service.js";

function decimalToNumber(value) {
  return value == null ? 0 : Number(value);
}

export function getSummary(companyId) {
  return remember(`dashboard:${companyId}:summary`, 60_000, async () => {
    const [documents, fullXml, cancelled, openAlerts, total] = await Promise.all([
      prisma.fiscalDocument.count({ where: { companyId } }),
      prisma.fiscalDocument.count({ where: { companyId, isSummary: false } }),
      prisma.fiscalDocument.count({ where: { companyId, isCancelled: true } }),
      prisma.alert.count({ where: { companyId, status: { in: ["open", "unread"] } } }),
      prisma.fiscalDocument.aggregate({
        where: { companyId },
        _sum: { totalAmount: true },
      }),
    ]);
    return {
      documents,
      totalAmount: decimalToNumber(total._sum.totalAmount),
      fullXml,
      summaryXml: documents - fullXml,
      cancelled,
      openAlerts,
    };
  });
}

export function getMonthlyFlow(companyId) {
  return remember(`dashboard:${companyId}:monthly`, 60_000, async () => {
    const from = new Date();
    from.setMonth(from.getMonth() - 5, 1);
    from.setHours(0, 0, 0, 0);
    const documents = await prisma.fiscalDocument.findMany({
      where: { companyId, emissionDate: { gte: from } },
      select: { emissionDate: true, totalAmount: true },
      orderBy: { emissionDate: "asc" },
    });
    const months = new Map();
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.set(key, {
        month: new Intl.DateTimeFormat("pt-BR", { month: "short" })
          .format(date)
          .replace(".", ""),
        documents: 0,
        totalAmount: 0,
      });
    }
    for (const document of documents) {
      if (!document.emissionDate) continue;
      const key = `${document.emissionDate.getFullYear()}-${String(
        document.emissionDate.getMonth() + 1,
      ).padStart(2, "0")}`;
      const item = months.get(key);
      if (item) {
        item.documents += 1;
        item.totalAmount += decimalToNumber(document.totalAmount);
      }
    }
    return { data: [...months.values()] };
  });
}

export function getXmlDistribution(companyId) {
  return remember(`dashboard:${companyId}:xml`, 60_000, async () => {
    const [full, summary] = await Promise.all([
      prisma.fiscalDocument.count({ where: { companyId, isSummary: false } }),
      prisma.fiscalDocument.count({ where: { companyId, isSummary: true } }),
    ]);
    const total = full + summary;
    return {
      data: [
        { name: "XML completo", value: full, percentage: total ? (full / total) * 100 : 0 },
        { name: "Resumo", value: summary, percentage: total ? (summary / total) * 100 : 0 },
      ],
    };
  });
}

export function getTopSuppliers(companyId) {
  return remember(`dashboard:${companyId}:suppliers`, 60_000, async () => {
    const groups = await prisma.fiscalDocument.groupBy({
      by: ["issuerCnpj", "issuerName"],
      where: { companyId },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 8,
    });
    return {
      data: groups.map((item) => ({
        issuerCnpj: item.issuerCnpj,
        issuerName: item.issuerName,
        documents: item._count.id,
        totalAmount: decimalToNumber(item._sum.totalAmount),
      })),
    };
  });
}

export async function getLatestDocuments(companyId) {
  const data = await prisma.fiscalDocument.findMany({
    where: { companyId },
    select: {
      id: true,
      accessKey: true,
      invoiceNumber: true,
      issuerName: true,
      issuerCnpj: true,
      emissionDate: true,
      totalAmount: true,
      status: true,
      isSummary: true,
      isCancelled: true,
      manifestationStatus: true,
    },
    orderBy: { emissionDate: "desc" },
    take: 6,
  });
  return {
    data: data.map((item) => ({
      ...item,
      totalAmount: decimalToNumber(item.totalAmount),
      xmlType: item.isSummary ? "SUMMARY" : "FULL",
    })),
  };
}

function currentPeriod(query = {}) {
  const now = new Date();
  const year = Number(query.periodYear || now.getFullYear());
  const month = Number(query.periodMonth || now.getMonth() + 1);
  return { year, month, range: closingPeriod(year, month) };
}

async function fiscalDocuments(companyId, query = {}) {
  const period = currentPeriod(query);
  const documents = await prisma.fiscalDocument.findMany({
    where: {
      companyId,
      source: { in: CLOSING_SOURCES },
      emissionDate: period.range,
    },
    select: {
      documentType: true,
      operationDirection: true,
      totalAmount: true,
      freightAmount: true,
      icmsAmount: true,
      ipiAmount: true,
      pisAmount: true,
      cofinsAmount: true,
      taxAmount: true,
      isCancelled: true,
      isSummary: true,
    },
  });
  return { period, documents };
}

export async function getFiscalSummary(companyId, query = {}) {
  const { period, documents } = await fiscalDocuments(companyId, query);
  const active = documents.filter((item) => !item.isCancelled);
  const inbound = active.filter((item) => item.operationDirection === "INBOUND");
  const outbound = active.filter((item) => item.operationDirection === "OUTBOUND");
  const cteInbound = active.filter(
    (item) =>
      item.documentType === "CTE" &&
      item.operationDirection === "TRANSPORT_INBOUND",
  );
  const cteOutbound = active.filter(
    (item) =>
      item.documentType === "CTE" &&
      item.operationDirection === "TRANSPORT_OUTBOUND",
  );
  const total = (items, field = "totalAmount") =>
    items.reduce((sum, item) => sum + decimalToNumber(item[field]), 0);
  return {
    periodYear: period.year,
    periodMonth: period.month,
    inbound: { count: inbound.length, total: total(inbound) },
    outbound: { count: outbound.length, total: total(outbound) },
    cteInbound: { count: cteInbound.length, total: total(cteInbound, "freightAmount") },
    cteOutbound: { count: cteOutbound.length, total: total(cteOutbound, "freightAmount") },
    cancelled: documents.filter((item) => item.isCancelled).length,
    missingFullXml: documents.filter((item) => item.isSummary).length,
    estimatedTax: total(active, "taxAmount"),
  };
}

export async function getTaxSummary(companyId, query = {}) {
  const { period, documents } = await fiscalDocuments(companyId, query);
  const active = documents.filter((item) => !item.isCancelled);
  const sum = (field) =>
    active.reduce((total, item) => total + decimalToNumber(item[field]), 0);
  const data = [
    { name: "ICMS", value: sum("icmsAmount"), color: "#50d86b" },
    { name: "IPI", value: sum("ipiAmount"), color: "#3b82f6" },
    { name: "PIS", value: sum("pisAmount"), color: "#8b5cf6" },
    { name: "COFINS", value: sum("cofinsAmount"), color: "#f97316" },
  ];
  return {
    periodYear: period.year,
    periodMonth: period.month,
    total: data.reduce((sum, item) => sum + item.value, 0),
    data,
    definitive: false,
  };
}

export async function getFiscalMonthlyFlow(companyId) {
  const from = new Date();
  from.setMonth(from.getMonth() - 5, 1);
  from.setHours(0, 0, 0, 0);
  const documents = await prisma.fiscalDocument.findMany({
    where: {
      companyId,
      source: { in: CLOSING_SOURCES },
      emissionDate: { gte: from },
      isCancelled: false,
    },
    select: { emissionDate: true, totalAmount: true, operationDirection: true },
  });
  const months = new Map();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, {
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" })
        .format(date)
        .replace(".", ""),
      inbound: 0,
      outbound: 0,
    });
  }
  for (const document of documents) {
    if (!document.emissionDate) continue;
    const key = `${document.emissionDate.getFullYear()}-${String(
      document.emissionDate.getMonth() + 1,
    ).padStart(2, "0")}`;
    const item = months.get(key);
    if (!item) continue;
    if (document.operationDirection === "INBOUND") {
      item.inbound += decimalToNumber(document.totalAmount);
    }
    if (document.operationDirection === "OUTBOUND") {
      item.outbound += decimalToNumber(document.totalAmount);
    }
  }
  return { data: [...months.values()] };
}
