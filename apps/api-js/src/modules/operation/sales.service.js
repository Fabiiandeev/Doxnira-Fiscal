import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { applyMovement } from "./inventory.service.js";
import { inventoryConflict, inventoryValidation, operationNotFound } from "./operation-errors.js";
import { scopedSale } from "./operation.repository.js";

const D = (value) => new Prisma.Decimal(value ?? 0);
const itemTotal = (item) => D(item.quantity).mul(item.unitValue).minus(item.discountAmount).plus(item.taxAmount);
const validateSalesResources = async (tx, companyId, input) => {
  const ids = [...new Set(input.items.map((item) => item.productId))];
  const [client, warehouse, products] = await Promise.all([
    tx.client.findFirst({ where: { id: input.clientId, companyId } }),
    tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId, status: "ACTIVE" } }),
    tx.product.count({ where: { id: { in: ids }, companyId, active: true } }),
  ]);
  if (!client || !warehouse || products !== ids.length) throw operationNotFound("Cliente, depósito ou produto");
  const calculated = input.items.reduce((sum, item) => sum.plus(itemTotal(item)), D(input.freightAmount).minus(input.discountAmount).plus(input.taxAmount));
  if (!calculated.eq(input.totalAmount)) throw inventoryValidation("O total da venda diverge dos itens, frete, desconto e impostos.");
};
const itemData = (companyId, item) => ({ companyId, productId: item.productId, quantity: item.quantity, unitPrice: item.unitValue, discountAmount: item.discountAmount, taxAmount: item.taxAmount, totalAmount: itemTotal(item) });
export const createSale = (companyId, userId, input) => prisma.$transaction(async (tx) => {
  await validateSalesResources(tx, companyId, input);
  return tx.salesOrder.create({ data: {
    companyId, sellerId: userId, number: input.number, origin: input.origin, externalKey: input.externalKey,
    marketplaceOrderId: input.marketplaceOrderId, clientId: input.clientId, warehouseId: input.warehouseId,
    issueDate: input.issueDate, paymentCondition: input.paymentCondition, freightAmount: input.freightAmount,
    discountAmount: input.discountAmount, taxAmount: input.taxAmount, totalAmount: input.totalAmount, notes: input.notes,
    items: { create: input.items.map((item) => itemData(companyId, item)) },
  }, include: { items: true } });
});
export const updateSale = (companyId, id, input) => prisma.$transaction(async (tx) => {
  const current = await scopedSale(tx, companyId, id);
  if (!current) throw operationNotFound("Venda");
  if (current.status !== "DRAFT") throw inventoryConflict("Somente vendas em rascunho podem ser editadas.");
  await validateSalesResources(tx, companyId, input);
  await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
  return tx.salesOrder.update({ where: { id }, data: {
    number: input.number, origin: input.origin, externalKey: input.externalKey, marketplaceOrderId: input.marketplaceOrderId,
    clientId: input.clientId, warehouseId: input.warehouseId, issueDate: input.issueDate,
    paymentCondition: input.paymentCondition, freightAmount: input.freightAmount, discountAmount: input.discountAmount,
    taxAmount: input.taxAmount, totalAmount: input.totalAmount, notes: input.notes,
    items: { create: input.items.map((item) => itemData(companyId, item)) },
  }, include: { items: true } });
});
export const transitionSale = async (companyId, id, action, reason) => {
  const current = await scopedSale(prisma, companyId, id);
  if (!current) throw operationNotFound("Venda");
  const transitions = {
    submit: current.status === "DRAFT" && { status: "PENDING_APPROVAL", submittedAt: new Date() },
    approve: current.status === "PENDING_APPROVAL" && { status: "APPROVED", approvedAt: new Date() },
    reject: current.status === "PENDING_APPROVAL" && { status: "REJECTED", rejectionReason: reason },
    ship: current.status === "INVOICED" ? { status: "SHIPPED", shippedAt: new Date() } : current.status === "SHIPPED" && { status: "COMPLETED", completedAt: new Date() },
  };
  const data = transitions[action];
  if (!data) throw inventoryConflict("Transição inválida para o estado atual da venda.");
  return prisma.salesOrder.update({ where: { id }, data });
};
export const reserveSale = (companyId, id) => prisma.$transaction(async (tx) => {
  const order = await scopedSale(tx, companyId, id);
  if (!order) throw operationNotFound("Venda");
  if (!["APPROVED", "RESERVED"].includes(order.status)) throw inventoryConflict("Venda não está liberada para reserva.");
  for (const item of order.items) {
    const remaining = D(item.quantity).minus(item.reservedQuantity).minus(item.invoicedQuantity);
    if (remaining.lte(0)) continue;
    const key = `sale:${order.id}:${item.id}`;
    if (await tx.inventoryReservation.findUnique({ where: { companyId_externalKey: { companyId, externalKey: key } } })) continue;
    const balance = await tx.inventoryBalance.findUnique({ where: { warehouseId_productId: { warehouseId: order.warehouseId, productId: item.productId } } });
    if (!balance || D(balance.physicalQuantity).minus(balance.reservedQuantity).lt(remaining)) throw inventoryConflict("Saldo disponível insuficiente para reservar a venda.", "INSUFFICIENT_STOCK");
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { reservedQuantity: { increment: remaining } } });
    await tx.inventoryReservation.create({ data: { companyId, warehouseId: order.warehouseId, productId: item.productId, quantity: remaining, sourceType: "SALES_ORDER", sourceId: order.id, externalKey: key } });
    await tx.salesOrderItem.update({ where: { id: item.id }, data: { reservedQuantity: { increment: remaining } } });
  }
  return tx.salesOrder.update({ where: { id }, data: { status: "RESERVED" }, include: { items: true } });
});
export const releaseSale = (companyId, id) => prisma.$transaction(async (tx) => {
  const order = await scopedSale(tx, companyId, id);
  if (!order) throw operationNotFound("Venda");
  if (!["RESERVED", "APPROVED"].includes(order.status)) throw inventoryConflict("Venda não possui reserva liberável.");
  const reservations = await tx.inventoryReservation.findMany({ where: { companyId, sourceType: "SALES_ORDER", sourceId: order.id, status: "ACTIVE" } });
  for (const reservation of reservations) {
    const balance = await tx.inventoryBalance.findUnique({ where: { warehouseId_productId: { warehouseId: reservation.warehouseId, productId: reservation.productId } } });
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { reservedQuantity: { decrement: reservation.quantity } } });
    await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED", releasedAt: new Date() } });
  }
  await tx.salesOrderItem.updateMany({ where: { salesOrderId: id }, data: { reservedQuantity: 0 } });
  return tx.salesOrder.update({ where: { id }, data: { status: "APPROVED" } });
});
export const invoiceSale = (companyId, userId, id, input) => prisma.$transaction(async (tx) => {
  const duplicate = await tx.salesInvoiceAllocation.findUnique({ where: { companyId_idempotencyKey: { companyId, idempotencyKey: input.idempotencyKey } } });
  if (duplicate) return duplicate;
  const order = await scopedSale(tx, companyId, id);
  if (!order) throw operationNotFound("Venda");
  if (!["RESERVED", "PARTIALLY_INVOICED"].includes(order.status)) throw inventoryConflict("Venda deve estar reservada para faturamento.");
  const providerConfigured = process.env.FISCAL_PROVIDER_CONFIGURED === "true";
  const allocation = await tx.salesInvoiceAllocation.create({ data: { companyId, salesOrderId: id, documentType: input.documentType, status: providerConfigured ? "PREPARED" : "CONFIGURATION_REQUIRED", providerRequired: !providerConfigured, quantities: input.items, totalAmount: 0, idempotencyKey: input.idempotencyKey } });
  if (!providerConfigured) return { ...allocation, configurationRequired: true, message: "Configuração fiscal necessária" };
  let invoiceTotal = D(0);
  for (const invoiced of input.items) {
    const item = order.items.find((candidate) => candidate.id === invoiced.salesOrderItemId);
    if (!item) throw operationNotFound("Item da venda");
    const remaining = D(item.quantity).minus(item.invoicedQuantity);
    if (D(invoiced.quantity).gt(remaining) || D(invoiced.quantity).gt(item.reservedQuantity)) throw inventoryConflict("Quantidade faturada excede pedido ou reserva.");
    const reservation = await tx.inventoryReservation.findFirst({ where: { companyId, sourceType: "SALES_ORDER", sourceId: order.id, productId: item.productId, status: "ACTIVE" } });
    if (!reservation) throw inventoryConflict("Reserva ativa não encontrada.");
    const balance = await tx.inventoryBalance.findUnique({ where: { warehouseId_productId: { warehouseId: order.warehouseId, productId: item.productId } } });
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { reservedQuantity: { decrement: invoiced.quantity } } });
    const reservationRemaining = D(reservation.quantity).minus(invoiced.quantity);
    await tx.inventoryReservation.update({ where: { id: reservation.id }, data: reservationRemaining.eq(0) ? { quantity: reservation.quantity, status: "CONFIRMED", confirmedAt: new Date() } : { quantity: reservationRemaining } });
    await applyMovement(tx, { companyId, userId, warehouseId: order.warehouseId, productId: item.productId, quantity: D(invoiced.quantity).neg(), unitCost: balance.averageCost, type: "SALE_SHIPMENT", sourceType: "SALES_INVOICE", sourceId: allocation.id, idempotencyKey: `sales-invoice:${allocation.id}:${item.id}`, reason: `Faturamento da venda ${order.number}` });
    await tx.salesOrderItem.update({ where: { id: item.id }, data: { invoicedQuantity: { increment: invoiced.quantity }, reservedQuantity: { decrement: invoiced.quantity } } });
    invoiceTotal = invoiceTotal.plus(D(invoiced.quantity).mul(item.unitPrice));
  }
  const refreshed = await scopedSale(tx, companyId, id);
  const complete = refreshed.items.every((item) => D(item.invoicedQuantity).gte(item.quantity));
  await tx.salesInvoiceAllocation.update({ where: { id: allocation.id }, data: { totalAmount: invoiceTotal, status: "PREPARED" } });
  await tx.receivable.upsert({ where: { companyId_externalKey_installmentNumber: { companyId, externalKey: `sales-invoice:${allocation.id}`, installmentNumber: "1" } }, create: { companyId, clientId: order.clientId, clientName: order.client.razaoSocial || order.client.nome || order.client.nomeFantasia, description: `Venda ${order.number}`, dueDate: input.dueDate || order.issueDate, amount: invoiceTotal, issueDate: order.issueDate, installmentNumber: "1", externalKey: `sales-invoice:${allocation.id}`, source: "SALES_ORDER" }, update: {} });
  await tx.salesOrder.update({ where: { id }, data: { status: complete ? "INVOICED" : "PARTIALLY_INVOICED" } });
  return tx.salesInvoiceAllocation.findUnique({ where: { id: allocation.id } });
});
export const cancelSale = (companyId, id, reason) => prisma.$transaction(async (tx) => {
  const order = await scopedSale(tx, companyId, id);
  if (!order) throw operationNotFound("Venda");
  if (order.items.some((item) => D(item.invoicedQuantity).gt(0))) throw inventoryConflict("Venda faturada exige tratamento fiscal antes do cancelamento.", "FISCAL_TREATMENT_REQUIRED");
  const reservations = await tx.inventoryReservation.findMany({ where: { companyId, sourceType: "SALES_ORDER", sourceId: id, status: "ACTIVE" } });
  for (const reservation of reservations) {
    const balance = await tx.inventoryBalance.findUnique({ where: { warehouseId_productId: { warehouseId: reservation.warehouseId, productId: reservation.productId } } });
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { reservedQuantity: { decrement: reservation.quantity } } });
    await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "CANCELED", releasedAt: new Date() } });
  }
  const allocationKeys = order.invoices.map((invoice) => `sales-invoice:${invoice.id}`);
  if (allocationKeys.length) await tx.receivable.updateMany({ where: { companyId, externalKey: { in: allocationKeys }, status: "PENDING" }, data: { status: "CANCELED" } });
  return tx.salesOrder.update({ where: { id }, data: { status: "CANCELED", cancellationReason: reason } });
});
export const returnSale = (companyId, userId, id, input) => prisma.$transaction(async (tx) => {
  const duplicate = await tx.salesReturn.findUnique({ where: { companyId_idempotencyKey: { companyId, idempotencyKey: input.idempotencyKey } }, include: { items: true } });
  if (duplicate) return duplicate;
  const order = await scopedSale(tx, companyId, id);
  if (!order) throw operationNotFound("Venda");
  const salesReturn = await tx.salesReturn.create({ data: { companyId, salesOrderId: id, reason: input.reason, idempotencyKey: input.idempotencyKey, userId } });
  let credit = D(0);
  for (const returned of input.items) {
    const item = order.items.find((candidate) => candidate.id === returned.salesOrderItemId);
    if (!item) throw operationNotFound("Item da venda");
    if (D(item.returnedQuantity).plus(returned.quantity).gt(item.invoicedQuantity)) throw inventoryConflict("Devolução excede a quantidade faturada.");
    const movement = await applyMovement(tx, { companyId, userId, warehouseId: order.warehouseId, productId: item.productId, quantity: returned.quantity, unitCost: item.unitPrice, type: "RETURN_IN", sourceType: "SALES_RETURN", sourceId: salesReturn.id, idempotencyKey: `sales-return:${salesReturn.id}:${item.id}`, reason: input.reason });
    await tx.salesReturnItem.create({ data: { companyId, salesReturnId: salesReturn.id, salesOrderItemId: item.id, productId: item.productId, quantity: returned.quantity, inventoryMovementId: movement.id } });
    await tx.salesOrderItem.update({ where: { id: item.id }, data: { returnedQuantity: { increment: returned.quantity } } });
    credit = credit.plus(D(returned.quantity).mul(item.unitPrice));
  }
  if (input.adjustFinancial) {
    const receivables = await tx.receivable.findMany({ where: { companyId, description: `Venda ${order.number}`, status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" } });
    let remainder = credit;
    for (const receivable of receivables) {
      const reducible = Prisma.Decimal.min(remainder, D(receivable.amount).minus(receivable.receivedAmount));
      if (reducible.gt(0)) await tx.receivable.update({ where: { id: receivable.id }, data: { amount: D(receivable.amount).minus(reducible), notes: `${receivable.notes || ""}\nCrédito por devolução ${salesReturn.id}`.trim() } });
      remainder = remainder.minus(reducible);
    }
  }
  await tx.salesOrder.update({ where: { id }, data: { status: "RETURNED" } });
  return tx.salesReturn.findUnique({ where: { id: salesReturn.id }, include: { items: true } });
});
