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
  events: { orderBy: { createdAt: "asc" } },
};

export function closingCategory(document) {
  if (document.documentType === "CTE") return "CT_E_ENTRADA";
  return document.operationDirection === "OUTBOUND" ? "NF_E_SAIDA" : "NF_E_ENTRADA";
}

export function isClosingEligible(document) {
  return CLOSING_SOURCES.includes(document.source) && !document.isCancelled && !["INUTILIZADO", "INUTILIZADA"].includes(String(document.status || "").toUpperCase());
}

function taxSettingsSnapshot(settings) {
  if (!settings) return null;
  return {
    taxRegime: settings.taxRegime,
    calculationRegime: settings.calculationRegime,
    uf: settings.uf,
    fiscalConfigComplete: settings.fiscalConfigComplete,
  };
}

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

export async function calculateMonthlyClosing(companyId, year, month, actor = {}) {
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
    settings ? getActiveTaxRules(companyId, period.lt) : [],
  ]);
  const excluded = documents.filter((document) => !isClosingEligible(document));
  const active = documents.filter(isClosingEligible);
  const warnings = await buildWarnings(companyId, active, ignoredDocuments + excluded.length, rules);
  if (!settings || !settings.fiscalConfigComplete) {
    warnings.push({ severity: "ERROR", code: "TAX_SETTINGS_REQUIRED", message: "A configuração tributária está ausente ou incompleta.", details: { blocking: true }, suggestion: "Complete company_tax_settings antes de aprovar o fechamento." });
  }
  const openRequests = await prisma.accountantDocumentRequest.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS", "ANSWERED"] } } });
  if (openRequests) warnings.push({ severity: "ERROR", code: "ACCOUNTANT_REQUEST_OPEN", message: `${openRequests} solicitação(ões) contábil(is) em aberto.`, details: { blocking: true, count: openRequests } });
  const inbound = active.filter((item) => item.operationDirection === "INBOUND");
  const outbound = active.filter((item) => item.operationDirection === "OUTBOUND");
  const cteInbound = active.filter((item) => item.operationDirection === "TRANSPORT_INBOUND");
  const cteOutbound = active.filter((item) => item.operationDirection === "TRANSPORT_OUTBOUND");
  const cteUnknown = active.filter((item) => item.documentType === "CTE" && item.operationDirection === "UNKNOWN");
  const knownForTaxes = active.filter((item) => item.operationDirection !== "UNKNOWN");
  const taxes = settings ? calculateEstimatedTaxes(knownForTaxes, settings, rules) : { highlighted: { icms: 0, ipi: 0, pis: 0, cofins: 0 }, estimatedTotal: 0 };
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
      status: "DRAFT",
      officeId: actor.officeId || null,
      createdByUserId: actor.userId || null,
    },
    update: { status: "DRAFT", approvedAt: null, approvalNote: null },
  });
  await prisma.$transaction([
    prisma.monthlyTaxClosingItem.deleteMany({ where: { closingId: closing.id } }),
    prisma.monthlyTaxClosingWarning.deleteMany({ where: { closingId: closing.id } }),
    prisma.monthlyTaxClosing.update({
      where: { id: closing.id },
      data: {
        ...totals,
        status: !settings || !settings.fiscalConfigComplete ? "TAX_SETTINGS_REQUIRED" : warnings.some((warning) => warning.severity === "ERROR") ? "PENDING_REVIEW" : "READY_FOR_APPROVAL",
        includedDocuments: active.length,
        eligibleDocuments: active.length,
        blockedDocuments: excluded.length,
        pendingCount: warnings.filter((warning) => warning.severity === "ERROR").length,
        ignoredDocuments: ignoredDocuments + excluded.length,
        sourceSnapshotAt: new Date(),
        taxSettingsSnapshot: taxSettingsSnapshot(settings),
        snapshot: {
          generatedAt: new Date().toISOString(),
          allowedSources: CLOSING_SOURCES,
          taxSettings: taxSettingsSnapshot(settings),
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
    ...(active.length
      ? [
          prisma.monthlyTaxClosingItem.createMany({
            data: active.map((document) => ({
              closingId: closing.id,
              documentId: document.id,
              category: closingCategory(document),
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
            data: warnings.map(({ severity, code, message, details, field, cause, suggestion, documentId, accessKey, ...presentation }) => ({
              closingId: closing.id,
              severity,
              code,
              message,
              details: { ...(details || {}), ...(field ? { field } : {}), ...(cause ? { cause } : {}), ...(suggestion ? { suggestion } : {}), ...(documentId ? { documentId } : {}), ...(accessKey ? { accessKey } : {}), ...presentation },
            })),
          }),
        ]
      : []),
    prisma.monthlyTaxClosingEvent.create({ data: { closingId: closing.id, actorUserId: actor.userId || null, action: "RECALCULATED", toStatus: !settings || !settings.fiscalConfigComplete ? "TAX_SETTINGS_REQUIRED" : warnings.some((warning) => warning.severity === "ERROR") ? "PENDING_REVIEW" : "READY_FOR_APPROVAL" } }),
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

export async function approveMonthlyClosing(companyId, closingId, actor = {}) {
  const current = await getMonthlyClosing(companyId, closingId);
  if (current.status !== "READY_FOR_APPROVAL") throw new AppError("O fechamento possui pendências bloqueantes ou configuração tributária incompleta.", current.status === "TAX_SETTINGS_REQUIRED" ? "TAX_SETTINGS_REQUIRED" : "MONTHLY_CLOSING_NOT_READY", 422);
  return serialize(
    await prisma.monthlyTaxClosing.update({
      where: { id: closingId },
      data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: actor.userId || null, approvalNote: actor.note || null, events: { create: { actorUserId: actor.userId || null, action: "APPROVED", fromStatus: current.status, toStatus: "APPROVED", note: actor.note || null } } },
      include: closingInclude,
    }),
  );
}

export async function reopenMonthlyClosing(companyId, closingId, actor = {}) {
  const current = await getMonthlyClosing(companyId, closingId);
  if (!actor.reason?.trim()) throw new AppError("Motivo obrigatório para reabrir o fechamento.", "MONTHLY_CLOSING_REOPEN_REASON_REQUIRED", 422);
  const updated = await prisma.$transaction(async (tx) => {
    const stale = await tx.fiscalBookPreparation.findMany({ where: { companyId, monthlyTaxClosingId: closingId, status: { not: "STALE" } }, select: { id: true, status: true, officeId: true } });
    if (stale.length) {
      await tx.fiscalBookPreparation.updateMany({ where: { id: { in: stale.map((item) => item.id) } }, data: { status: "STALE", invalidatedAt: new Date(), invalidatedReason: actor.reason } });
      await tx.auditLog.createMany({ data: stale.map((item) => ({ action: "accountant.fiscal_book.invalidated", companyId, userId: actor.userId || null, entityType: "FiscalBookPreparation", entityId: item.id, metadata: { officeId: item.officeId || actor.officeId || null, closingId, previousStatus: item.status, status: "STALE", reason: actor.reason, timestamp: new Date().toISOString() } })) });
    }
    return tx.monthlyTaxClosing.update({
      where: { id: closingId },
      data: { status: "REOPENED", approvedAt: null, reopenedAt: new Date(), reopenedByUserId: actor.userId || null, reopenReason: actor.reason, events: { create: { actorUserId: actor.userId || null, action: "REOPENED", fromStatus: current.status, toStatus: "REOPENED", note: actor.reason } } },
      include: closingInclude,
    });
  });
  return serialize(updated);
}
