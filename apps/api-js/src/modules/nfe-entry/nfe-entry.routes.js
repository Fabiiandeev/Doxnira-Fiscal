import { randomUUID } from "node:crypto";

import { Router } from "express";
import multer from "multer";

import { prisma } from "../../config/prisma.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { importFiscalXml } from "../../services/fiscal-import.service.js";
import { parseFiscalDocumentXml } from "../../services/fiscal-xml-parser.service.js";
import { buildStorageKey } from "../../services/storage.service.js";
import { hashXml } from "../../services/xml.service.js";
import { AppError } from "../../utils/app-error.js";
import { normalizeCnpj } from "../../utils/cnpj.js";
import { buildMockNfeAccessKey } from "../../utils/nfe-access-key.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { sanitizeXml } from "../../utils/sanitize-xml.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { buildIncomingInventoryPlan, incomingInventoryReadiness, validateIncomingPayableInstallments } from "./nfe-entry-rules.js";
import { calculateAllocation, confirmAllocation, getAllocation, removeNfeLink, resetAllocation } from "./cte-allocation-service.js";

export const nfeEntryRouter = Router({ mergeParams: true });
export const cteEntryRouter = Router({ mergeParams: true });

const xmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

const MANIFESTATION_STATUS = {
  CIENCIA: "MANIFESTADA_CIENCIA",
  CONFIRMACAO: "MANIFESTADA_CONFIRMACAO",
  DESCONHECIMENTO: "MANIFESTADA_DESCONHECIMENTO",
  NAO_REALIZADA: "MANIFESTADA_NAO_REALIZADA",
  AWARE: "MANIFESTADA_CIENCIA",
  CONFIRMED: "MANIFESTADA_CONFIRMACAO",
  UNKNOWN: "MANIFESTADA_DESCONHECIMENTO",
  NOT_PERFORMED: "MANIFESTADA_NAO_REALIZADA",
};

