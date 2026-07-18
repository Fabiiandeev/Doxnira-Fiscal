import crypto from "node:crypto";

import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

const layouts = { SPED_FISCAL: "CONFERENCIA-1.0", SINTEGRA: "CONFERENCIA-1.0" };
const requiredDocumentFields = ["accessKey", "model", "series", "number", "emissionDate", "participantDocument", "participantName", "totalAmount"];
const stable = (value) => value == null ? "" : String(value);
const amount = (value) => Number(value || 0).toFixed(2);
const date = (value) => value ? new Date(value).toISOString().slice(0, 10).replaceAll("-", "") : "";
const hash = (content) => crypto.createHash("sha256").update(content, "utf8").digest("hex");

function domainError(message, code, details = {}) {
  return new AppError(message, code, 422, { details });
}

function validatePreparation(preparation) {
  if (preparation.status === "STALE") throw domainError("Pré-escrituração desatualizada; gere novamente a partir de um fechamento aprovado.", "FISCAL_EXPORT_PREPARATION_STALE");
  if (preparation.status !== "READY") throw domainError("A exportação exige pré-escrituração READY.", "FISCAL_EXPORT_PREPARATION_NOT_READY", { status: preparation.status });
  if (preparation.closing.status !== "APPROVED") throw domainError("A exportação exige fechamento mensal APPROVED.", "FISCAL_EXPORT_CLOSING_NOT_APPROVED", { status: preparation.closing.status });
  const blocking = preparation.issues.filter((item) => item.severity === "BLOCKING" && item.status === "OPEN");
  if (blocking.length) throw domainError("Há inconsistências bloqueantes abertas na pré-escrituração.", "FISCAL_EXPORT_BLOCKING_ISSUES", { issueIds: blocking.map((item) => item.id) });
  for (const document of preparation.documents) {
    const missing = requiredDocumentFields.filter((field) => document[field] == null || document[field] === "");
    if (missing.length) throw domainError("O snapshot não possui dados suficientes para o layout de conferência.", "FISCAL_EXPORT_LAYOUT_DATA_REQUIRED", { documentId: document.id, fields: missing });
  }
}

function orderedDocuments(preparation) {
  return [...preparation.documents].sort((left, right) => [stable(left.emissionDate), stable(left.accessKey), left.id].join("|").localeCompare([stable(right.emissionDate), stable(right.accessKey), right.id].join("|")));
}

function sped(preparation) {
  const rows = [
    `|0000|CONFERENCIA|${preparation.periodYear}${String(preparation.periodMonth).padStart(2, "0")}|`,
  ];
  for (const document of orderedDocuments(preparation)) {
    const record = document.sourceType === "CTE" ? "D100" : "C100";
    rows.push(`|${record}|${date(document.emissionDate)}|${stable(document.model)}|${stable(document.series)}|${stable(document.number)}|${stable(document.accessKey)}|${amount(document.totalAmount)}|`);
    for (const item of [...document.items].sort((left, right) => left.itemNumber - right.itemNumber)) rows.push(`|C170|${item.itemNumber}|${stable(item.productCode)}|${stable(item.description)}|${amount(item.quantity)}|${stable(item.unit)}|${amount(item.totalValue)}|${stable(item.cfop)}|`);
  }
  rows.push("|9999|");
  return `${rows.join("\r\n")}\r\n`;
}

function sintegra(preparation) {
  const rows = [`10|CONFERENCIA|${preparation.periodYear}${String(preparation.periodMonth).padStart(2, "0")}`];
  for (const document of orderedDocuments(preparation)) rows.push(`50|${date(document.emissionDate)}|${stable(document.participantDocument)}|${stable(document.model)}|${stable(document.series)}|${stable(document.number)}|${amount(document.totalAmount)}|${stable(document.cfop)}|${stable(document.accessKey)}`);
  rows.push("90|FIM");
  return `${rows.join("\r\n")}\r\n`;
}

