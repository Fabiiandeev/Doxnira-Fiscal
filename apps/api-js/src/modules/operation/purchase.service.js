import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { applyMovement } from "./inventory.service.js";
import { inventoryConflict, inventoryValidation, operationNotFound } from "./operation-errors.js";
import { scopedPurchase } from "./operation.repository.js";

const D = (value) => new Prisma.Decimal(value ?? 0);
const itemTotal = (item) => D(item.quantity).mul(item.unitValue).minus(item.discountAmount).plus(item.taxAmount);
const validatePurchaseResources = async (tx, companyId, input) => {
  const [supplier, warehouse, products] = await Promise.all([
    tx.fornecedor.findFirst({ where: { id: input.supplierId, companyId } }),
    tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId, status: "ACTIVE" } }),
    tx.product.count({ where: { id: { in: [...new Set(input.items.map((item) => item.productId))] }, companyId, active: true } }),
  ]);
  if (!supplier || !warehouse || products !== new Set(input.items.map((item) => item.productId)).size) throw operationNotFound("Fornecedor, depósito ou produto");
  const calculated = input.items.reduce((sum, item) => sum.plus(itemTotal(item)), D(input.freightAmount).minus(input.discountAmount).plus(input.taxAmount));
  if (!calculated.eq(input.totalAmount)) throw inventoryValidation("O total da compra diverge dos itens, frete, desconto e impostos.");
  const installmentTotal = input.installments.reduce((sum, item) => sum.plus(item.amount), D(0));
  if (input.installments.length && !installmentTotal.eq(input.totalAmount)) throw inventoryValidation("A soma das parcelas diverge do total.");
};
const itemData = (companyId, item) => ({
  companyId, productId: item.productId, quantity: item.quantity, unitCost: item.unitValue,
  discountAmount: item.discountAmount, taxAmount: item.taxAmount, totalAmount: itemTotal(item),
});
export const createPurchase = (companyId, userId, input) => prisma.$transaction(async (tx) => {
  await validatePurchaseResources(tx, companyId, input);
  return tx.purchaseOrder.create({ data: {
    companyId, buyerId: userId, number: input.number, supplierId: input.supplierId, warehouseId: input.warehouseId,
    issueDate: input.issueDate, expectedDate: input.expectedDate, competenceDate: input.competenceDate,
    paymentCondition: input.paymentCondition, freightAmount: input.freightAmount, discountAmount: input.discountAmount,
    taxAmount: input.taxAmount, totalAmount: input.totalAmount, installments: input.installments,
    attachments: input.attachments, notes: input.notes, externalKey: input.externalKey,
    items: { create: input.items.map((item) => itemData(companyId, item)) },
  }, include: { items: true } });
});
export const updatePurchase = (companyId, id, input) => prisma.$transaction(async (tx) => {
  const current = await scopedPurchase(tx, companyId, id);
  if (!current) throw operationNotFound("Compra");
  if (current.status !== "DRAFT") throw inventoryConflict("Somente compras em rascunho podem ser editadas.");
  await validatePurchaseResources(tx, companyId, input);
  await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: current.id } });
  return tx.purchaseOrder.update({ where: { id: current.id }, data: {
    number: input.number, supplierId: input.supplierId, warehouseId: input.warehouseId, issueDate: input.issueDate,
    expectedDate: input.expectedDate, competenceDate: input.competenceDate, paymentCondition: input.paymentCondition,
    freightAmount: input.freightAmount, discountAmount: input.discountAmount, taxAmount: input.taxAmount,
    totalAmount: input.totalAmount, installments: input.installments, attachments: input.attachments,
    notes: input.notes, externalKey: input.externalKey, items: { create: input.items.map((item) => itemData(companyId, item)) },
  }, include: { items: true } });
});
export const transitionPurchase = async (companyId, id, action, reason) => {
  const current = await scopedPurchase(prisma, companyId, id);
  if (!current) throw operationNotFound("Compra");
  const transitions = {
    submit: current.status === "DRAFT" && { status: "PENDING_APPROVAL", submittedAt: new Date() },
    approve: current.status === "PENDING_APPROVAL" && { status: "APPROVED", approvedAt: new Date() },
    reject: current.status === "PENDING_APPROVAL" && { status: "REJECTED", rejectionReason: reason },
    cancel: ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(current.status) && { status: "CANCELED", cancellationReason: reason },
  };
  const data = transitions[action];
  if (!data) throw inventoryConflict("Transição inválida para o estado atual da compra.");
  return prisma.purchaseOrder.update({ where: { id: current.id }, data });
};
export const receivePurchase = (companyId, userId, id, input) => prisma.$transaction(async (tx) => {
  const duplicate = await tx.purchaseReceipt.findUnique({ where: { companyId_idempotencyKey: { companyId, idempotencyKey: input.idempotencyKey } }, include: { items: true } });
  if (duplicate) return duplicate;
  const order = await scopedPurchase(tx, companyId, id);
  if (!order) throw operationNotFound("Compra");
  if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)) throw inventoryConflict("Compra não está liberada para recebimento.");
  if (input.nfeEntryId && !await tx.nfeEntry.findFirst({ where: { id: input.nfeEntryId, companyId } })) throw operationNotFound("NF-e de entrada");
  const receipt = await tx.purchaseReceipt.create({ data: { companyId, purchaseOrderId: order.id, supplierId: order.supplierId, warehouseId: order.warehouseId, nfeEntryId: input.nfeEntryId, idempotencyKey: input.idempotencyKey, justification: input.justification, userId } });
  for (const received of input.items) {
    const item = order.items.find((candidate) => candidate.id === received.purchaseOrderItemId);
    if (!item) throw operationNotFound("Item da compra");
    const next = D(item.receivedQuantity).plus(received.quantity);
    if (next.gt(item.quantity) && (!input.confirmExcess || !input.justification?.trim())) throw inventoryConflict("Recebimento excedente exige confirmação e justificativa.", "PURCHASE_EXCESS_CONFIRMATION_REQUIRED");
    const cost = received.unitCost ?? item.unitCost;
    const movement = await applyMovement(tx, { companyId, userId, warehouseId: order.warehouseId, productId: item.productId, quantity: received.quantity, unitCost: cost, type: "PURCHASE_RECEIPT", sourceType: "PURCHASE_RECEIPT", sourceId: receipt.id, idempotencyKey: `purchase-receipt:${receipt.id}:${item.id}`, reason: input.justification || `Recebimento da compra ${order.number}` });
    await tx.purchaseReceiptItem.create({ data: { companyId, purchaseReceiptId: receipt.id, purchaseOrderItemId: item.id, productId: item.productId, orderedQuantity: item.quantity, previousQuantity: item.receivedQuantity, receivedQuantity: received.quantity, divergenceQuantity: next.minus(item.quantity), unitCost: cost, inventoryMovementId: movement.id } });
    await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQuantity: next } });
  }
  const refreshed = await scopedPurchase(tx, companyId, id);
  const complete = refreshed.items.every((item) => D(item.receivedQuantity).gte(item.quantity));
  await tx.purchaseOrder.update({ where: { id }, data: { status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED", ...(complete ? { completedAt: new Date() } : {}) } });
  const installments = Array.isArray(order.installments) && order.installments.length ? order.installments : [{ number: "1", dueDate: order.expectedDate || order.issueDate, amount: order.totalAmount }];
  for (const installment of installments) await tx.payable.upsert({
    where: { companyId_externalKey_installmentNumber: { companyId, externalKey: `purchase:${order.id}`, installmentNumber: String(installment.number) } },
    create: { companyId, supplierId: order.supplierId, supplierName: order.supplier.razaoSocial || order.supplier.nome || order.supplier.nomeFantasia, installmentNumber: String(installment.number), dueDate: new Date(installment.dueDate), amount: installment.amount, description: `Compra ${order.number}`, competenceDate: order.competenceDate, issueDate: order.issueDate, totalInstallments: installments.length, externalKey: `purchase:${order.id}`, source: "PURCHASE_ORDER" },
    update: {},
  });
  return tx.purchaseReceipt.findUnique({ where: { id: receipt.id }, include: { items: true } });
});
