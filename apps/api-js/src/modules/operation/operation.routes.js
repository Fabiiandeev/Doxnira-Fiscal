import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { inventoryConflict, operationNotFound, viewerForbidden } from "./operation-errors.js";
import { adjustmentSchema, automationRunSchema, automationSchema, countItemsSchema, countSchema, dashboardSchema, invoiceSchema, listSchema, marketplaceImportSchema, purchaseSchema, reasonSchema, receiptSchema, reservationSchema, returnSchema, salesSchema, transferSchema, warehouseSchema } from "./operation.schemas.js";
import { pageResult, scopedAutomation, scopedAutomationRun, scopedCount, scopedPurchase, scopedSale, scopedTransfer, scopedWarehouse } from "./operation.repository.js";
import { adjustInventory, completeCount, completeTransfer, createCount, createReservation, createTransfer, expireReservations, transitionReservation, updateCountItems } from "./inventory.service.js";
import { createPurchase, receivePurchase, transitionPurchase, updatePurchase } from "./purchase.service.js";
import { cancelSale, createSale, invoiceSale, releaseSale, reserveSale, returnSale, transitionSale, updateSale } from "./sales.service.js";
import { getOperationDashboard, importMarketplaceOrder, operationTimeline } from "./operation.service.js";
import { createAutomation, duplicateAutomation, retryAutomationRun, updateAutomation } from "./automation.service.js";
import { cancelAutomationRun, evaluateAutomation, runAutomation } from "./automation-runner.js";
import { dispatchOperationEvent } from "./automation-event-dispatcher.js";

export const operationRouter = Router({ mergeParams: true });
const writable = (request) => { if (request.user.role === "VIEWER") throw viewerForbidden(); };
const audit = (request, action, type, entityId, metadata = {}) =>
  writeAudit({ request, action: `operation.inventory.${action}`, companyId: request.company.id, entityType: type, entityId, metadata });
const whereFrom = (companyId, query) => ({
  companyId,
  ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
  ...(query.productId ? { productId: query.productId } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.type ? { type: query.type } : {}),
  ...(query.sourceType ? { sourceType: query.sourceType } : {}),
});

operationRouter.get("/inventory/summary", asyncHandler(async (request, response) => {
  const companyId = request.company.id;
  const [balances, products, warehouses, lastMovement] = await Promise.all([
    prisma.inventoryBalance.findMany({ where: { companyId }, include: { product: true, warehouse: true } }),
    prisma.product.count({ where: { companyId, active: true } }),
    prisma.warehouse.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.inventoryMovement.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, include: { product: true, warehouse: true } }),
  ]);
  const number = (value) => Number(value || 0);
  sendSuccess(response, {
    products, warehouses, physicalQuantity: balances.reduce((sum, row) => sum + number(row.physicalQuantity), 0),
    reservedQuantity: balances.reduce((sum, row) => sum + number(row.reservedQuantity), 0),
    availableQuantity: balances.reduce((sum, row) => sum + number(row.physicalQuantity) - number(row.reservedQuantity), 0),
    inventoryValue: balances.reduce((sum, row) => sum + number(row.physicalQuantity) * number(row.averageCost), 0),
    belowMinimum: balances.filter((row) => number(row.physicalQuantity) - number(row.reservedQuantity) < number(row.minimumQuantity)).length,
    outOfStock: balances.filter((row) => number(row.physicalQuantity) - number(row.reservedQuantity) <= 0).length,
    lastMovement,
  });
}));

