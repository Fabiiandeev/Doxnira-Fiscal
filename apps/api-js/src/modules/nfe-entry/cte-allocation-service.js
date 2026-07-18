import { createHash } from "node:crypto";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { calculateCteAllocation } from "./cte-allocation-rules.js";

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;

export function allocationHash(input) {
  return createHash("sha256").update(JSON.stringify(stable(input))).digest("hex");
}

function error(message, code, status = 422) { throw new AppError(message, code, status); }

function asCents(value) { return Math.round(Number(value || 0) * 100); }

function projectItems(items, allocatedValue) {
  if (!items.length) return [];
  const totalBase = items.reduce((sum, item) => sum + Number(item.totalValue || 0), 0);
  const cents = asCents(allocatedValue);
  const ranked = [...items].sort((a, b) => a.itemNumber - b.itemNumber || String(a.id).localeCompare(String(b.id)));
  if (totalBase <= 0) return ranked.map((item, index) => ({
    ...item, calculationBase: "0", percentage: "0", allocatedValue: ((index === 0 ? cents : 0) / 100).toFixed(2),
    projectedUnitImpact: "0",
  }));
  const projected = ranked.map((item) => ({ ...item, raw: Math.floor((cents * Number(item.totalValue || 0)) / totalBase) }));
  projected[0].raw += cents - projected.reduce((sum, item) => sum + item.raw, 0);
  return projected.map((item) => ({
    ...item, calculationBase: String(item.totalValue || 0), percentage: ((Number(item.totalValue || 0) / totalBase) * 100).toFixed(6),
    allocatedValue: (item.raw / 100).toFixed(2), projectedUnitImpact: item.quantity && Number(item.quantity) > 0 ? (item.raw / 100 / Number(item.quantity)).toFixed(6) : "0",
  }));
}

async function cteWithLinks(companyId, cteEntryId) {
  const cte = await prisma.cteEntry.findFirst({
    where: { id: cteEntryId, companyId },
    include: { nfeLinks: { where: { nfeEntryId: { not: null } }, include: { nfeEntry: { include: { items: { include: { product: true } } } } } } },
  });
  if (!cte) error("CT-e não encontrado para a empresa.", "CTE_ALLOCATION_CROSS_COMPANY", 404);
  if (!cte.nfeLinks.length) error("Nenhuma NF-e vinculada ao CT-e.", "CTE_ALLOCATION_NO_LINKED_NFE");
  return cte;
}

async function audit(tx, companyId, cteEntryId, userId, action, metadata) {
  return tx.cteEntryAuditLog.create({ data: { companyId, cteEntryId, userId, action, metadata } });
}

export async function calculateAllocation({ companyId, cteEntryId, userId, method, allocatableValue, manualAllocations = [], configuration = {} }) {
  if (!["VALUE", "QUANTITY", "WEIGHT", "VOLUME", "MANUAL"].includes(method)) error("Método de rateio inválido.", "CTE_ALLOCATION_INVALID_VALUE");
  const cte = await cteWithLinks(companyId, cteEntryId);
  const documents = cte.nfeLinks.map((link) => ({
    id: link.nfeEntryId, linkId: link.id, accessKey: link.nfeEntry.accessKey, number: link.nfeEntry.number,
    series: link.nfeEntry.series, productsAmount: link.nfeEntry.productsAmount, totalAmount: link.nfeEntry.totalAmount,
    quantity: link.nfeEntry.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    weight: link.nfeEntry.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.product?.weight || 0), 0),
    volume: link.nfeEntry.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.product?.length || 0) * Number(item.product?.width || 0) * Number(item.product?.height || 0), 0),
    items: link.nfeEntry.items,
  }));
  let result;
  try { result = calculateCteAllocation({ method, allocatableValue, documents, manualAllocations }); }
  catch (cause) {
    const code = String(cause.message).endsWith("_BASE_REQUIRED") ? "CTE_ALLOCATION_ZERO_BASE" : cause.message;
    error("Não foi possível calcular o rateio.", code);
  }
  const calculationHash = allocationHash({ cte: { accessKey: cte.accessKey, freightAmount: String(cte.freightAmount) }, method, allocatableValue: result.allocatableValue, configuration, documents: result.documents.map(({ nfeEntryId, calculationBase, allocatedValue }) => ({ nfeEntryId, calculationBase, allocatedValue })), manualAllocations, engineVersion: "1" });
  return prisma.$transaction(async (tx) => {
    const confirmed = await tx.cteAllocation.findFirst({ where: { companyId, cteEntryId, status: "CONFIRMED" } });
    if (confirmed) error("Rateio já confirmado.", "CTE_ALLOCATION_ALREADY_CONFIRMED", 409);
    await tx.cteAllocation.deleteMany({ where: { companyId, cteEntryId, status: { in: ["PENDING_CONFIGURATION", "CALCULATED", "NOT_ALLOCATED", "BLOCKED"] } } });
    const allocation = await tx.cteAllocation.create({ data: {
      companyId, cteEntryId, method, status: "CALCULATED", serviceTotal: cte.freightAmount, allocatableValue: result.allocatableValue,
      allocatedValue: result.allocatedValue, residualValue: result.residualValue, configuration, calculationHash, createdBy: userId,
      documents: { create: result.documents.map((document) => {
        const linked = documents.find((item) => item.id === document.nfeEntryId);
        return {
          companyId, cteEntryNfeLinkId: linked.linkId, nfeEntryId: document.nfeEntryId, calculationBase: document.calculationBase,
          percentage: document.percentage, calculatedValue: document.calculatedValue, residualAdjustment: document.residualAdjustment,
          allocatedValue: document.allocatedValue, source: method === "MANUAL" ? "MANUAL" : "CALCULATED",
          items: { create: projectItems(linked.items, document.allocatedValue).map((item) => ({ companyId, nfeEntryItemId: item.id, productId: item.productId, calculationBase: item.calculationBase, percentage: item.percentage, allocatedValue: item.allocatedValue, projectedUnitImpact: item.projectedUnitImpact })) },
        };
      }) },
    }, include: { documents: true } });
    await audit(tx, companyId, cteEntryId, userId, "CTE_ALLOCATION_CALCULATED", { calculationHash, method });
    return allocation;
  });
}

