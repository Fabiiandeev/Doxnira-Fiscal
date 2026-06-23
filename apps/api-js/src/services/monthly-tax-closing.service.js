import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import {
  CLOSING_SOURCES,
  IGNORED_CLOSING_SOURCES,
  closingPeriod,
  decimal,
  sumDocuments,
} from "./fiscal-summary.service.js";
import { calculateEstimatedTaxes } from "./tax-calculation.service.js";
import { getActiveTaxRules } from "./tax-rules.service.js";

const closingInclude = {
  items: { orderBy: { createdAt: "asc" } },
  warnings: { orderBy: [{ severity: "desc" }, { createdAt: "asc" }] },
};

function closingItems(closing) {
  return (closing.items || []).filter((item) => CLOSING_SOURCES.includes(item.source));
}

function serialize(closing) {
  if (!closing) return closing;
  const items = closingItems(closing);
  return {
    ...closing,
    items: items.map((item) => ({
      ...item,
      amount: decimal(item.amount),
      taxAmount: decimal(item.taxAmount),
    })),
    includedDocuments: items.length,
    inboundTotal: decimal(closing.inboundTotal),
    outboundTotal: decimal(closing.outboundTotal),
    freightTotal: decimal(closing.freightTotal),
    icmsTotal: decimal(closing.icmsTotal),
    ipiTotal: decimal(closing.ipiTotal),
    pisTotal: decimal(closing.pisTotal),
    cofinsTotal: decimal(closing.cofinsTotal),
    estimatedTaxTotal: decimal(closing.estimatedTaxTotal),
  };
}

async function buildWarnings(companyId, documents, ignoredDocuments, rules) {
  const warnings = [];
  if (ignoredDocuments > 0) {
    warnings.push({
      severity: "INFO",
      code: "TEST_DOCUMENT_IGNORED",
      message: "Documento de teste ignorado no fechamento.",
      field: "source",
      cause: "A fonte do documento é MOCK ou SEED.",
      suggestion: "Use somente documentos REAL_SEFAZ, MANUAL_IMPORT ou ERP_IMPORT no fechamento.",
      autoFix: { available: false, action: null, label: null },
      details: { ignoredDocuments },
    });
  }
  const summaryDocs = documents.filter((item) => item.isSummary);
  if (summaryDocs.length) {
    warnings.push({
      severity: "WARNING",
      code: "FULL_XML_MISSING",
      message: `${summaryDocs.length} documento(s) sem XML completo.`,
      field: "xml",
      cause: "O XML completo do documento não foi recuperado na distribuição.",
      suggestion: "Tentar reprocessar a distribuição ou solicitar o XML ao emitente.",
      autoFix: { available: false, action: null, label: null },
      details: { count: summaryDocs.length },
    });
  }
  const cancelledDocs = documents.filter((item) => item.isCancelled);
  if (cancelledDocs.length) {
    warnings.push({
      severity: "INFO",
      code: "CANCELLED_DOCUMENT",
      message: `${cancelledDocs.length} documento(s) cancelado(s) no período.`,
      field: "status",
      cause: "Documento marcado como cancelado.",
      suggestion: "Verifique se o cancelamento está correto para fins contábeis.",
      autoFix: { available: false, action: null, label: null },
      details: { count: cancelledDocs.length },
    });
  }
  const unknownDocs = documents.filter((item) => item.operationDirection === "UNKNOWN");
  if (unknownDocs.length) {
    // create one warning per document to provide documentId/accessKey
    unknownDocs.forEach((doc) => {
      warnings.push({
        severity: "WARNING",
        code: "DOCUMENT_UNKNOWN_DIRECTION",
        message: "Documento sem classificação de entrada/saída.",
        field: "operationDirection",
        cause: "O CNPJ da empresa não foi identificado como emitente, destinatário ou tomador no XML.",
        suggestion: "Revise o XML ou cadastre o vínculo correto da empresa.",
        autoFix: { available: false, action: null, label: null },
        documentId: doc.id,
        accessKey: doc.accessKey || null,
      });
    });
  }
  if (!rules.length) {
    warnings.push({
      severity: "WARNING",
      code: "TAX_RULE_MISSING",
      message:
        "Nenhuma regra tributária parametrizada. Valores destacados no XML usados somente para conferência.",
      field: "taxRules",
      cause: "Não existem regras ativas para cálculo de tributos.",
      suggestion: "Configure regras tributárias ativas para a empresa.",
      autoFix: { available: false, action: null, label: null },
      details: {},
    });
  }
  const itemIssues = await prisma.fiscalDocumentItem.count({
    where: {
      companyId,
      documentId: { in: documents.map((item) => item.id) },
      OR: [
        { ncm: null },
        { ncm: "" },
        { cfop: null },
        { cfop: "" },
        { AND: [{ cst: null }, { csosn: null }] },
      ],
    },
  });
  if (itemIssues) {
    warnings.push({
      code: "FISCAL_ITEM_INCOMPLETE",
      severity: "WARNING",
      message: `${itemIssues} item(ns) sem NCM, CFOP ou CST/CSOSN completo.`,
      details: { count: itemIssues },
    });
  }
  const cteKeys = documents
    .filter((item) => item.documentType === "CTE")
    .map((item) => item.accessKey)
    .filter(Boolean);
  if (cteKeys.length) {
    const linked = await prisma.fiscalDocumentLink.findMany({
      where: { companyId, cteAccessKey: { in: cteKeys } },
      select: { cteAccessKey: true },
      distinct: ["cteAccessKey"],
    });
    const unlinked = cteKeys.length - linked.length;
    if (unlinked > 0) {
      warnings.push({
        code: "CTE_WITHOUT_NFE",
        severity: "WARNING",
        message: `${unlinked} CT-e(s) sem NF-e vinculada.`,
        details: { count: unlinked },
      });
    }
  }
  return warnings;
}