operationRouter.get("/inventory/warehouses", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  sendSuccess(response, await pageResult("warehouse", { companyId: request.company.id, ...(query.status ? { status: query.status } : {}), ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }] } : {}) }, query, { _count: { select: { balances: true, movements: true, reservations: true } } }, { name: "asc" }));
}));
operationRouter.post("/inventory/warehouses", asyncHandler(async (request, response) => {
  writable(request); const input = warehouseSchema.parse(request.body);
  const value = await prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.warehouse.updateMany({ where: { companyId: request.company.id, isDefault: true }, data: { isDefault: false } });
    return tx.warehouse.create({ data: { ...input, companyId: request.company.id } });
  });
  await audit(request, "warehouse.created", "Warehouse", value.id, { code: value.code });
  sendSuccess(response, value, 201);
}));
operationRouter.get("/inventory/warehouses/:warehouseId", asyncHandler(async (request, response) => {
  const value = await scopedWarehouse(request.company.id, request.params.warehouseId);
  if (!value) throw operationNotFound("Depósito");
  sendSuccess(response, value);
}));
operationRouter.patch("/inventory/warehouses/:warehouseId", asyncHandler(async (request, response) => {
  writable(request); const current = await scopedWarehouse(request.company.id, request.params.warehouseId);
  if (!current) throw operationNotFound("Depósito");
  const input = warehouseSchema.partial().parse(request.body);
  const value = await prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.warehouse.updateMany({ where: { companyId: request.company.id, id: { not: current.id } }, data: { isDefault: false } });
    return tx.warehouse.update({ where: { id: current.id }, data: input });
  });
  await audit(request, "warehouse.updated", "Warehouse", value.id, { before: current, after: value });
  sendSuccess(response, value);
}));
operationRouter.post("/inventory/warehouses/:warehouseId/deactivate", asyncHandler(async (request, response) => {
  writable(request); const current = await scopedWarehouse(request.company.id, request.params.warehouseId);
  if (!current) throw operationNotFound("Depósito");
  const value = await prisma.warehouse.update({ where: { id: current.id }, data: { status: "INACTIVE", isDefault: false } });
  await audit(request, "warehouse.deactivated", "Warehouse", value.id);
  sendSuccess(response, value);
}));

operationRouter.get("/inventory/balances", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  const where = { ...whereFrom(request.company.id, query), ...(query.status === "OUT" ? { physicalQuantity: { lte: 0 } } : query.status === "LOW" ? { minimumQuantity: { gt: 0 } } : {}) };
  delete where.status;
  if (query.q) where.product = { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }] };
  sendSuccess(response, await pageResult("inventoryBalance", where, query, { product: true, warehouse: true }, { updatedAt: "desc" }));
}));
operationRouter.get("/inventory/movements", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  const where = whereFrom(request.company.id, query); delete where.status;
  if (query.q) where.OR = [{ reason: { contains: query.q, mode: "insensitive" } }, { externalKey: { contains: query.q, mode: "insensitive" } }];
  sendSuccess(response, await pageResult("inventoryMovement", where, query, { product: true, warehouse: true, user: { select: { id: true, name: true } } }));
}));
operationRouter.post("/inventory/adjustments", asyncHandler(async (request, response) => {
  writable(request); const input = adjustmentSchema.parse(request.body);
  const value = await adjustInventory(request.company.id, request.user.id, input);
  await audit(request, "adjustment.created", "InventoryMovement", value.id, { reason: input.reason, quantity: input.quantity });
  sendSuccess(response, value, 201);
}));

operationRouter.get("/inventory/reservations", asyncHandler(async (request, response) => {
  await expireReservations(request.company.id);
  const query = listSchema.parse(request.query);
  sendSuccess(response, await pageResult("inventoryReservation", whereFrom(request.company.id, query), query, { product: true, warehouse: true }));
}));
operationRouter.post("/inventory/reservations", asyncHandler(async (request, response) => {
  writable(request); const value = await createReservation(request.company.id, reservationSchema.parse(request.body));
  await audit(request, "reservation.created", "InventoryReservation", value.id);
  sendSuccess(response, value, 201);
}));
for (const action of ["confirm", "release", "cancel"]) operationRouter.post(`/inventory/reservations/:reservationId/${action}`, asyncHandler(async (request, response) => {
  writable(request); const value = await transitionReservation(request.company.id, request.user.id, request.params.reservationId, action);
  await audit(request, `reservation.${action}`, "InventoryReservation", value.id);
  sendSuccess(response, value);
}));