const BLOCKING_MANIFESTATIONS = new Set([
  "MANIFESTADA_DESCONHECIMENTO",
  "MANIFESTADA_NAO_REALIZADA",
]);

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextProtocol(prefix = "135") {
  return `${prefix}${String(Date.now()).slice(-10)}${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
}

function normalizeManifestation(value) {
  const key = String(value || "").trim().toUpperCase();
  return MANIFESTATION_STATUS[key] || key;
}

function manifestationEventType(value) {
  const status = normalizeManifestation(value);
  if (status === "MANIFESTADA_CIENCIA") return "CIENCIA";
  if (status === "MANIFESTADA_CONFIRMACAO") return "CONFIRMACAO";
  if (status === "MANIFESTADA_DESCONHECIMENTO") return "DESCONHECIMENTO";
  if (status === "MANIFESTADA_NAO_REALIZADA") return "NAO_REALIZADA";
  return status || "CIENCIA";
}

function mapExistingManifestation(status) {
  return MANIFESTATION_STATUS[String(status || "").toUpperCase()] || "PENDENTE_MANIFESTACAO";
}

function serializeEntry(entry) {
  if (!entry) return entry;
  return {
    ...entry,
    totalAmount: money(entry.totalAmount),
    productsAmount: money(entry.productsAmount),
    freightAmount: money(entry.freightAmount),
    discountAmount: money(entry.discountAmount),
    xmlContent: undefined,
    fiscalDocument: entry.fiscalDocument
      ? {
          ...entry.fiscalDocument,
          rawXml: undefined,
          totalAmount: money(entry.fiscalDocument.totalAmount),
          productsAmount: money(entry.fiscalDocument.productsAmount),
          freightAmount: money(entry.fiscalDocument.freightAmount),
          discountAmount: money(entry.fiscalDocument.discountAmount),
        }
      : undefined,
    items: entry.items?.map((item) => ({
      ...item,
      quantity: money(item.quantity),
      unitValue: money(item.unitValue),
      totalValue: money(item.totalValue),
    })),
    payables: entry.payables?.map((payable) => ({
      ...payable,
      amount: money(payable.amount),
    })),
    stockMovements: entry.stockMovements?.map((movement) => ({
      ...movement,
      quantity: money(movement.quantity),
      unitCost: money(movement.unitCost),
      totalCost: money(movement.totalCost),
    })),
    cteLinks: entry.cteLinks?.map((link) => ({
      ...link,
      freightShare: money(link.freightShare),
      cteEntry: link.cteEntry ? { ...link.cteEntry, freightAmount: money(link.cteEntry.freightAmount) } : undefined,
    })),
  };
}

function serializeCte(entry) {
  return entry
    ? {
        ...entry,
        freightAmount: money(entry.freightAmount),
        nfeLinks: entry.nfeLinks?.map((link) => ({
          ...link,
          freightShare: money(link.freightShare),
        })),
      }
    : entry;
}

const entryDetailInclude = {
  fiscalDocument: true,
  supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true, nome: true, cnpj: true } },
  items: {
    include: {
      product: { select: { id: true, code: true, name: true, ncm: true, unit: true, stock: true, costPrice: true } },
      productLink: true,
    },
    orderBy: { itemNumber: "asc" },
  },
  manifestations: { orderBy: { createdAt: "desc" } },
  events: { orderBy: { createdAt: "desc" } },
  cteLinks: { include: { cteEntry: true }, orderBy: { createdAt: "desc" } },
  stockMovements: { include: { product: { select: { id: true, code: true, name: true } } }, orderBy: { createdAt: "desc" } },
  payables: { orderBy: { dueDate: "asc" } },
  alerts: { orderBy: { createdAt: "desc" } },
};

async function findEntry(companyId, id) {
  const entry = await prisma.nfeEntry.findFirst({
    where: { id, companyId },
    include: entryDetailInclude,
  });
  if (!entry) throw new AppError("NF-e de entrada nao encontrada.", "NFE_ENTRY_NOT_FOUND", 404);
  return entry;
}

async function addEntryEvent(tx, { companyId, entryId, userId, eventType, title, description, metadata }) {
  return tx.nfeEntryEvent.create({
    data: {
      companyId,
      nfeEntryId: entryId,
      userId,
      eventType,
      title,
      description,
      metadata,
    },
  });
}

function statusFromAnalysis({ entry, alerts, pendingItems }) {
  if (entry.ignoredAt) return { status: "IGNORADA", entryStatus: "IGNORADA", recommendation: "BLOQUEAR" };
  if (entry.fiscalDocument?.isCancelled || entry.sefazStatus === "CANCELLED") {
    return { status: "CANCELADA", entryStatus: "CANCELADA", recommendation: "BLOQUEAR" };
  }
  if (BLOCKING_MANIFESTATIONS.has(entry.manifestationStatus)) {
    return { status: entry.manifestationStatus, entryStatus: entry.manifestationStatus, recommendation: "BLOQUEAR" };
  }
  const hasError = alerts.some((alert) => alert.severity === "error");
  const hasWarn = alerts.some((alert) => alert.severity === "warning");
  if (hasError) return { status: "COM_DIVERGENCIA", entryStatus: "COM_DIVERGENCIA", recommendation: "BLOQUEAR" };
  if (pendingItems > 0) {
    return { status: "PENDENTE_VINCULO_PRODUTOS", entryStatus: "PENDENTE_VINCULO_PRODUTOS", recommendation: "REVISAR" };
  }
  if (!entry.stockPostedAt) {
    return { status: hasWarn ? "COM_DIVERGENCIA" : "PENDENTE_ESTOQUE", entryStatus: "PENDENTE_ESTOQUE", recommendation: hasWarn ? "REVISAR" : "LIBERAR" };
  }
  if (!entry.financialGeneratedAt) {
    return { status: "PENDENTE_FINANCEIRO", entryStatus: "PENDENTE_FINANCEIRO", recommendation: hasWarn ? "REVISAR" : "LIBERAR" };
  }
  return { status: "ENTRADA_CONFIRMADA", entryStatus: "ENTRADA_CONFIRMADA", recommendation: hasWarn ? "REVISAR" : "LIBERAR" };
}

function buildInventoryPlan(entry) {
  const eligibleItems = entry.items.filter((item) => !item.stockIgnored && item.productId);
  const productsAmount = Math.max(money(entry.productsAmount), 0);
  const additionalCost = money(entry.freightAmount) - money(entry.discountAmount);
  return eligibleItems.map((item) => {
    const itemValue = money(item.totalValue);
    const share = productsAmount > 0 ? itemValue / productsAmount : 0;
    const allocatedCost = additionalCost * share;
    const quantity = money(item.quantity);
    const totalCost = Math.max(0, itemValue + allocatedCost);
    return {
      itemId: item.id,
      productId: item.productId,
      quantity,
      xmlUnit: item.unit,
      internalUnit: item.product?.unit || null,
      allocationRatio: share,
      freightShare: money(entry.freightAmount) * share,
      discountShare: money(entry.discountAmount) * share,
      totalCost,
      unitCost: quantity > 0 ? totalCost / quantity : 0,
    };
  });
}

function validatePayableInstallments(entry, installments) {
  const issues = [];
  const seenNumbers = new Set();
  let total = 0;
  for (const installment of installments) {
    const number = String(installment.number || installment.installmentNumber || "001");
    const amount = money(installment.amount);
    if (seenNumbers.has(number)) issues.push(`Parcela ${number} foi informada mais de uma vez.`);
    seenNumbers.add(number);
    if (amount <= 0) issues.push(`Parcela ${number} deve ter valor maior que zero.`);
    if (!asDate(installment.dueDate)) issues.push(`Vencimento da parcela ${number} é inválido.`);
    total += amount;
  }
  if (Math.abs(total - money(entry.totalAmount)) > 0.01) {
    issues.push("A soma das parcelas deve ser igual ao valor financeiro da NF-e.");
  }
  return issues;
}

async function postInventoryEntry({ entry, companyId, userId }) {
  if (entry.stockPostedAt || entry.status === "ENTRADA_CONFIRMADA") {
    throw new AppError("Entrada já confirmada para esta NF-e.", "NFE_ENTRY_ALREADY_CONFIRMED", 409);
  }
  if (entry.stockStatus === "BLOCKED" || entry.status === "CANCELADA" || BLOCKING_MANIFESTATIONS.has(entry.manifestationStatus)) {
    throw new AppError("Documento possui bloqueio fiscal e não pode entrar no estoque.", "NFE_ENTRY_CONFIRM_BLOCKED", 422);
  }
  const pending = entry.items.filter((item) => !item.stockIgnored && !item.productId);
  if (pending.length) throw new AppError("Vincule ou ignore todos os itens antes de confirmar entrada.", "NFE_ENTRY_PRODUCTS_PENDING", 422, pending.map((item) => item.id));

  await prisma.$transaction(async (tx) => {
    const inventoryPlan = buildIncomingInventoryPlan(entry);
    for (const line of inventoryPlan) {
      const product = await tx.product.findFirst({ where: { id: line.productId, companyId } });
      if (!product) continue;
      const quantity = Math.max(0, Math.round(line.quantity));
      const previousStock = product.stock || 0;
      const newStock = previousStock + quantity;
      await tx.product.update({ where: { id: product.id }, data: { stock: newStock, costPrice: line.unitCost || product.costPrice } });
      await tx.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          nfeEntryId: entry.id,
          nfeEntryItemId: line.itemId,
          movementType: "ENTRADA_NFE",
          quantity: line.quantity,
          unitCost: line.unitCost,
          totalCost: line.totalCost,
          previousStock,
          newStock,
          metadata: { accessKey: entry.accessKey, itemNumber: entry.items.find((item) => item.id === line.itemId)?.itemNumber, allocationRatio: line.allocationRatio },
        },
      });
    }
    await tx.nfeEntry.update({
      where: { id: entry.id },
      data: {
        stockStatus: "POSTED",
        entryStatus: entry.financialGeneratedAt ? "ENTRADA_CONFIRMADA" : "PENDENTE_FINANCEIRO",
        status: entry.financialGeneratedAt ? "ENTRADA_CONFIRMADA" : "PENDENTE_FINANCEIRO",
        confirmedAt: new Date(),
        stockPostedAt: new Date(),
      },
    });
    await addEntryEvent(tx, {
      companyId,
      entryId: entry.id,
      userId,
      eventType: "ENTRY_CONFIRMED",
      title: "Entrada fiscal confirmada",
      description: "Estoque movimentado a partir da NF-e de entrada.",
      metadata: { items: entry.items.length },
    });
  });
  return findEntry(companyId, entry.id);
}

async function autoLinkProducts(tx, entryId, companyId) {
  const entry = await tx.nfeEntry.findUnique({
    where: { id: entryId },
    include: { items: true },
  });
  if (!entry) return;

  for (const item of entry.items) {
    if (item.productId || item.stockIgnored) continue;
    const code = item.supplierProductCode?.trim();
    const ean = item.ean?.replace(/\D/g, "");
    const description = item.description?.slice(0, 40);
    const product = await tx.product.findFirst({
      where: {
        companyId,
        active: true,
        OR: [
          ...(ean && ean.length >= 8 ? [{ barcode: ean }] : []),
          ...(code ? [{ code }] : []),
          ...(description ? [{ name: { contains: description, mode: "insensitive" } }] : []),
          ...(item.ncm ? [{ ncm: item.ncm }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!product) continue;
    const matchMethod =
      ean && product.barcode === ean
        ? "EAN"
        : code && product.code === code
          ? "CODIGO_FORNECEDOR"
          : item.ncm && product.ncm === item.ncm
            ? "NCM"
            : "DESCRICAO";
    const confidence = matchMethod === "EAN" ? 98 : matchMethod === "CODIGO_FORNECEDOR" ? 92 : matchMethod === "DESCRICAO" ? 70 : 55;
    await tx.nfeEntryItem.update({
      where: { id: item.id },
      data: { productId: product.id, linkStatus: "VINCULADO_AUTO", linkConfidence: confidence },
    });
    await tx.nfeEntryProductLink.upsert({
      where: { nfeEntryItemId: item.id },
      create: {
        companyId,
        nfeEntryId: entry.id,
        nfeEntryItemId: item.id,
        productId: product.id,
        supplierCnpj: entry.supplierCnpj,
        supplierProductCode: code,
        matchMethod,
        confidence,
      },
      update: { productId: product.id, matchMethod, confidence },
    });
  }
}

async function applyFiscalAnalysis(entryId) {
  const entry = await prisma.nfeEntry.findUnique({
    where: { id: entryId },
    include: {
      fiscalDocument: true,
      items: { include: { product: true } },
    },
  });
  if (!entry) return null;

  const alerts = [];
  const itemTotal = entry.items.reduce((sum, item) => sum + money(item.totalValue), 0);
  if (Math.abs(itemTotal - money(entry.productsAmount)) > 0.02 && entry.items.length) {
    alerts.push({
      type: "TOTAL_DIVERGENCE",
      severity: "error",
      title: "Total dos itens diverge da NF-e",
      message: `Itens somam R$ ${itemTotal.toFixed(2)}, mas o XML informa R$ ${money(entry.productsAmount).toFixed(2)}.`,
      recommendation: "Revisar XML e totais antes de confirmar a entrada.",
    });
  }
  if (!entry.supplierId) {
    alerts.push({
      type: "SUPPLIER_NOT_FOUND",
      severity: "warning",
      title: "Fornecedor nao cadastrado",
      message: "O emitente da NF-e ainda nao foi encontrado no cadastro de fornecedores.",
      recommendation: "Cadastrar ou revisar fornecedor antes de gerar financeiro.",
    });
  }
  if (entry.fiscalDocument?.isCancelled || entry.sefazStatus === "CANCELLED") {
    alerts.push({
      type: "NFE_CANCELLED",
      severity: "error",
      title: "NF-e cancelada",
      message: "Documento fiscal consta como cancelado.",
      recommendation: "Bloquear entrada de estoque e financeiro.",
    });
  }
  if (entry.manifestationStatus === "PENDENTE_MANIFESTACAO") {
    alerts.push({
      type: "MANIFESTATION_PENDING",
      severity: "info",
      title: "Manifestacao pendente",
      message: "XML autorizado, mas sem manifestacao do destinatario registrada.",
      recommendation: "Registrar ciencia ou confirmacao antes da entrada definitiva.",
    });
  }
  for (const item of entry.items) {
    if (!item.stockIgnored && !item.productId) {
      alerts.push({
        type: "PRODUCT_NOT_LINKED",
        severity: "error",
        title: "Produto nao vinculado",
        message: `${item.description || "Item"} ainda nao foi vinculado a produto interno.`,
        recommendation: "Vincular produto existente, cadastrar novo produto ou ignorar estoque do item.",
        nfeEntryItemId: item.id,
      });
    }
    if (item.product && item.ncm && item.product.ncm && item.ncm !== item.product.ncm) {
      alerts.push({
        type: "NCM_DIVERGENCE",
        severity: "warning",
        title: "NCM divergente",
        message: `${item.description || "Item"} veio no XML com NCM ${item.ncm}, mas o cadastro interno possui ${item.product.ncm}.`,
        recommendation: "Revisar cadastro fiscal do produto antes de confirmar.",
        nfeEntryItemId: item.id,
      });
    }
    if (item.product && item.unit && item.product.unit && item.unit !== item.product.unit) {
      alerts.push({
        type: "UNIT_DIVERGENCE",
        severity: "warning",
        title: "Unidade comercial divergente",
        message: `${item.description || "Item"} veio com unidade ${item.unit}, cadastro interno usa ${item.product.unit}.`,
        recommendation: "Revisar fator de conversao ou unidade do produto.",
        nfeEntryItemId: item.id,
      });
    }
  }

  await prisma.fiscalAlert.deleteMany({ where: { companyId: entry.companyId, nfeEntryId: entry.id, status: "open" } });
  if (alerts.length) {
    await prisma.fiscalAlert.createMany({
      data: alerts.map((alert) => ({
        companyId: entry.companyId,
        nfeEntryId: entry.id,
        fiscalDocumentId: entry.fiscalDocumentId,
        nfeEntryItemId: alert.nfeEntryItemId || null,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        recommendation: alert.recommendation,
      })),
    });
  }

  const pendingItems = entry.items.filter((item) => !item.productId && !item.stockIgnored).length;
  const riskScore = Math.min(
    100,
    alerts.reduce((sum, alert) => sum + (alert.severity === "error" ? 35 : alert.severity === "warning" ? 15 : 5), 0),
  );
  const nextStatus = statusFromAnalysis({ entry, alerts, pendingItems });
  await prisma.nfeEntry.update({
    where: { id: entry.id },
    data: {
      status: nextStatus.status,
      entryStatus: nextStatus.entryStatus,
      riskScore,
      recommendation: nextStatus.recommendation,
      validationSummary: {
        alerts: alerts.length,
        errors: alerts.filter((alert) => alert.severity === "error").length,
        warnings: alerts.filter((alert) => alert.severity === "warning").length,
        pendingItems,
        analyzedAt: new Date().toISOString(),
      },
    },
  });
  return findEntry(entry.companyId, entry.id);
}

async function ensureEntryFromFiscalDocument(companyId, fiscalDocumentId, { source = "DFE_SYNC", userId = null } = {}) {
  const document = await prisma.fiscalDocument.findFirst({
    where: { id: fiscalDocumentId, companyId },
    include: { items: { orderBy: { itemNumber: "asc" } } },
  });
  if (!document) throw new AppError("Documento fiscal nao encontrado.", "FISCAL_DOCUMENT_NOT_FOUND", 404);
  if (document.documentType !== "NFE" || document.operationDirection !== "INBOUND") {
    throw new AppError("Documento nao e NF-e de entrada.", "NFE_ENTRY_INVALID_DOCUMENT", 422);
  }

  const existing = await prisma.nfeEntry.findUnique({ where: { companyId_accessKey: { companyId, accessKey: document.accessKey } } });
  if (existing) return applyFiscalAnalysis(existing.id);

  const supplierCnpj = normalizeCnpj(document.issuerCnpj || "");
  const supplier = supplierCnpj
    ? await prisma.fornecedor.findFirst({ where: { companyId, cnpj: supplierCnpj }, select: { id: true } })
    : null;
  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.nfeEntry.create({
      data: {
        companyId,
        fiscalDocumentId: document.id,
        supplierId: supplier?.id || null,
        status: document.isCancelled ? "CANCELADA" : "SINCRONIZADA",
        source,
        entryStatus: document.isCancelled ? "CANCELADA" : "PENDENTE_VALIDACAO",
        manifestationStatus: mapExistingManifestation(document.manifestationStatus),
        sefazStatus: document.status,
        accessKey: document.accessKey,
        nsu: document.nsu,
        number: document.invoiceNumber,
        series: document.series,
        issueDate: document.emissionDate,
        authorizationDate: document.authorizationDate,
        supplierName: document.issuerName,
        supplierCnpj,
        recipientCnpj: normalizeCnpj(document.recipientCnpj || ""),
        totalAmount: money(document.totalAmount),
        productsAmount: money(document.productsAmount),
        freightAmount: money(document.freightAmount),
        discountAmount: money(document.discountAmount),
        protocol: document.protocol,
        xmlStorageKey: document.xmlStorageKey,
        xmlContent: document.rawXml,
        xmlHashSha256: document.xmlHashSha256,
        items: {
          create: document.items.map((item) => ({
            companyId,
            fiscalDocumentItemId: item.id,
            itemNumber: item.itemNumber,
            supplierProductCode: item.productCode,
            ean: item.ean,
            description: item.description,
            ncm: item.ncm,
            cfop: item.cfop,
            cst: item.cst,
            csosn: item.csosn,
            unit: item.unit,
            quantity: money(item.quantity),
            unitValue: money(item.unitValue),
            totalValue: money(item.totalValue),
          })),
        },
      },
    });
    await addEntryEvent(tx, {
      companyId,
      entryId: entry.id,
      userId,
      eventType: "NFE_ENTRY_CREATED",
      title: source === "XML_IMPORTADO" ? "XML importado" : "NF-e sincronizada",
      description: "Registro operacional de NF-e de entrada criado.",
      metadata: { source, accessKey: document.accessKey },
    });
    await autoLinkProducts(tx, entry.id, companyId);
    return entry;
  });
  return applyFiscalAnalysis(created.id);
}

async function syncExistingInboundDocuments(companyId, userId) {
  const documents = await prisma.fiscalDocument.findMany({
    where: {
      companyId,
      documentType: "NFE",
      operationDirection: "INBOUND",
      nfeEntry: null,
    },
    orderBy: { emissionDate: "desc" },
    take: 50,
  });
  const entries = [];
  for (const document of documents) {
    entries.push(await ensureEntryFromFiscalDocument(companyId, document.id, { source: document.source || "DFE_SYNC", userId }));
  }
  return entries;
}

function buildMockNfeXml({ company, supplier, product, invoiceNumber, accessKey, issuedAt }) {
  const supplierCnpj = normalizeCnpj(supplier?.cnpj || "11222333000144").padStart(14, "0").slice(-14);
  const productName = product?.name || "PRODUTO DE ENTRADA DFE";
  const productCode = product?.code || "DFE-001";
  const ncm = product?.ncm || "84713012";
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00"><NFe><infNFe Id="NFe${accessKey}" versao="4.00"><ide><cUF>35</cUF><cNF>12345678</cNF><natOp>COMPRA PARA COMERCIALIZACAO</natOp><mod>55</mod><serie>1</serie><nNF>${invoiceNumber}</nNF><dhEmi>${issuedAt.toISOString()}</dhEmi><tpNF>1</tpNF></ide><emit><CNPJ>${supplierCnpj}</CNPJ><xNome>${supplier?.razaoSocial || supplier?.nomeFantasia || "FORNECEDOR DFE MOCK LTDA"}</xNome><enderEmit><UF>${supplier?.uf || "SP"}</UF></enderEmit></emit><dest><CNPJ>${normalizeCnpj(company.cnpj)}</CNPJ><xNome>${company.legalName}</xNome></dest><det nItem="1"><prod><cProd>${productCode}</cProd><cEAN>${product?.barcode || "SEM GTIN"}</cEAN><xProd>${productName}</xProd><NCM>${ncm}</NCM><CFOP>1102</CFOP><uCom>${product?.unit || "UN"}</uCom><qCom>5.0000</qCom><vUnCom>100.0000</vUnCom><vProd>500.00</vProd></prod><imposto><ICMS><ICMS00><CST>00</CST><vBC>500.00</vBC><pICMS>18.00</pICMS><vICMS>90.00</vICMS></ICMS00></ICMS><PIS><PISAliq><vBC>500.00</vBC><pPIS>1.65</pPIS><vPIS>8.25</vPIS></PISAliq></PIS><COFINS><COFINSAliq><vBC>500.00</vBC><pCOFINS>7.60</pCOFINS><vCOFINS>38.00</vCOFINS></COFINSAliq></COFINS></imposto></det><total><ICMSTot><vBC>500.00</vBC><vICMS>90.00</vICMS><vProd>500.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vPIS>8.25</vPIS><vCOFINS>38.00</vCOFINS><vNF>500.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${accessKey}</chNFe><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><nProt>${nextProtocol()}</nProt></infProt></protNFe></nfeProc>`;
}