async function scopedPreparation(companyId, officeId, preparationId) {
  const preparation = await prisma.fiscalBookPreparation.findFirst({
    where: { id: preparationId, companyId, officeId },
    include: { closing: true, documents: { include: { items: true } }, issues: true },
  });
  if (!preparation) throw new AppError("Pré-escrituração não encontrada neste contexto.", "FISCAL_EXPORT_PREPARATION_NOT_FOUND", 404);
  return preparation;
}

export async function validateFiscalExport(companyId, officeId, preparationId) {
  const preparation = await scopedPreparation(companyId, officeId, preparationId);
  validatePreparation(preparation);
  return { valid: true, preparationId: preparation.id, closingId: preparation.monthlyTaxClosingId, status: preparation.status, layoutVersions: layouts };
}

export async function generateFiscalExport(companyId, officeId, preparationId, type, actor = {}) {
  if (!layouts[type]) throw domainError("Tipo de exportação fiscal inválido.", "FISCAL_EXPORT_TYPE_INVALID");
  const preparation = await scopedPreparation(companyId, officeId, preparationId);
  validatePreparation(preparation);
  const content = type === "SPED_FISCAL" ? sped(preparation) : sintegra(preparation);
  const layoutVersion = layouts[type];
  const snapshotHash = preparation.snapshotHash || hash(JSON.stringify(orderedDocuments(preparation).map((item) => item.id)));
  const contentHash = hash(content);
  const extension = type === "SPED_FISCAL" ? "sped" : "sintegra";
  const fileName = `${type.toLowerCase()}-${preparation.periodYear}-${String(preparation.periodMonth).padStart(2, "0")}-${contentHash.slice(0, 12)}.${extension}.txt`;
  const snapshot = { preparationId: preparation.id, closingId: preparation.monthlyTaxClosingId, snapshotHash, layoutVersion, documents: orderedDocuments(preparation).map((item) => ({ id: item.id, accessKey: item.accessKey, group: item.operationGroup, totalAmount: stable(item.totalAmount) })) };
  return prisma.fiscalExport.upsert({
    where: { preparationId_type_layoutVersion_snapshotHash: { preparationId: preparation.id, type, layoutVersion, snapshotHash } },
    create: { companyId, officeId, preparationId: preparation.id, closingId: preparation.monthlyTaxClosingId, type, periodYear: preparation.periodYear, periodMonth: preparation.periodMonth, layoutVersion, snapshotHash, contentHash, fileName, content, sizeBytes: Buffer.byteLength(content, "utf8"), snapshot, generatedByUserId: actor.userId || null },
    update: {},
  });
}

export async function listFiscalExports(companyId, officeId, { preparationId, type, page = 1, pageSize = 25 } = {}) {
  const where = { companyId, officeId, ...(preparationId ? { preparationId } : {}), ...(type ? { type } : {}) };
  const [data, total] = await prisma.$transaction([prisma.fiscalExport.findMany({ where, orderBy: { generatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, preparationId: true, closingId: true, type: true, periodYear: true, periodMonth: true, status: true, layoutVersion: true, contentHash: true, fileName: true, sizeBytes: true, generatedByUserId: true, generatedAt: true, error: true } }), prisma.fiscalExport.count({ where })]);
  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getFiscalExport(companyId, officeId, exportId, includeContent = false) {
  const value = await prisma.fiscalExport.findFirst({ where: { id: exportId, companyId, officeId }, ...(includeContent ? {} : { select: { id: true, preparationId: true, closingId: true, type: true, periodYear: true, periodMonth: true, status: true, layoutVersion: true, snapshotHash: true, contentHash: true, fileName: true, sizeBytes: true, snapshot: true, generatedByUserId: true, generatedAt: true, error: true } }) });
  if (!value) throw new AppError("Exportação fiscal não encontrada neste contexto.", "FISCAL_EXPORT_NOT_FOUND", 404);
  return value;
}