operationRouter.get("/inventory/transfers", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  sendSuccess(response, await pageResult("inventoryTransfer", whereFrom(request.company.id, query), query, { sourceWarehouse: true, destinationWarehouse: true, items: { include: { product: true } } }));
}));
operationRouter.post("/inventory/transfers", asyncHandler(async (request, response) => {
  writable(request); const value = await createTransfer(request.company.id, request.user.id, transferSchema.parse(request.body));
  await audit(request, "transfer.created", "InventoryTransfer", value.id);
  sendSuccess(response, value, 201);
}));
operationRouter.get("/inventory/transfers/:transferId", asyncHandler(async (request, response) => {
  const value = await scopedTransfer(prisma, request.company.id, request.params.transferId);
  if (!value) throw operationNotFound("Transferência");
  sendSuccess(response, value);
}));
operationRouter.post("/inventory/transfers/:transferId/complete", asyncHandler(async (request, response) => {
  writable(request); const value = await completeTransfer(request.company.id, request.user.id, request.params.transferId);
  await audit(request, "transfer.completed", "InventoryTransfer", value.id);
  sendSuccess(response, value);
}));
operationRouter.post("/inventory/transfers/:transferId/cancel", asyncHandler(async (request, response) => {
  writable(request); const current = await scopedTransfer(prisma, request.company.id, request.params.transferId);
  if (!current) throw operationNotFound("Transferência");
  if (!["DRAFT", "PENDING"].includes(current.status)) throw inventoryConflict("Transferência já finalizada.");
  const value = await prisma.inventoryTransfer.update({ where: { id: current.id }, data: { status: "CANCELED" } });
  await audit(request, "transfer.canceled", "InventoryTransfer", value.id);
  sendSuccess(response, value);
}));

operationRouter.get("/inventory/counts", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  sendSuccess(response, await pageResult("inventoryCount", whereFrom(request.company.id, query), query, { warehouse: true, responsible: { select: { id: true, name: true } }, items: { include: { product: true, adjustmentMovement: true } } }));
}));
operationRouter.post("/inventory/counts", asyncHandler(async (request, response) => {
  writable(request); const value = await createCount(request.company.id, request.user.id, countSchema.parse(request.body));
  await audit(request, "count.created", "InventoryCount", value.id);
  sendSuccess(response, value, 201);
}));
operationRouter.get("/inventory/counts/:countId", asyncHandler(async (request, response) => {
  const value = await scopedCount(prisma, request.company.id, request.params.countId);
  if (!value) throw operationNotFound("Inventário");
  sendSuccess(response, value);
}));
operationRouter.patch("/inventory/counts/:countId/items", asyncHandler(async (request, response) => {
  writable(request); const value = await updateCountItems(request.company.id, request.params.countId, countItemsSchema.parse(request.body).items);
  await audit(request, "count.items.updated", "InventoryCount", value.id);
  sendSuccess(response, value);
}));
operationRouter.post("/inventory/counts/:countId/complete", asyncHandler(async (request, response) => {
  writable(request); const value = await completeCount(request.company.id, request.user.id, request.params.countId);
  await audit(request, "count.completed", "InventoryCount", value.id);
  sendSuccess(response, value);
}));
operationRouter.post("/inventory/counts/:countId/cancel", asyncHandler(async (request, response) => {
  writable(request); const current = await scopedCount(prisma, request.company.id, request.params.countId);
  if (!current) throw operationNotFound("Inventário");
  if (!["DRAFT", "COUNTING"].includes(current.status)) throw inventoryConflict("Inventário já finalizado.");
  const value = await prisma.inventoryCount.update({ where: { id: current.id }, data: { status: "CANCELED" } });
  await audit(request, "count.canceled", "InventoryCount", value.id);
  sendSuccess(response, value);
}));