export async function calculateMonthlyClosing(companyId, year, month) {
  const [company, settings] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        stateRegistration: true,
        stateRegistrationStatus: true,
        icmsContributorStatus: true,
      },
    }),
    prisma.companyTaxSetting.findUnique({ where: { companyId } }),
  ]);
  if (!settings) {
    throw new AppError(
      "Configure os dados fiscais da empresa antes de gerar o fechamento.",
      "TAX_SETTINGS_REQUIRED",
      422,
    );
  }
  if (
    company?.stateRegistration &&
    (company.stateRegistrationStatus === "PENDENTE_VALIDACAO_SEFAZ" ||
      company.icmsContributorStatus === "PENDENTE_VALIDACAO_SEFAZ")
  ) {
    throw new AppError(
      "A Inscrição Estadual precisa ser validada na SEFAZ/SINTEGRA antes de gerar o fechamento fiscal.",
      "STATE_REGISTRATION_VALIDATION_REQUIRED",
      422,
    );
  }
  const period = closingPeriod(year, month);
  const [documents, ignoredDocuments, rules] = await Promise.all([
    prisma.fiscalDocument.findMany({
      where: {
        companyId,
        source: { in: CLOSING_SOURCES },
        emissionDate: period,
      },
      include: { items: true },
      orderBy: { emissionDate: "asc" },
    }),
    prisma.fiscalDocument.count({
      where: {
        companyId,
        source: { in: IGNORED_CLOSING_SOURCES },
        emissionDate: period,
      },
    }),
    getActiveTaxRules(companyId, period.lt),
  ]);
  const warnings = await buildWarnings(companyId, documents, ignoredDocuments, rules);
  const active = documents.filter((document) => !document.isCancelled);
  const inbound = active.filter((item) => item.operationDirection === "INBOUND");
  const outbound = active.filter((item) => item.operationDirection === "OUTBOUND");
  const cteInbound = active.filter((item) => item.operationDirection === "TRANSPORT_INBOUND");
  const cteOutbound = active.filter((item) => item.operationDirection === "TRANSPORT_OUTBOUND");
  const cteUnknown = active.filter((item) => item.documentType === "CTE" && item.operationDirection === "UNKNOWN");
  const knownForTaxes = active.filter((item) => item.operationDirection !== "UNKNOWN");
  const taxes = calculateEstimatedTaxes(knownForTaxes, settings, rules);
  const totals = {
    inboundTotal: sumDocuments(inbound, "totalAmount"),
    outboundTotal: sumDocuments(outbound, "totalAmount"),
    freightTotal: sumDocuments([...cteInbound, ...cteOutbound], "freightAmount"),
    icmsTotal: taxes.highlighted.icms,
    ipiTotal: taxes.highlighted.ipi,
    pisTotal: taxes.highlighted.pis,
    cofinsTotal: taxes.highlighted.cofins,
    estimatedTaxTotal: taxes.estimatedTotal,
  };
  const closing = await prisma.monthlyTaxClosing.upsert({
    where: {
      companyId_periodYear_periodMonth: {
        companyId,
        periodYear: year,
        periodMonth: month,
      },
    },
    create: {
      companyId,
      periodYear: year,
      periodMonth: month,
      status: "PROCESSING",
    },
    update: { status: "PROCESSING", approvedAt: null },
  });
  await prisma.$transaction([
    prisma.monthlyTaxClosingItem.deleteMany({ where: { closingId: closing.id } }),
    prisma.monthlyTaxClosingWarning.deleteMany({ where: { closingId: closing.id } }),
    prisma.monthlyTaxClosing.update({
      where: { id: closing.id },
      data: {
        ...totals,
        status: "READY_FOR_REVIEW",
        includedDocuments: documents.length,
        ignoredDocuments,
        snapshot: {
          generatedAt: new Date().toISOString(),
          allowedSources: CLOSING_SOURCES,
          taxSettings: {
            taxRegime: settings.taxRegime,
            calculationRegime: settings.calculationRegime,
            simplesAnnex: settings.simplesAnnex,
          },
          directionCounts: {
            nfeInbound: inbound.length,
            nfeOutbound: outbound.length,
            cteInbound: cteInbound.length,
            cteOutbound: cteOutbound.length,
            cteUnknown: cteUnknown.length,
            unknown: active.filter((item) => item.operationDirection === "UNKNOWN").length,
          },
          taxes,
        },
      },
    }),
    ...(documents.length
      ? [
          prisma.monthlyTaxClosingItem.createMany({
            data: documents.map((document) => ({
              closingId: closing.id,
              documentId: document.id,
              category: document.operationDirection,
              source: document.source,
              accessKey: document.accessKey,
              amount: document.totalAmount || 0,
              taxAmount: document.taxAmount || 0,
              snapshot: {
                documentType: document.documentType,
                number: document.invoiceNumber,
                emissionDate: document.emissionDate,
                cancelled: document.isCancelled,
              },
            })),
          }),
        ]
      : []),
    ...(warnings.length
      ? [
          prisma.monthlyTaxClosingWarning.createMany({
            data: warnings.map((warning) => ({ closingId: closing.id, ...warning })),
          }),
        ]
      : []),
  ]);
  return getMonthlyClosing(companyId, closing.id);
}