async function createMockInboundDocument(company, userId) {
  const supplier = await prisma.fornecedor.findFirst({ where: { companyId: company.id, cnpj: { not: null }, ativo: true }, orderBy: { createdAt: "desc" } });
  const product = await prisma.product.findFirst({ where: { companyId: company.id, active: true }, orderBy: { updatedAt: "desc" } });
  const invoiceNumber = Math.floor(100000 + Math.random() * 899999);
  const issuedAt = new Date();
  const issuerCnpj = supplier?.cnpj || "11222333000144";
  const accessKey = buildMockNfeAccessKey({
    uf: supplier?.uf || company.uf || "SP",
    issuerCnpj,
    invoiceNumber,
    series: "1",
    model: "55",
    issuedAt,
    seed: randomUUID(),
  });
  const xml = buildMockNfeXml({ company, supplier, product, invoiceNumber, accessKey, issuedAt });
  const xmlHash = hashXml(xml);
  const parsed = parseFiscalDocumentXml(xml);
  const document = await prisma.fiscalDocument.create({
    data: {
      companyId: company.id,
      documentType: "NFE",
      operationDirection: "INBOUND",
      companyRole: "RECIPIENT",
      invoiceNumber: parsed.number,
      series: parsed.series,
      model: parsed.model,
      accessKey: parsed.accessKey,
      nsu: String(Date.now()).slice(-15).padStart(15, "0"),
      schemaName: "mock-dfe-nfe",
      status: parsed.status,
      protocol: parsed.protocol,
      issuerCnpj: parsed.issuerCnpj,
      issuerName: parsed.issuerName,
      recipientCnpj: parsed.recipientCnpj,
      recipientName: parsed.recipientName,
      uf: parsed.issuerUf,
      cfop: parsed.cfop,
      emissionDate: asDate(parsed.emissionDate),
      authorizationDate: new Date(),
      totalAmount: parsed.totalAmount,
      productsAmount: parsed.productsAmount,
      freightAmount: parsed.freightAmount,
      discountAmount: parsed.discountAmount,
      icmsAmount: parsed.icmsAmount,
      ipiAmount: parsed.ipiAmount,
      pisAmount: parsed.pisAmount,
      cofinsAmount: parsed.cofinsAmount,
      icmsBase: parsed.icmsBase,
      icmsStAmount: parsed.icmsStAmount,
      fcpAmount: parsed.fcpAmount,
      otherAmount: parsed.otherAmount,
      taxAmount: parsed.taxAmount,
      xmlStorageKey: buildStorageKey("mock-dfe/nfe", parsed.accessKey),
      xmlHashSha256: xmlHash,
      rawXmlHash: xmlHash,
      source: "MOCK_DFE",
      rawXml: xml,
      products: parsed.items,
      taxes: { icms: parsed.icmsAmount, pis: parsed.pisAmount, cofins: parsed.cofinsAmount },
      items: { create: parsed.items.map((item) => ({ companyId: company.id, ...item })) },
    },
  });
  return ensureEntryFromFiscalDocument(company.id, document.id, { source: "MOCK_DFE", userId });
}

