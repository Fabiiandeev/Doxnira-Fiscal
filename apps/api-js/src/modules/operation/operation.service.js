import { prisma } from "../../config/prisma.js";
import { operationNotFound } from "./operation-errors.js";
import { createSale } from "./sales.service.js";

export const operationTimeline = (companyId, entityType, entityId) =>
  prisma.auditLog.findMany({ where: { companyId, entityType, entityId }, orderBy: { createdAt: "asc" } });

export const importMarketplaceOrder = async (companyId, userId, marketplaceOrderId, mapping) => {
  const marketplaceOrder = await prisma.marketplaceOrder.findFirst({ where: { id: marketplaceOrderId, companyId }, include: { items: true } });
  if (!marketplaceOrder) throw operationNotFound("Pedido Marketplace");
  const externalKey = `marketplace:${marketplaceOrder.connectionId}:${marketplaceOrder.providerOrderId}`;
  const existing = await prisma.salesOrder.findUnique({ where: { companyId_externalKey: { companyId, externalKey } } });
  if (existing) return existing;
  return createSale(companyId, userId, {
    number: marketplaceOrder.providerOrderId, origin: "MARKETPLACE", externalKey, marketplaceOrderId,
    clientId: mapping.clientId, warehouseId: mapping.warehouseId, issueDate: marketplaceOrder.orderedAt,
    paymentCondition: "MARKETPLACE", freightAmount: Number(marketplaceOrder.freightAmount || 0),
    discountAmount: Number(marketplaceOrder.discountAmount || 0), taxAmount: Number(marketplaceOrder.taxAmount || 0),
    totalAmount: Number(marketplaceOrder.totalAmount), notes: `Importado do marketplace ${marketplaceOrder.provider}`,
    items: marketplaceOrder.items.map((item) => {
      const productId = mapping.products?.[item.id];
      if (!productId) throw operationNotFound("Vínculo de produto Marketplace");
      return { productId, quantity: Number(item.quantity), unitValue: Number(item.unitPrice), discountAmount: 0, taxAmount: 0 };
    }),
  });
};

export const getOperationDashboard = async (companyId, filters) => {
  const now = new Date(), from = filters.from || new Date(now.getFullYear(), now.getMonth(), 1), to = filters.to ? new Date(filters.to) : now;
  if (filters.to && to.getHours() === 0 && to.getMinutes() === 0) to.setHours(23, 59, 59, 999);
  const movementWhere = { companyId, createdAt: { gte: from, lte: to }, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}), ...(filters.productId ? { productId: filters.productId } : {}) };
  const balanceWhere = { companyId, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}), ...(filters.productId ? { productId: filters.productId } : {}) };
  const purchaseWhere = { companyId, issueDate: { gte: from, lte: to }, ...(filters.supplierId ? { supplierId: filters.supplierId } : {}), ...(filters.status ? { status: filters.status } : {}) };
  const saleWhere = { companyId, issueDate: { gte: from, lte: to }, ...(filters.clientId ? { clientId: filters.clientId } : {}), ...(filters.origin ? { origin: filters.origin } : {}), ...(filters.status ? { status: filters.status } : {}) };
  const [balances, movements, purchases, sales, reservations, marketplacePending, payables, receivables, activeAutomations, failedRuns, alerts, certificates] = await Promise.all([
    prisma.inventoryBalance.findMany({ where: balanceWhere, include: { product: true, warehouse: true } }),
    prisma.inventoryMovement.findMany({ where: movementWhere, include: { product: true, warehouse: true }, orderBy: { createdAt: "desc" } }),
    prisma.purchaseOrder.findMany({ where: purchaseWhere, include: { supplier: true, warehouse: true }, orderBy: { createdAt: "desc" } }),
    prisma.salesOrder.findMany({ where: saleWhere, include: { client: true, warehouse: true }, orderBy: { createdAt: "desc" } }),
    prisma.inventoryReservation.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.marketplaceWebhookEvent.count({ where: { companyId, status: { in: ["received","failed"] } } }),
    prisma.payable.count({ where: { companyId, source: "PURCHASE_ORDER", status: { not: "CANCELED" } } }),
    prisma.receivable.count({ where: { companyId, source: "SALES_ORDER", status: { not: "CANCELED" } } }),
    prisma.operationAutomation.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.operationAutomationRun.findMany({ where: { companyId, status: "FAILED" }, include: { automation: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.alert.count({ where: { companyId, status: "open" } }),
    prisma.digitalCertificate.count({ where: { companyId, validUntil: { lte: new Date(now.getTime() + 30 * 86400000), gte: now } } }),
  ]);
  const countStatus = (rows, statuses) => rows.filter((row) => statuses.includes(row.status)).length;
  const groups = (rows) => Object.entries(rows.reduce((result, row) => ({ ...result, [row.status]: (result[row.status] || 0) + 1 }), {})).map(([status, count]) => ({ status, count }));
  const movementSeries = Object.values(movements.reduce((result, row) => {
    const date = row.createdAt.toISOString().slice(0, 10), entry = Number(row.quantity) > 0;
    result[date] ||= { date, entries: 0, exits: 0 };
    result[date][entry ? "entries" : "exits"] += Math.abs(Number(row.quantity));
    return result;
  }, {})).sort((a, b) => a.date.localeCompare(b.date));
  const value = balances.reduce((sum, row) => sum + Number(row.physicalQuantity) * Number(row.averageCost), 0);
  return {
    period: { from, to }, indicators: {
      inventoryValue: value, productsWithStock: balances.filter((row) => Number(row.physicalQuantity) > 0).length,
      productsOutOfStock: balances.filter((row) => Number(row.physicalQuantity) <= 0).length,
      productsBelowMinimum: balances.filter((row) => Number(row.physicalQuantity) - Number(row.reservedQuantity) < Number(row.minimumQuantity)).length,
      activeReservations: reservations, movements: movements.length,
      purchaseDrafts: countStatus(purchases, ["DRAFT"]), purchasePendingApproval: countStatus(purchases, ["PENDING_APPROVAL"]),
      purchasePendingReceipt: countStatus(purchases, ["APPROVED","PARTIALLY_RECEIVED"]),
      saleDrafts: countStatus(sales, ["DRAFT"]), salePendingApproval: countStatus(sales, ["PENDING_APPROVAL"]),
      saleReserved: countStatus(sales, ["RESERVED"]), salePendingInvoice: countStatus(sales, ["APPROVED","RESERVED","PARTIALLY_INVOICED"]),
      marketplacePending, purchasePayables: payables, salesReceivables: receivables, activeAutomations,
      failedRuns: failedRuns.length, operationalAlerts: alerts + certificates,
    },
    movementSeries, purchasesByStatus: groups(purchases), salesByStatus: groups(sales),
    criticalProducts: balances.filter((row) => Number(row.physicalQuantity) - Number(row.reservedQuantity) <= Number(row.minimumQuantity)).slice(0, 10),
    latestMovements: movements.slice(0, 10), recentPurchases: purchases.slice(0, 10), recentSales: sales.slice(0, 10), failedAutomations: failedRuns,
  };
};
