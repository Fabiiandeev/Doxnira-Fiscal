import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { inventoryConflict, inventoryValidation, operationNotFound } from "./operation-errors.js";
import { scopedCount, scopedReservation, scopedTransfer } from "./operation.repository.js";

const D = (value) => new Prisma.Decimal(value ?? 0);
const movementTypes = new Set(["INITIAL_BALANCE","PURCHASE_RECEIPT","SALE_RESERVATION","SALE_RELEASE","SALE_SHIPMENT","FISCAL_ENTRY","FISCAL_EXIT","MANUAL_ADJUSTMENT","TRANSFER_OUT","TRANSFER_IN","INVENTORY_ADJUSTMENT","RETURN_IN","RETURN_OUT","MARKETPLACE_RESERVATION"]);
export const calculateAverageCost = (physical, average, entryQuantity, entryUnitCost) => {
  const current = D(physical), incoming = D(entryQuantity);
  if (incoming.lte(0)) return D(average);
  return current.mul(D(average)).plus(incoming.mul(D(entryUnitCost))).div(current.plus(incoming));
};
export const availableQuantity = (balance) => D(balance?.physicalQuantity).minus(D(balance?.reservedQuantity));
export const requireReason = (reason) => {
  if (!reason?.trim()) throw inventoryValidation("Justificativa obrigatória.");
  return reason.trim();
};

const assertResources = async (tx, companyId, warehouseId, productId) => {
  const [warehouse, product] = await Promise.all([
    tx.warehouse.findFirst({ where: { id: warehouseId, companyId, status: "ACTIVE" } }),
    tx.product.findFirst({ where: { id: productId, companyId, active: true } }),
  ]);
  if (!warehouse || !product) throw operationNotFound("Depósito ou produto");
};
const balance = (tx, companyId, warehouseId, productId) =>
  tx.inventoryBalance.upsert({
    where: { warehouseId_productId: { warehouseId, productId } },
    create: { companyId, warehouseId, productId },
    update: {},
  });

export const applyMovement = async (tx, input) => {
  if (!movementTypes.has(input.type)) throw inventoryValidation("Tipo de movimento inválido.");
  const duplicate = await tx.inventoryMovement.findUnique({
    where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
  });
  if (duplicate) return duplicate;
  await assertResources(tx, input.companyId, input.warehouseId, input.productId);
  const current = await balance(tx, input.companyId, input.warehouseId, input.productId);
  const delta = D(input.quantity);
  const result = D(current.physicalQuantity).plus(delta);
  if (result.lt(0) || result.lt(current.reservedQuantity)) throw inventoryConflict("Saldo disponível insuficiente.", "INSUFFICIENT_STOCK");
  const averageCost = delta.gt(0)
    ? calculateAverageCost(current.physicalQuantity, current.averageCost, delta, input.unitCost)
    : D(current.averageCost);
  await tx.inventoryBalance.update({
    where: { id: current.id },
    data: { physicalQuantity: result, averageCost: result.eq(0) ? D(0) : averageCost },
  });
  return tx.inventoryMovement.create({
    data: {
      companyId: input.companyId, warehouseId: input.warehouseId, productId: input.productId,
      type: input.type, quantity: delta, unitCost: D(input.unitCost), totalCost: delta.abs().mul(D(input.unitCost)),
      previousQuantity: current.physicalQuantity, resultingQuantity: result, sourceType: input.sourceType,
      sourceId: input.sourceId, externalKey: input.externalKey, idempotencyKey: input.idempotencyKey,
      reason: input.reason, userId: input.userId,
    },
  });
};

export const adjustInventory = (companyId, userId, input) =>
  prisma.$transaction((tx) => applyMovement(tx, { ...input, companyId, userId, type: "MANUAL_ADJUSTMENT", reason: requireReason(input.reason) }));

export const createReservation = (companyId, input) => prisma.$transaction(async (tx) => {
  const duplicate = await tx.inventoryReservation.findUnique({ where: { companyId_externalKey: { companyId, externalKey: input.externalKey } } });
  if (duplicate) return duplicate;
  await assertResources(tx, companyId, input.warehouseId, input.productId);
  const current = await balance(tx, companyId, input.warehouseId, input.productId);
  if (availableQuantity(current).lt(input.quantity)) throw inventoryConflict("Saldo disponível insuficiente.", "INSUFFICIENT_STOCK");
  await tx.inventoryBalance.update({ where: { id: current.id }, data: { reservedQuantity: { increment: input.quantity } } });
  return tx.inventoryReservation.create({ data: { companyId, ...input } });
});

export const transitionReservation = (companyId, userId, id, action) => prisma.$transaction(async (tx) => {
  const reservation = await scopedReservation(tx, companyId, id);
  if (!reservation) throw operationNotFound("Reserva");
  if (reservation.status !== "ACTIVE") throw inventoryConflict("Reserva já finalizada.");
  const current = await balance(tx, companyId, reservation.warehouseId, reservation.productId);
  await tx.inventoryBalance.update({ where: { id: current.id }, data: { reservedQuantity: { decrement: reservation.quantity } } });
  const now = new Date();
  if (action === "confirm") {
    await applyMovement(tx, { companyId, userId, warehouseId: reservation.warehouseId, productId: reservation.productId, quantity: D(reservation.quantity).neg(), unitCost: current.averageCost, type: "SALE_SHIPMENT", sourceType: reservation.sourceType, sourceId: reservation.id, externalKey: reservation.externalKey, idempotencyKey: `reservation:${reservation.id}:confirm`, reason: "Confirmação de reserva" });
  }
  return tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: action === "confirm" ? { status: "CONFIRMED", confirmedAt: now } : { status: action === "release" ? "RELEASED" : action === "expire" ? "EXPIRED" : "CANCELED", releasedAt: now },
  });
});
export const expireReservations = async (companyId) => {
  const expired = await prisma.inventoryReservation.findMany({ where: { companyId, status: "ACTIVE", expiresAt: { lte: new Date() } }, select: { id: true } });
  for (const item of expired) await transitionReservation(companyId, null, item.id, "expire");
  return expired.length;
};

