import { prisma } from "../../config/prisma.js";

export const pageResult = async (model, where, query, include = undefined, orderBy = { createdAt: "desc" }) => {
  const [data, total] = await prisma.$transaction([
    prisma[model].findMany({ where, include, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma[model].count({ where }),
  ]);
  return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
};

export const scopedWarehouse = (companyId, id) =>
  prisma.warehouse.findFirst({ where: { id, companyId }, include: { _count: { select: { balances: true, movements: true } } } });
export const scopedReservation = (tx, companyId, id) =>
  tx.inventoryReservation.findFirst({ where: { id, companyId } });
export const scopedTransfer = (client, companyId, id) =>
  client.inventoryTransfer.findFirst({ where: { id, companyId }, include: { items: { include: { product: true } }, sourceWarehouse: true, destinationWarehouse: true } });
export const scopedCount = (client, companyId, id) =>
  client.inventoryCount.findFirst({ where: { id, companyId }, include: { warehouse: true, responsible: { select: { id: true, name: true } }, items: { include: { product: true, adjustmentMovement: true } } } });
export const scopedPurchase = (client, companyId, id) =>
  client.purchaseOrder.findFirst({ where: { id, companyId }, include: { supplier: true, buyer: { select: { id: true, name: true } }, warehouse: true, items: { include: { product: true } }, receipts: { include: { items: true, user: { select: { id: true, name: true } } } } } });
export const scopedSale = (client, companyId, id) =>
  client.salesOrder.findFirst({ where: { id, companyId }, include: { client: true, seller: { select: { id: true, name: true } }, warehouse: true, items: { include: { product: true } }, invoices: true, returns: { include: { items: true } } } });
export const scopedAutomation = (client, companyId, id) =>
  client.operationAutomation.findFirst({ where: { id, companyId }, include: { responsible: { select: { id: true, name: true } }, runs: { orderBy: { createdAt: "desc" }, take: 20 } } });
export const scopedAutomationRun = (client, companyId, id) =>
  client.operationAutomationRun.findFirst({ where: { id, companyId }, include: { automation: true, user: { select: { id: true, name: true } } } });