operationRouter.get("/purchases", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  const where = { companyId: request.company.id, ...(query.status ? { status: query.status } : {}), ...(query.q ? { OR: [{ number: { contains: query.q, mode: "insensitive" } }, { supplier: { razaoSocial: { contains: query.q, mode: "insensitive" } } }] } : {}) };
  sendSuccess(response, await pageResult("purchaseOrder", where, query, { supplier: true, warehouse: true, buyer: { select: { id: true, name: true } }, _count: { select: { items: true, receipts: true } } }));
}));
operationRouter.post("/purchases", asyncHandler(async (request, response) => {
  writable(request); const value = await createPurchase(request.company.id, request.user.id, purchaseSchema.parse(request.body));
  await audit(request, "purchase.created", "PurchaseOrder", value.id);
  sendSuccess(response, value, 201);
}));
operationRouter.get("/purchases/:purchaseId", asyncHandler(async (request, response) => {
  const value = await scopedPurchase(prisma, request.company.id, request.params.purchaseId);
  if (!value) throw operationNotFound("Compra");
  sendSuccess(response, { ...value, timeline: await operationTimeline(request.company.id, "PurchaseOrder", value.id) });
}));
operationRouter.patch("/purchases/:purchaseId", asyncHandler(async (request, response) => {
  writable(request); const value = await updatePurchase(request.company.id, request.params.purchaseId, purchaseSchema.parse(request.body));
  await audit(request, "purchase.updated", "PurchaseOrder", value.id);
  sendSuccess(response, value);
}));
for (const action of ["submit", "approve"]) operationRouter.post(`/purchases/:purchaseId/${action}`, asyncHandler(async (request, response) => {
  writable(request); const value = await transitionPurchase(request.company.id, request.params.purchaseId, action);
  await audit(request, `purchase.${action}`, "PurchaseOrder", value.id);
  await dispatchOperationEvent({ companyId: request.company.id, event: action === "submit" ? "PURCHASE_SUBMITTED" : "PURCHASE_APPROVED", payload: value, correlationId: request.id, requestId: request.id, origin: "PURCHASE", userId: request.user.id });
  sendSuccess(response, value);
}));
for (const action of ["reject", "cancel"]) operationRouter.post(`/purchases/:purchaseId/${action}`, asyncHandler(async (request, response) => {
  writable(request); const { reason } = reasonSchema.parse(request.body);
  const value = await transitionPurchase(request.company.id, request.params.purchaseId, action, reason);
  await audit(request, `purchase.${action}`, "PurchaseOrder", value.id, { reason });
  sendSuccess(response, value);
}));
operationRouter.post("/purchases/:purchaseId/receive", asyncHandler(async (request, response) => {
  writable(request); const input = receiptSchema.parse(request.body);
  const value = await receivePurchase(request.company.id, request.user.id, request.params.purchaseId, input);
  await audit(request, "purchase.received", "PurchaseOrder", request.params.purchaseId, { receiptId: value.id, justification: input.justification });
  await dispatchOperationEvent({ companyId: request.company.id, event: "PURCHASE_RECEIVED", payload: value, correlationId: request.id, requestId: request.id, origin: "PURCHASE", userId: request.user.id });
  sendSuccess(response, value, 201);
}));