export async function getAllocation(companyId, cteEntryId) {
  await cteWithLinks(companyId, cteEntryId);
  return prisma.cteAllocation.findFirst({ where: { companyId, cteEntryId }, include: { documents: { include: { items: true } } }, orderBy: { version: "desc" } });
}

export async function confirmAllocation({ companyId, cteEntryId, userId, calculationHash }) {
  await cteWithLinks(companyId, cteEntryId);
  return prisma.$transaction(async (tx) => {
    const allocation = await tx.cteAllocation.findFirst({ where: { companyId, cteEntryId }, include: { documents: true }, orderBy: { version: "desc" } });
    if (!allocation) error("Rateio não calculado.", "CTE_ALLOCATION_INVALID_STATUS");
    if (allocation.status === "CONFIRMED") {
      if (allocation.calculationHash === calculationHash) return allocation;
      error("Hash de confirmação diverge do rateio confirmado.", "CTE_ALLOCATION_CONFIRMATION_CONFLICT", 409);
    }
    if (allocation.status !== "CALCULATED") error("Status não permite confirmação.", "CTE_ALLOCATION_INVALID_STATUS");
    if (allocation.calculationHash !== calculationHash) error("O cálculo está desatualizado.", "CTE_ALLOCATION_STALE_CALCULATION", 409);
    if (Number(allocation.allocatedValue) !== Number(allocation.allocatableValue) || allocation.documents.some((item) => Number(item.allocatedValue) < 0)) error("Total do rateio não fecha.", "CTE_ALLOCATION_TOTAL_MISMATCH");
    const updated = await tx.cteAllocation.update({ where: { id: allocation.id }, data: { status: "CONFIRMED", confirmedBy: userId, confirmedAt: new Date() }, include: { documents: true } });
    await audit(tx, companyId, cteEntryId, userId, "CTE_ALLOCATION_CONFIRMED", { calculationHash });
    return updated;
  });
}

export async function resetAllocation({ companyId, cteEntryId, userId, reason }) {
  return prisma.$transaction(async (tx) => {
    const allocation = await tx.cteAllocation.findFirst({ where: { companyId, cteEntryId }, orderBy: { version: "desc" } });
    if (!allocation || !["CALCULATED", "CONFIRMED"].includes(allocation.status) || allocation.appliedAt) error("Rateio não pode ser resetado.", "CTE_ALLOCATION_RESET_NOT_ALLOWED", 409);
    await tx.cteAllocation.update({ where: { id: allocation.id }, data: { status: "PENDING_CONFIGURATION", version: { increment: 1 } } });
    await audit(tx, companyId, cteEntryId, userId, "CTE_ALLOCATION_RESET", { reason: reason || null });
  });
}

export async function removeNfeLink({ companyId, cteEntryId, linkId, userId }) {
  const allocation = await prisma.cteAllocation.findFirst({ where: { companyId, cteEntryId, status: { in: ["CALCULATED", "CONFIRMED", "APPLIED"] } } });
  if (allocation) { await prisma.$transaction((tx) => audit(tx, companyId, cteEntryId, userId, "CTE_NFE_LINK_REMOVE_BLOCKED", { linkId, status: allocation.status })); error("Vínculo protegido pelo rateio.", "CTE_NFE_LINK_LOCKED", 409); }
  const removed = await prisma.cteEntryNfeLink.deleteMany({ where: { id: linkId, companyId, cteEntryId } });
  if (!removed.count) error("Vínculo não encontrado.", "CTE_NFE_LINK_NOT_FOUND", 404);
}