async function createOrUpdateCteEntryFromTransport(companyId, transportDocumentId) {
  const transport = await prisma.transportDocument.findFirst({
    where: { id: transportDocumentId, companyId },
    include: { nfeLinks: true },
  });
  if (!transport) throw new AppError("CT-e nao encontrado.", "CTE_NOT_FOUND", 404);
  const referencedKeys = transport.nfeLinks.map((link) => link.nfeAccessKey);
  const cte = await prisma.cteEntry.upsert({
    where: { companyId_accessKey: { companyId, accessKey: transport.accessKey } },
    create: {
      companyId,
      transportDocumentId: transport.id,
      accessKey: transport.accessKey,
      number: transport.number,
      series: transport.series,
      issueDate: transport.emissionDate,
      carrierName: transport.issuerName,
      carrierCnpj: normalizeCnpj(transport.issuerCnpj || ""),
      recipientCnpj: normalizeCnpj(transport.recipientCnpj || ""),
      freightAmount: money(transport.totalAmount),
      status: transport.status,
      sefazStatus: transport.status,
      referencedNfeKeys: referencedKeys,
      xmlStorageKey: transport.xmlStorageKey,
      xmlContent: transport.rawXml,
      source: "DFE_SYNC",
    },
    update: {
      status: transport.status,
      referencedNfeKeys: referencedKeys,
      xmlContent: transport.rawXml,
    },
  });
  for (const key of referencedKeys) {
    const nfeEntry = await prisma.nfeEntry.findFirst({ where: { companyId, accessKey: key }, select: { id: true } });
    await prisma.cteEntryNfeLink.upsert({
      where: {
        companyId_cteEntryId_nfeAccessKey: { companyId, cteEntryId: cte.id, nfeAccessKey: key },
      },
      create: {
        companyId,
        cteEntryId: cte.id,
        nfeEntryId: nfeEntry?.id || null,
        nfeAccessKey: key,
        freightShare: referencedKeys.length ? money(transport.totalAmount) / referencedKeys.length : 0,
      },
      update: { nfeEntryId: nfeEntry?.id || null },
    });
    if (nfeEntry?.id) {
      await prisma.nfeEntry.update({ where: { id: nfeEntry.id }, data: { cteStatus: "CTE_VINCULADO" } });
    }
  }
  return prisma.cteEntry.findUnique({ where: { id: cte.id }, include: { nfeLinks: { include: { nfeEntry: true } } } });
}

nfeEntryRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, pageSize, skip, take } = getPagination(request.query, 20);
    const q = String(request.query.q || "").trim();
    const where = {
      companyId: request.company.id,
      ...(request.query.status ? { status: String(request.query.status) } : {}),
      ...(request.query.manifestation ? { manifestationStatus: String(request.query.manifestation) } : {}),
      ...(request.query.stock ? { stockStatus: String(request.query.stock) } : {}),
      ...(request.query.entryStatus ? { entryStatus: String(request.query.entryStatus) } : {}),
      ...(request.query.series ? { series: String(request.query.series) } : {}),
      ...(request.query.number ? { number: { contains: String(request.query.number) } } : {}),
      ...(request.query.accessKey ? { accessKey: { contains: String(request.query.accessKey) } } : {}),
      ...(request.query.supplier ? { supplierName: { contains: String(request.query.supplier), mode: "insensitive" } } : {}),
      ...(request.query.minAmount || request.query.maxAmount
        ? {
            totalAmount: {
              ...(request.query.minAmount ? { gte: Number(request.query.minAmount) } : {}),
              ...(request.query.maxAmount ? { lte: Number(request.query.maxAmount) } : {}),
            },
          }
        : {}),
      ...(request.query.startDate || request.query.endDate
        ? {
            issueDate: {
              ...(request.query.startDate ? { gte: new Date(String(request.query.startDate)) } : {}),
              ...(request.query.endDate ? { lte: new Date(String(request.query.endDate)) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { supplierName: { contains: q, mode: "insensitive" } },
              { supplierCnpj: { contains: normalizeCnpj(q) || q } },
              { accessKey: { contains: normalizeCnpj(q) || q } },
              { number: { contains: q } },
            ],
          }
        : {}),
    };
    const summaryWhere = { companyId: request.company.id };
    const [data, total, summary] = await Promise.all([
      prisma.nfeEntry.findMany({
        where,
        include: {
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } },
          _count: { select: { items: true, alerts: true, cteLinks: true, payables: true } },
        },
        orderBy: { issueDate: "desc" },
        skip,
        take,
      }),
      prisma.nfeEntry.count({ where }),
      Promise.all([
        prisma.nfeEntry.count({ where: summaryWhere }),
        prisma.nfeEntry.count({ where: { ...summaryWhere, manifestationStatus: "PENDENTE_MANIFESTACAO" } }),
        prisma.nfeEntry.count({ where: { ...summaryWhere, entryStatus: { in: ["PENDENTE_VALIDACAO", "PENDENTE_VINCULO_PRODUTOS", "PENDENTE_ESTOQUE", "PENDENTE_FINANCEIRO"] } } }),
        prisma.nfeEntry.count({ where: { ...summaryWhere, status: "ENTRADA_CONFIRMADA" } }),
        prisma.nfeEntry.count({ where: { ...summaryWhere, status: "COM_DIVERGENCIA" } }),
        prisma.nfeEntry.count({ where: { ...summaryWhere, status: "CANCELADA" } }),
      ]),
    ]);
    sendSuccess(response, {
      data: data.map(serializeEntry),
      summary: {
        total: summary[0],
        pendingManifestation: summary[1],
        pendingEntry: summary[2],
        confirmed: summary[3],
        divergence: summary[4],
        cancelled: summary[5],
      },
      pagination: paginationMeta(page, pageSize, total),
    });
  }),
);

nfeEntryRouter.post(
  "/sync",
  rateLimit({ key: "nfe-entry-sync", max: 20, windowMs: 60 * 60_000 }),
  asyncHandler(async (request, response) => {
    const startedAt = new Date();
    const log = await prisma.dfeSyncLog.create({
      data: {
        companyId: request.company.id,
        documentType: "NFE",
        mode: request.body?.mock === true ? "mock" : "existing",
        status: "RUNNING",
        startedAt,
        requestNsu: request.company.nfeLastNsu,
      },
    });
    const existingEntries = await syncExistingInboundDocuments(request.company.id, request.user.id);
    const mockEntries = request.body?.mock === true ? [await createMockInboundDocument(request.company, request.user.id)] : [];
    const entries = [...existingEntries, ...mockEntries].filter(Boolean);
    await prisma.dfeSyncLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        documentsFound: entries.length,
        documentsSaved: entries.length,
        finishedAt: new Date(),
        message: mockEntries.length ? "Sincronizacao DF-e mock isolada concluida." : "Documentos existentes conciliados.",
      },
    });
    sendSuccess(response, {
      data: entries.map(serializeEntry),
      message: `${entries.length} NF-e de entrada sincronizada(s).`,
    }, 201);
  }),
);