operationRouter.get("/sales", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  const where = { companyId: request.company.id, ...(query.status ? { status: query.status } : {}), ...(query.q ? { OR: [{ number: { contains: query.q, mode: "insensitive" } }, { externalKey: { contains: query.q, mode: "insensitive" } }] } : {}) };
  sendSuccess(response, await pageResult("salesOrder", where, query, { client: true, warehouse: true, seller: { select: { id: true, name: true } }, _count: { select: { items: true, invoices: true, returns: true } } }));
}));
operationRouter.post("/sales", asyncHandler(async (request, response) => {
  writable(request); const value = await createSale(request.company.id, request.user.id, salesSchema.parse(request.body));
  await audit(request, "sale.created", "SalesOrder", value.id);
  sendSuccess(response, value, 201);
}));
operationRouter.post("/sales/import-marketplace", asyncHandler(async (request, response) => {
  writable(request); const input = marketplaceImportSchema.parse(request.body);
  const value = await importMarketplaceOrder(request.company.id, request.user.id, input.marketplaceOrderId, input);
  await audit(request, "sale.marketplace.imported", "SalesOrder", value.id, { marketplaceOrderId: input.marketplaceOrderId });
  await dispatchOperationEvent({ companyId: request.company.id, event: "MARKETPLACE_ORDER_IMPORTED", payload: value, correlationId: request.id, requestId: request.id, origin: "MARKETPLACE", userId: request.user.id });
  sendSuccess(response, value, 201);
}));
operationRouter.get("/sales/:salesId", asyncHandler(async (request, response) => {
  const value = await scopedSale(prisma, request.company.id, request.params.salesId);
  if (!value) throw operationNotFound("Venda");
  sendSuccess(response, { ...value, timeline: await operationTimeline(request.company.id, "SalesOrder", value.id) });
}));
operationRouter.patch("/sales/:salesId", asyncHandler(async (request, response) => {
  writable(request); const value = await updateSale(request.company.id, request.params.salesId, salesSchema.parse(request.body));
  await audit(request, "sale.updated", "SalesOrder", value.id);
  sendSuccess(response, value);
}));
for (const action of ["submit", "approve", "ship"]) operationRouter.post(`/sales/:salesId/${action}`, asyncHandler(async (request, response) => {
  writable(request); const value = await transitionSale(request.company.id, request.params.salesId, action);
  await audit(request, `sale.${action}`, "SalesOrder", value.id);
  if (action !== "ship") await dispatchOperationEvent({ companyId: request.company.id, event: action === "submit" ? "SALE_SUBMITTED" : "SALE_APPROVED", payload: value, correlationId: request.id, requestId: request.id, origin: "SALES", userId: request.user.id });
  sendSuccess(response, value);
}));
operationRouter.post("/sales/:salesId/reject", asyncHandler(async (request, response) => {
  writable(request); const { reason } = reasonSchema.parse(request.body);
  const value = await transitionSale(request.company.id, request.params.salesId, "reject", reason);
  await audit(request, "sale.reject", "SalesOrder", value.id, { reason });
  sendSuccess(response, value);
}));
operationRouter.post("/sales/:salesId/reserve", asyncHandler(async (request, response) => {
  writable(request); const value = await reserveSale(request.company.id, request.params.salesId);
  await audit(request, "sale.reserved", "SalesOrder", value.id);
  sendSuccess(response, value);
}));
operationRouter.post("/sales/:salesId/release", asyncHandler(async (request, response) => {
  writable(request); const value = await releaseSale(request.company.id, request.params.salesId);
  await audit(request, "sale.released", "SalesOrder", value.id);
  sendSuccess(response, value);
}));
operationRouter.post("/sales/:salesId/invoice", asyncHandler(async (request, response) => {
  writable(request); const input = invoiceSchema.parse(request.body);
  const value = await invoiceSale(request.company.id, request.user.id, request.params.salesId, input);
  await audit(request, "sale.invoiced", "SalesOrder", request.params.salesId, { allocationId: value.id, documentType: input.documentType, status: value.status });
  await dispatchOperationEvent({ companyId: request.company.id, event: "SALE_INVOICED", payload: value, correlationId: request.id, requestId: request.id, origin: "SALES", userId: request.user.id });
  sendSuccess(response, value, 201);
}));
operationRouter.post("/sales/:salesId/cancel", asyncHandler(async (request, response) => {
  writable(request); const { reason } = reasonSchema.parse(request.body);
  const value = await cancelSale(request.company.id, request.params.salesId, reason);
  await audit(request, "sale.canceled", "SalesOrder", value.id, { reason });
  await dispatchOperationEvent({ companyId: request.company.id, event: "SALE_CANCELED", payload: value, correlationId: request.id, requestId: request.id, origin: "SALES", userId: request.user.id });
  sendSuccess(response, value);
}));
operationRouter.post("/sales/:salesId/returns", asyncHandler(async (request, response) => {
  writable(request); const input = returnSchema.parse(request.body);
  const value = await returnSale(request.company.id, request.user.id, request.params.salesId, input);
  await audit(request, "sale.returned", "SalesOrder", request.params.salesId, { returnId: value.id, reason: input.reason });
  sendSuccess(response, value, 201);
}));