export const createTransfer = (companyId, userId, input) => prisma.$transaction(async (tx) => {
  const warehouses = await tx.warehouse.count({ where: { id: { in: [input.sourceWarehouseId, input.destinationWarehouseId] }, companyId, status: "ACTIVE" } });
  if (warehouses !== 2) throw operationNotFound("Depósito");
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  if (productIds.length !== input.items.length) throw inventoryValidation("Produtos duplicados na transferência.");
  const products = await tx.product.count({ where: { id: { in: productIds }, companyId } });
  if (products !== productIds.length) throw operationNotFound("Produto");
  return tx.inventoryTransfer.create({ data: { companyId, sourceWarehouseId: input.sourceWarehouseId, destinationWarehouseId: input.destinationWarehouseId, reason: input.reason, requestedById: userId, items: { create: input.items.map((item) => ({ companyId, ...item })) } }, include: { items: true } });
});

export const completeTransfer = (companyId, userId, id) => prisma.$transaction(async (tx) => {
  const transfer = await scopedTransfer(tx, companyId, id);
  if (!transfer) throw operationNotFound("Transferência");
  if (!["DRAFT", "PENDING"].includes(transfer.status)) throw inventoryConflict("Transferência já finalizada.");
  for (const item of transfer.items) {
    const source = await balance(tx, companyId, transfer.sourceWarehouseId, item.productId);
    if (availableQuantity(source).lt(item.quantity)) throw inventoryConflict("Saldo insuficiente para concluir a transferência.", "INSUFFICIENT_STOCK");
    const cost = D(item.unitCost).gt(0) ? item.unitCost : source.averageCost;
    await applyMovement(tx, { companyId, userId, warehouseId: transfer.sourceWarehouseId, productId: item.productId, quantity: D(item.quantity).neg(), unitCost: cost, type: "TRANSFER_OUT", sourceType: "INVENTORY_TRANSFER", sourceId: transfer.id, idempotencyKey: `transfer:${transfer.id}:${item.id}:out`, reason: transfer.reason });
    await applyMovement(tx, { companyId, userId, warehouseId: transfer.destinationWarehouseId, productId: item.productId, quantity: item.quantity, unitCost: cost, type: "TRANSFER_IN", sourceType: "INVENTORY_TRANSFER", sourceId: transfer.id, idempotencyKey: `transfer:${transfer.id}:${item.id}:in`, reason: transfer.reason });
  }
  return tx.inventoryTransfer.update({ where: { id }, data: { status: "COMPLETED", completedById: userId, completedAt: new Date() }, include: { items: true } });
});

export const createCount = (companyId, userId, input) => prisma.$transaction(async (tx) => {
  const warehouse = await tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId, status: "ACTIVE" } });
  if (!warehouse) throw operationNotFound("Depósito");
  const balances = await tx.inventoryBalance.findMany({ where: { companyId, warehouseId: input.warehouseId, ...(input.productIds?.length ? { productId: { in: input.productIds } } : {}) } });
  return tx.inventoryCount.create({ data: { companyId, warehouseId: input.warehouseId, responsibleId: userId, notes: input.notes, status: "COUNTING", startedAt: new Date(), items: { create: balances.map((row) => ({ companyId, productId: row.productId, expectedQuantity: row.physicalQuantity })) } }, include: { items: true } });
});
export const updateCountItems = async (companyId, id, items) => prisma.$transaction(async (tx) => {
  const count = await scopedCount(tx, companyId, id);
  if (!count) throw operationNotFound("Inventário");
  if (!["DRAFT", "COUNTING"].includes(count.status)) throw inventoryConflict("Inventário já finalizado.");
  for (const item of items) {
    const existing = count.items.find((row) => row.productId === item.productId);
    if (!existing) throw operationNotFound("Item do inventário");
    await tx.inventoryCountItem.update({ where: { id: existing.id }, data: { countedQuantity: item.countedQuantity, differenceQuantity: D(item.countedQuantity).minus(existing.expectedQuantity) } });
  }
  return scopedCount(tx, companyId, id);
});
export const completeCount = (companyId, userId, id) => prisma.$transaction(async (tx) => {
  const count = await scopedCount(tx, companyId, id);
  if (!count) throw operationNotFound("Inventário");
  if (!["DRAFT", "COUNTING"].includes(count.status)) throw inventoryConflict("Inventário já finalizado.");
  if (count.items.some((item) => item.countedQuantity === null)) throw inventoryValidation("Informe a contagem de todos os itens.");
  for (const item of count.items) {
    const delta = D(item.countedQuantity).minus(item.expectedQuantity);
    if (!delta.eq(0)) {
      const movement = await applyMovement(tx, { companyId, userId, warehouseId: count.warehouseId, productId: item.productId, quantity: delta, unitCost: 0, type: "INVENTORY_ADJUSTMENT", sourceType: "INVENTORY_COUNT", sourceId: count.id, idempotencyKey: `count:${count.id}:${item.id}`, reason: count.notes || "Ajuste por inventário" });
      await tx.inventoryCountItem.update({ where: { id: item.id }, data: { differenceQuantity: delta, adjustmentMovementId: movement.id } });
    }
  }
  return tx.inventoryCount.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() }, include: { items: true } });
});