nfeEntryRouter.post(
  "/import-xml",
  rateLimit({ key: "nfe-entry-import", max: 30 }),
  xmlUpload.single("xml"),
  asyncHandler(async (request, response) => {
    const xml = request.file?.buffer?.toString("utf8") || request.body?.xml;
    if (!xml) throw new AppError("Envie o XML da NF-e.", "NFE_ENTRY_XML_REQUIRED", 422);
    const parsed = parseFiscalDocumentXml(xml);
    if (parsed.documentType !== "NFE" || parsed.model !== "55") {
      throw new AppError("O XML enviado nao e NF-e modelo 55.", "NFE_ENTRY_XML_NOT_NFE", 422);
    }
    if (normalizeCnpj(parsed.recipientCnpj) !== normalizeCnpj(request.company.cnpj)) {
      throw new AppError("O destinatario do XML nao e a empresa ativa.", "NFE_ENTRY_RECIPIENT_MISMATCH", 422);
    }
    if (parsed.isCancelled) {
      throw new AppError("XML cancelado sem evento de cancelamento correspondente.", "NFE_ENTRY_CANCELLED_XML_BLOCKED", 422);
    }
    const duplicate = await prisma.nfeEntry.findFirst({
      where: { companyId: request.company.id, accessKey: parsed.accessKey },
      select: { id: true },
    });
    if (duplicate) throw new AppError("NF-e de entrada ja importada.", "NFE_ENTRY_DUPLICATE", 409);
    const result = await importFiscalXml(request.company.id, xml, "NFE_ENTRY_IMPORT");
    const entry = await ensureEntryFromFiscalDocument(request.company.id, result.document.id, {
      source: "XML_IMPORTADO",
      userId: request.user.id,
    });
    await writeAudit({
      request,
      action: "nfe_entry.imported",
      companyId: request.company.id,
      entityType: "NfeEntry",
      entityId: entry.id,
      metadata: { accessKey: entry.accessKey },
    });
    sendSuccess(response, { data: serializeEntry(entry), message: "XML importado com sucesso." }, 201);
  }),
);

nfeEntryRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    sendSuccess(response, { data: serializeEntry(await findEntry(request.company.id, request.params.id)) });
  }),
);

nfeEntryRouter.get(
  "/:id/xml",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    sendSuccess(response, {
      id: entry.id,
      accessKey: entry.accessKey,
      xml: sanitizeXml(entry.xmlContent || entry.fiscalDocument?.rawXml || ""),
      hash: entry.xmlHashSha256 || entry.fiscalDocument?.xmlHashSha256,
    });
  }),
);

nfeEntryRouter.get(
  "/:id/danfe",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    sendSuccess(response, {
      data: {
        kind: "html",
        title: "DANFE - Documento Auxiliar da NF-e",
        accessKey: entry.accessKey,
        number: entry.number,
        series: entry.series,
        supplierName: entry.supplierName,
        recipientCnpj: entry.recipientCnpj,
        totalAmount: money(entry.totalAmount),
        html: `<section><h1>DANFE NF-e ${entry.number || ""}</h1><p>Fornecedor: ${entry.supplierName || "-"}</p><p>Chave: ${entry.accessKey}</p><p>Total: R$ ${money(entry.totalAmount).toFixed(2)}</p></section>`,
        fileName: `danfe-nfe-entrada-${entry.accessKey || entry.id}.html`,
        mimeType: "text/html;charset=utf-8",
        status: "READY",
        message: "DANFE de entrada disponível.",
      },
    });
  }),
);

nfeEntryRouter.post(
  "/:id/manifest",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    const manifestationStatus = normalizeManifestation(request.body?.eventType);
    if (!Object.values(MANIFESTATION_STATUS).includes(manifestationStatus)) {
      throw new AppError("Tipo de manifestacao invalido.", "NFE_ENTRY_MANIFESTATION_INVALID", 422);
    }
    const eventType = manifestationEventType(manifestationStatus);
    const protocol = nextProtocol("1352");
    await prisma.$transaction(async (tx) => {
      await tx.nfeEntryManifestation.create({
        data: {
          companyId: request.company.id,
          nfeEntryId: entry.id,
          eventType,
          protocol,
          status: "AUTHORIZED",
          justification: request.body?.justification || null,
          source: request.body?.mode === "real" ? "REAL_SEFAZ_PENDING" : "MOCK_DFE",
        },
      });
      await tx.nfeEntry.update({
        where: { id: entry.id },
        data: { manifestationStatus, status: manifestationStatus },
      });
      await tx.fiscalDocument.update({
        where: { id: entry.fiscalDocumentId },
        data: { manifestationStatus: eventType },
      });
      await addEntryEvent(tx, {
        companyId: request.company.id,
        entryId: entry.id,
        userId: request.user.id,
        eventType: "MANIFESTATION_REGISTERED",
        title: "Manifestacao registrada",
        description: `Evento ${eventType} registrado com protocolo ${protocol}.`,
        metadata: { protocol, eventType },
      });
    });
    const updated = await applyFiscalAnalysis(entry.id);
    sendSuccess(response, { data: serializeEntry(updated), protocol, message: "Manifestacao registrada." });
  }),
);

nfeEntryRouter.post(
  "/:id/link-products",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    const links = Array.isArray(request.body?.links) ? request.body.links : [];
    await prisma.$transaction(async (tx) => {
      if (!links.length) {
        await autoLinkProducts(tx, entry.id, request.company.id);
      }
      for (const link of links) {
        const item = await tx.nfeEntryItem.findFirst({ where: { id: link.itemId, nfeEntryId: entry.id, companyId: request.company.id } });
        if (!item) throw new AppError("Item da NF-e nao encontrado.", "NFE_ENTRY_ITEM_NOT_FOUND", 404);
        if (link.ignoreStock) {
          await tx.nfeEntryItem.update({ where: { id: item.id }, data: { productId: null, linkStatus: "IGNORADO_ESTOQUE", stockIgnored: true } });
          await tx.nfeEntryProductLink.deleteMany({ where: { nfeEntryItemId: item.id } });
          continue;
        }
        const product = await tx.product.findFirst({ where: { id: link.productId, companyId: request.company.id } });
        if (!product) throw new AppError("Produto interno nao encontrado.", "PRODUCT_NOT_FOUND", 404);
        await tx.nfeEntryItem.update({ where: { id: item.id }, data: { productId: product.id, linkStatus: "VINCULADO_MANUAL", stockIgnored: false, linkConfidence: 100 } });
        await tx.nfeEntryProductLink.upsert({
          where: { nfeEntryItemId: item.id },
          create: {
            companyId: request.company.id,
            nfeEntryId: entry.id,
            nfeEntryItemId: item.id,
            productId: product.id,
            supplierCnpj: entry.supplierCnpj,
            supplierProductCode: item.supplierProductCode,
            matchMethod: "MANUAL",
            confidence: 100,
          },
          update: { productId: product.id, matchMethod: "MANUAL", confidence: 100 },
        });
      }
      await addEntryEvent(tx, {
        companyId: request.company.id,
        entryId: entry.id,
        userId: request.user.id,
        eventType: "PRODUCTS_LINKED",
        title: "Produtos vinculados",
        description: links.length ? `${links.length} item(ns) revisado(s).` : "Vinculo automatico reprocessado.",
        metadata: { links: links.length },
      });
    });
    const updated = await applyFiscalAnalysis(entry.id);
    sendSuccess(response, { data: serializeEntry(updated), message: "Vinculo de produtos atualizado." });
  }),
);