operationRouter.get("/dashboard", asyncHandler(async (request, response) => {
  sendSuccess(response, await getOperationDashboard(request.company.id, dashboardSchema.parse(request.query)));
}));
operationRouter.get("/automations", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  const where = { companyId: request.company.id, ...(query.status ? { status: query.status } : {}), ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { event: { contains: query.q, mode: "insensitive" } }, { module: { contains: query.q, mode: "insensitive" } }] } : {}) };
  sendSuccess(response, await pageResult("operationAutomation", where, query, { responsible: { select: { id: true, name: true } }, _count: { select: { runs: true } } }, { priority: "desc" }));
}));
operationRouter.post("/automations", asyncHandler(async (request, response) => {
  writable(request); const value = await createAutomation(request.company.id, automationSchema.parse(request.body));
  await audit(request, "automation.created", "OperationAutomation", value.id);
  sendSuccess(response, value, 201);
}));
operationRouter.get("/automations/:automationId", asyncHandler(async (request, response) => {
  const value = await scopedAutomation(prisma, request.company.id, request.params.automationId);
  if (!value) throw operationNotFound("Automação");
  sendSuccess(response, value);
}));
operationRouter.patch("/automations/:automationId", asyncHandler(async (request, response) => {
  writable(request); const value = await updateAutomation(request.company.id, request.params.automationId, automationSchema.partial().parse(request.body));
  await audit(request, "automation.updated", "OperationAutomation", value.id);
  sendSuccess(response, value);
}));
for (const action of ["activate", "deactivate"]) operationRouter.post(`/automations/:automationId/${action}`, asyncHandler(async (request, response) => {
  writable(request); const value = await updateAutomation(request.company.id, request.params.automationId, { status: action === "activate" ? "ACTIVE" : "INACTIVE" });
  await audit(request, `automation.${action}`, "OperationAutomation", value.id);
  sendSuccess(response, value);
}));
operationRouter.post("/automations/:automationId/duplicate", asyncHandler(async (request, response) => {
  writable(request); const value = await duplicateAutomation(request.company.id, request.params.automationId);
  await audit(request, "automation.duplicated", "OperationAutomation", value.id, { sourceId: request.params.automationId });
  sendSuccess(response, value, 201);
}));
operationRouter.post("/automations/:automationId/test", asyncHandler(async (request, response) => {
  writable(request); const automation = await scopedAutomation(prisma, request.company.id, request.params.automationId);
  if (!automation) throw operationNotFound("Automação");
  const input = automationRunSchema.omit({ idempotencyKey: true }).parse(request.body);
  sendSuccess(response, { evaluation: evaluateAutomation(automation, input.payload), actions: automation.actions.map((action) => ({ type: action.type, sensitive: ["MOVE_INVENTORY","ISSUE_FISCAL_DOCUMENT","CANCEL_FISCAL_DOCUMENT","CHANGE_MARKETPLACE_PRICE","PAY_FINANCIAL_ENTRY","RECEIVE_FINANCIAL_ENTRY"].includes(action.type) })) });
}));
operationRouter.post("/automations/:automationId/run", asyncHandler(async (request, response) => {
  writable(request); const automation = await scopedAutomation(prisma, request.company.id, request.params.automationId);
  if (!automation) throw operationNotFound("Automação");
  const value = await runAutomation(automation, automationRunSchema.parse(request.body), request.user.id);
  await audit(request, "automation.run", "OperationAutomationRun", value.id, { automationId: automation.id, status: value.status });
  sendSuccess(response, value, 201);
}));
operationRouter.get("/automation-runs", asyncHandler(async (request, response) => {
  const query = listSchema.parse(request.query);
  const where = { companyId: request.company.id, ...(query.status ? { status: query.status } : {}), ...(query.q ? { OR: [{ requestId: { contains: query.q, mode: "insensitive" } }, { correlationId: { contains: query.q, mode: "insensitive" } }, { event: { contains: query.q, mode: "insensitive" } }] } : {}) };
  sendSuccess(response, await pageResult("operationAutomationRun", where, query, { automation: { select: { id: true, name: true } }, user: { select: { id: true, name: true } } }));
}));
operationRouter.get("/automation-runs/:runId", asyncHandler(async (request, response) => {
  const value = await scopedAutomationRun(prisma, request.company.id, request.params.runId);
  if (!value) throw operationNotFound("Execução");
  sendSuccess(response, value);
}));
operationRouter.post("/automation-runs/:runId/retry", asyncHandler(async (request, response) => {
  writable(request); const value = await retryAutomationRun(request.company.id, request.params.runId, request.user.id);
  await audit(request, "automation.run.retry", "OperationAutomationRun", value.id, { previousRunId: request.params.runId });
  sendSuccess(response, value, 201);
}));
operationRouter.post("/automation-runs/:runId/cancel", asyncHandler(async (request, response) => {
  writable(request); const value = await cancelAutomationRun(request.company.id, request.params.runId);
  await audit(request, "automation.run.canceled", "OperationAutomationRun", value.id);
  sendSuccess(response, value);
}));