export async function listMonthlyClosings(companyId, query = {}) {
  const data = await prisma.monthlyTaxClosing.findMany({
    where: {
      companyId,
      ...(query.periodYear ? { periodYear: Number(query.periodYear) } : {}),
      ...(query.periodMonth ? { periodMonth: Number(query.periodMonth) } : {}),
    },
    include: {
      ...closingInclude,
      _count: { select: { warnings: true, items: true } },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
  return { data: data.map(serialize) };
}

export async function getMonthlyClosing(companyId, closingId) {
  const closing = await prisma.monthlyTaxClosing.findFirst({
    where: { id: closingId, companyId },
    include: closingInclude,
  });
  if (!closing) {
    throw new AppError("Fechamento mensal não encontrado.", "MONTHLY_CLOSING_NOT_FOUND", 404);
  }
  return serialize(closing);
}

export async function approveMonthlyClosing(companyId, closingId) {
  await getMonthlyClosing(companyId, closingId);
  return serialize(
    await prisma.monthlyTaxClosing.update({
      where: { id: closingId },
      data: { status: "APPROVED", approvedAt: new Date() },
      include: closingInclude,
    }),
  );
}

export async function reopenMonthlyClosing(companyId, closingId) {
  await getMonthlyClosing(companyId, closingId);
  return serialize(
    await prisma.monthlyTaxClosing.update({
      where: { id: closingId },
      data: { status: "REOPENED", approvedAt: null },
      include: closingInclude,
    }),
  );
}