nfeEntryRouter.post(
  "/:id/validate",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    const updated = await applyFiscalAnalysis(entry.id);
    await prisma.$transaction(async (tx) => {
      await addEntryEvent(tx, {
        companyId: request.company.id,
        entryId: entry.id,
        userId: request.user.id,
        eventType: "ENTRY_VALIDATED",
        title: "NF-e de entrada validada",
        description: "XML, fornecedor, itens e pendências foram revisados.",
        metadata: updated?.validationSummary || {},
      });
    });
    sendSuccess(response, { data: serializeEntry(await findEntry(request.company.id, entry.id)), message: "Validação da NF-e de entrada concluída." });
  }),
);

nfeEntryRouter.post(
  "/:id/prepare-inventory",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    const readiness = incomingInventoryReadiness({
      ...entry,
      status: BLOCKING_MANIFESTATIONS.has(entry.manifestationStatus) ? "CANCELADA" : entry.status,
    });
    const stockStatus = readiness.status;
    await prisma.$transaction(async (tx) => {
      await tx.nfeEntry.update({ where: { id: entry.id }, data: { stockStatus } });
      await addEntryEvent(tx, {
        companyId: request.company.id,
        entryId: entry.id,
        userId: request.user.id,
        eventType: "INVENTORY_PREPARED",
        title: !readiness.canPost ? "Pré-entrada bloqueada" : "Pré-entrada de estoque preparada",
        description: !readiness.canPost ? "Existem pendências críticas para o lançamento de estoque." : "Custos e quantidades foram preparados para conferência.",
        metadata: { stockStatus, items: entry.items.length },
      });
    });
    const updated = await findEntry(request.company.id, entry.id);
    sendSuccess(response, {
      data: serializeEntry(updated),
      inventory: { status: stockStatus, canPost: readiness.canPost, items: buildIncomingInventoryPlan(updated) },
      message: !readiness.canPost ? "Pré-entrada bloqueada por pendências." : "Pré-entrada de estoque preparada para confirmação.",
    });
  }),
);

nfeEntryRouter.post(
  "/:id/confirm-entry",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    await postInventoryEntry({ entry, companyId: request.company.id, userId: request.user.id });
    const updated = await applyFiscalAnalysis(entry.id);
    sendSuccess(response, { data: serializeEntry(updated), message: "Entrada confirmada e estoque atualizado." });
  }),
);

nfeEntryRouter.post(
  "/:id/post-inventory",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    if (entry.stockPostedAt || entry.status === "ENTRADA_CONFIRMADA") {
      throw new AppError("Entrada ja confirmada para esta NF-e.", "NFE_ENTRY_ALREADY_CONFIRMED", 409);
    }
    if (entry.stockStatus !== "READY_TO_POST") {
      throw new AppError("Prepare e revise a entrada de estoque antes de confirmar.", "NFE_ENTRY_INVENTORY_NOT_READY", 422);
    }
    const updated = await postInventoryEntry({ entry, companyId: request.company.id, userId: request.user.id });
    sendSuccess(response, { data: serializeEntry(await applyFiscalAnalysis(updated.id)), message: "Entrada confirmada e estoque atualizado." });
  }),
);

nfeEntryRouter.post(
  "/:id/generate-payables",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    if (entry.payables?.length && !request.body?.force) {
      sendSuccess(response, { data: serializeEntry(entry), message: "Financeiro ja gerado para esta NF-e." });
      return;
    }
    const installments = Array.isArray(request.body?.installments) && request.body.installments.length
      ? request.body.installments
      : [{ number: "001", dueDate: addDays(new Date(), 30), amount: money(entry.totalAmount) }];
    const installmentIssues = validateIncomingPayableInstallments(entry, installments, asDate);
    if (installmentIssues.length) {
      throw new AppError("As parcelas informadas não conferem com a NF-e.", "NFE_ENTRY_PAYABLES_INVALID", 422, installmentIssues);
    }
    await prisma.$transaction(async (tx) => {
      if (request.body?.force) await tx.payable.deleteMany({ where: { nfeEntryId: entry.id, companyId: request.company.id } });
      for (const installment of installments) {
        await tx.payable.upsert({
          where: { nfeEntryId_installmentNumber: { nfeEntryId: entry.id, installmentNumber: String(installment.number || installment.installmentNumber || "001") } },
          create: {
            companyId: request.company.id,
            nfeEntryId: entry.id,
            supplierId: entry.supplierId,
            supplierName: entry.supplierName,
            supplierCnpj: entry.supplierCnpj,
            installmentNumber: String(installment.number || installment.installmentNumber || "001"),
            dueDate: asDate(installment.dueDate) || addDays(new Date(), 30),
            amount: money(installment.amount),
            paymentMethod: installment.paymentMethod || request.body?.paymentMethod || null,
          },
          update: {
            dueDate: asDate(installment.dueDate) || addDays(new Date(), 30),
            amount: money(installment.amount),
            paymentMethod: installment.paymentMethod || request.body?.paymentMethod || null,
          },
        });
      }
      await tx.nfeEntry.update({
        where: { id: entry.id },
        data: {
          financialStatus: "FINANCEIRO_GERADO",
          financialGeneratedAt: new Date(),
          status: entry.stockPostedAt ? "ENTRADA_CONFIRMADA" : "PENDENTE_ESTOQUE",
          entryStatus: entry.stockPostedAt ? "ENTRADA_CONFIRMADA" : "PENDENTE_ESTOQUE",
        },
      });
      await addEntryEvent(tx, {
        companyId: request.company.id,
        entryId: entry.id,
        userId: request.user.id,
        eventType: "PAYABLES_GENERATED",
        title: "Financeiro gerado",
        description: `${installments.length} conta(s) a pagar criada(s).`,
        metadata: { installments: installments.length },
      });
    });
    const updated = await applyFiscalAnalysis(entry.id);
    sendSuccess(response, { data: serializeEntry(updated), message: "Contas a pagar geradas." });
  }),
);

nfeEntryRouter.post(
  "/:id/prepare-bookkeeping",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    const blockingAlerts = entry.alerts.filter((alert) => alert.severity === "error");
    if (blockingAlerts.length || entry.status === "CANCELADA") {
      throw new AppError("Documento bloqueado para SPED/SINTEGRA até resolver as pendências fiscais.", "NFE_ENTRY_BOOKKEEPING_BLOCKED", 422, blockingAlerts.map((alert) => alert.id));
    }
    await prisma.$transaction(async (tx) => {
      await addEntryEvent(tx, {
        companyId: request.company.id,
        entryId: entry.id,
        userId: request.user.id,
        eventType: "BOOKKEEPING_PREPARED",
        title: "Documento preparado para escrituração",
        description: "NF-e de entrada disponibilizada para os fluxos de SPED e SINTEGRA.",
        metadata: { accessKey: entry.accessKey, model: "55", cfops: [...new Set(entry.items.map((item) => item.cfop).filter(Boolean))] },
      });
    });
    sendSuccess(response, { data: serializeEntry(await findEntry(request.company.id, entry.id)), message: "Documento preparado para SPED/SINTEGRA." });
  }),
);

nfeEntryRouter.post(
  "/:id/ignore",
  asyncHandler(async (request, response) => {
    const entry = await findEntry(request.company.id, request.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.nfeEntry.update({
        where: { id: entry.id },
        data: { status: "IGNORADA", entryStatus: "IGNORADA", ignoredAt: new Date(), auditTrail: { reason: request.body?.reason || null } },
      });
      await addEntryEvent(tx, {
        companyId: request.company.id,
        entryId: entry.id,
        userId: request.user.id,
        eventType: "ENTRY_IGNORED",
        title: "Documento ignorado",
        description: request.body?.reason || "NF-e removida do fluxo operacional.",
      });
    });
    sendSuccess(response, { data: serializeEntry(await findEntry(request.company.id, entry.id)), message: "Documento ignorado." });
  }),
);

cteEntryRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, pageSize, skip, take } = getPagination(request.query, 20);
    const where = { companyId: request.company.id };
    const [data, total] = await Promise.all([
      prisma.cteEntry.findMany({ where, include: { nfeLinks: { include: { nfeEntry: true } } }, orderBy: { issueDate: "desc" }, skip, take }),
      prisma.cteEntry.count({ where }),
    ]);
    sendSuccess(response, { data: data.map(serializeCte), pagination: paginationMeta(page, pageSize, total) });
  }),
);

cteEntryRouter.post(
  "/sync",
  asyncHandler(async (request, response) => {
    const transports = await prisma.transportDocument.findMany({
      where: { companyId: request.company.id, cteEntry: null },
      take: 50,
      orderBy: { emissionDate: "desc" },
    });
    const entries = [];
    for (const transport of transports) entries.push(await createOrUpdateCteEntryFromTransport(request.company.id, transport.id));
    if (request.body?.mock === true && !entries.length) {
      const nfe = await prisma.nfeEntry.findFirst({ where: { companyId: request.company.id }, orderBy: { createdAt: "desc" } });
      const accessKey = buildMockNfeAccessKey({
        uf: request.company.uf || "SP",
        issuerCnpj: "22333444000155",
        invoiceNumber: Math.floor(100000 + Math.random() * 899999),
        series: "1",
        model: "57",
        seed: randomUUID(),
      });
      const cte = await prisma.cteEntry.create({
        data: {
          companyId: request.company.id,
          accessKey,
          number: String(Math.floor(10000 + Math.random() * 89999)),
          series: "1",
          issueDate: new Date(),
          carrierName: "TRANSPORTADORA MOCK DFE",
          carrierCnpj: "22333444000155",
          recipientCnpj: normalizeCnpj(request.company.cnpj),
          freightAmount: 150,
          status: "AUTHORIZED",
          sefazStatus: "AUTHORIZED",
          referencedNfeKeys: nfe ? [nfe.accessKey] : [],
          source: "MOCK_DFE",
        },
      });
      if (nfe) {
        await prisma.cteEntryNfeLink.create({
          data: { companyId: request.company.id, cteEntryId: cte.id, nfeEntryId: nfe.id, nfeAccessKey: nfe.accessKey, freightShare: 150, source: "MOCK_DFE" },
        });
        await prisma.nfeEntry.update({ where: { id: nfe.id }, data: { cteStatus: "CTE_VINCULADO" } });
      }
      entries.push(await prisma.cteEntry.findUnique({ where: { id: cte.id }, include: { nfeLinks: { include: { nfeEntry: true } } } }));
    }
    sendSuccess(response, { data: entries.map(serializeCte), message: `${entries.length} CT-e de entrada sincronizado(s).` }, 201);
  }),
);

cteEntryRouter.post(
  "/:id/link-nfe",
  asyncHandler(async (request, response) => {
    const cte = await prisma.cteEntry.findFirst({ where: { id: request.params.id, companyId: request.company.id } });
    if (!cte) throw new AppError("CT-e de entrada nao encontrado.", "CTE_ENTRY_NOT_FOUND", 404);
    const nfe = request.body?.nfeEntryId
      ? await prisma.nfeEntry.findFirst({ where: { id: request.body.nfeEntryId, companyId: request.company.id } })
      : await prisma.nfeEntry.findFirst({ where: { accessKey: request.body?.nfeAccessKey, companyId: request.company.id } });
    if (!nfe) throw new AppError("NF-e de entrada para vinculo nao encontrada.", "NFE_ENTRY_NOT_FOUND", 404);
    await prisma.cteEntryNfeLink.upsert({
      where: { companyId_cteEntryId_nfeAccessKey: { companyId: request.company.id, cteEntryId: cte.id, nfeAccessKey: nfe.accessKey } },
      create: {
        companyId: request.company.id,
        cteEntryId: cte.id,
        nfeEntryId: nfe.id,
        nfeAccessKey: nfe.accessKey,
        freightShare: money(request.body?.freightShare ?? cte.freightAmount),
        source: "MANUAL",
      },
      update: { nfeEntryId: nfe.id, freightShare: money(request.body?.freightShare ?? cte.freightAmount) },
    });
    await prisma.nfeEntry.update({ where: { id: nfe.id }, data: { cteStatus: "CTE_VINCULADO" } });
    sendSuccess(response, { data: serializeCte(await prisma.cteEntry.findUnique({ where: { id: cte.id }, include: { nfeLinks: { include: { nfeEntry: true } } } })), message: "CT-e vinculado a NF-e." });
  }),
);

cteEntryRouter.post("/:id/calculate-allocation", asyncHandler(async (request, response) => {
  const { method, allocatableValue, manualAllocations, configuration } = request.body || {};
  if (!method || allocatableValue === undefined) throw new AppError("Método e valor rateável são obrigatórios.", "CTE_ALLOCATION_INVALID_VALUE", 422);
  const data = await calculateAllocation({ companyId: request.company.id, cteEntryId: request.params.id, userId: request.user.id, method, allocatableValue, manualAllocations, configuration });
  sendSuccess(response, { data, requestId: request.id }, 201);
}));

cteEntryRouter.get("/:id/allocation", asyncHandler(async (request, response) => {
  const data = await getAllocation(request.company.id, request.params.id);
  sendSuccess(response, { data, requestId: request.id });
}));

cteEntryRouter.post("/:id/confirm-allocation", asyncHandler(async (request, response) => {
  if (!request.body?.calculationHash) throw new AppError("Hash do cálculo é obrigatório.", "CTE_ALLOCATION_STALE_CALCULATION", 422);
  const data = await confirmAllocation({ companyId: request.company.id, cteEntryId: request.params.id, userId: request.user.id, calculationHash: request.body.calculationHash });
  sendSuccess(response, { data, requestId: request.id });
}));

cteEntryRouter.post("/:id/reset-allocation", asyncHandler(async (request, response) => {
  await resetAllocation({ companyId: request.company.id, cteEntryId: request.params.id, userId: request.user.id, reason: request.body?.reason });
  sendSuccess(response, { data: { status: "PENDING_CONFIGURATION" }, requestId: request.id });
}));

cteEntryRouter.delete("/:id/link-nfe/:linkId", asyncHandler(async (request, response) => {
  await removeNfeLink({ companyId: request.company.id, cteEntryId: request.params.id, linkId: request.params.linkId, userId: request.user.id });
  sendSuccess(response, { data: { deleted: true }, requestId: request.id });
}));

cteEntryRouter.get("/:id/available-nfe", asyncHandler(async (request, response) => {
  const data = await prisma.nfeEntry.findMany({ where: { companyId: request.company.id, cteLinks: { none: { cteEntryId: request.params.id } } }, select: { id: true, accessKey: true, number: true, series: true, productsAmount: true, totalAmount: true }, take: 100 });
  sendSuccess(response, { data, requestId: request.id });
}));
