import { z } from "zod";

const uuid = z.string().uuid();
const quantity = z.coerce.number().positive();
export const listSchema = z.object({
  q: z.string().trim().optional(),
  warehouseId: uuid.optional(),
  productId: uuid.optional(),
  status: z.string().trim().optional(),
  type: z.string().trim().optional(),
  sourceType: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const warehouseSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  isDefault: z.boolean().default(false),
});
export const adjustmentSchema = z.object({
  warehouseId: uuid,
  productId: uuid,
  quantity: z.coerce.number().refine((value) => value !== 0, "A diferença deve ser diferente de zero."),
  unitCost: z.coerce.number().nonnegative().optional(),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(8).max(180),
});
export const reservationSchema = z.object({
  warehouseId: uuid,
  productId: uuid,
  quantity,
  sourceType: z.string().trim().min(1).max(40),
  sourceId: z.string().trim().max(100).nullable().optional(),
  externalKey: z.string().trim().min(3).max(180),
  expiresAt: z.coerce.date().nullable().optional(),
});
export const transferSchema = z.object({
  sourceWarehouseId: uuid,
  destinationWarehouseId: uuid,
  reason: z.string().trim().max(500).nullable().optional(),
  items: z.array(z.object({ productId: uuid, quantity, unitCost: z.coerce.number().nonnegative().optional() })).min(1),
}).refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
  message: "Origem e destino devem ser diferentes.",
  path: ["destinationWarehouseId"],
});
export const countSchema = z.object({
  warehouseId: uuid,
  notes: z.string().trim().max(1000).nullable().optional(),
  productIds: z.array(uuid).optional(),
});
export const countItemsSchema = z.object({
  items: z.array(z.object({ productId: uuid, countedQuantity: z.coerce.number().nonnegative() })).min(1),
});
const money = z.coerce.number().nonnegative().default(0);
const orderItem = z.object({
  productId: uuid,
  quantity,
  unitValue: z.coerce.number().nonnegative(),
  discountAmount: money,
  taxAmount: money,
});
const installments = z.array(z.object({ number: z.string().min(1), dueDate: z.coerce.date(), amount: z.coerce.number().positive() })).default([]);
export const purchaseSchema = z.object({
  number: z.string().trim().min(1).max(80), supplierId: uuid, warehouseId: uuid,
  issueDate: z.coerce.date(), expectedDate: z.coerce.date().nullable().optional(),
  competenceDate: z.coerce.date().nullable().optional(), paymentCondition: z.string().max(120).nullable().optional(),
  freightAmount: money, discountAmount: money, taxAmount: money, totalAmount: z.coerce.number().positive(),
  notes: z.string().max(5000).nullable().optional(), externalKey: z.string().max(180).nullable().optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).default([]),
  installments, items: z.array(orderItem).min(1),
});
export const receiptSchema = z.object({
  idempotencyKey: z.string().min(8).max(180), nfeEntryId: uuid.nullable().optional(),
  justification: z.string().trim().max(500).nullable().optional(), confirmExcess: z.boolean().default(false),
  items: z.array(z.object({ purchaseOrderItemId: uuid, quantity, unitCost: z.coerce.number().nonnegative().optional() })).min(1),
});
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const salesSchema = z.object({
  number: z.string().trim().min(1).max(80), origin: z.string().max(40).default("MANUAL"),
  externalKey: z.string().max(180).nullable().optional(), marketplaceOrderId: uuid.nullable().optional(),
  clientId: uuid, warehouseId: uuid, issueDate: z.coerce.date(),
  paymentCondition: z.string().max(120).nullable().optional(), freightAmount: money,
  discountAmount: money, taxAmount: money, totalAmount: z.coerce.number().positive(),
  notes: z.string().max(5000).nullable().optional(), items: z.array(orderItem).min(1),
});
export const invoiceSchema = z.object({
  documentType: z.enum(["NFE", "NFCE", "NFSE"]), idempotencyKey: z.string().min(8).max(180),
  items: z.array(z.object({ salesOrderItemId: uuid, quantity })).min(1),
  dueDate: z.coerce.date().optional(),
});
export const returnSchema = z.object({
  reason: z.string().trim().min(3).max(500), idempotencyKey: z.string().min(8).max(180),
  adjustFinancial: z.boolean().default(true),
  items: z.array(z.object({ salesOrderItemId: uuid, quantity })).min(1),
});
export const marketplaceImportSchema = z.object({
  marketplaceOrderId: uuid, clientId: uuid, warehouseId: uuid,
  products: z.record(z.string(), uuid),
});
export const dashboardSchema = z.object({
  from: z.coerce.date().optional(), to: z.coerce.date().optional(), warehouseId: uuid.optional(),
  productId: uuid.optional(), supplierId: uuid.optional(), clientId: uuid.optional(),
  origin: z.string().optional(), status: z.string().optional(),
});
export const automationConditionSchema = z.object({
  field: z.string().trim().min(1).max(120),
  operator: z.enum(["EQUALS","NOT_EQUALS","GREATER_THAN","GREATER_OR_EQUAL","LESS_THAN","LESS_OR_EQUAL","CONTAINS","IN","IS_EMPTY","IS_NOT_EMPTY"]),
  value: z.unknown().optional(), valueType: z.enum(["STRING","NUMBER","BOOLEAN","DATE","ARRAY"]).default("STRING"),
  group: z.string().max(40).default("default"),
});
export const automationActionSchema = z.object({
  type: z.enum(["CREATE_ALERT","CREATE_TASK","CREATE_PENDING_ISSUE","ASSIGN_RESPONSIBLE","SEND_TO_DECISION_CENTER","SEND_INTERNAL_NOTIFICATION","START_MARKETPLACE_SYNC","CREATE_FINANCIAL_DRAFT","REQUEST_ACCOUNTANT_REVIEW","MOVE_INVENTORY","ISSUE_FISCAL_DOCUMENT","CANCEL_FISCAL_DOCUMENT","CHANGE_MARKETPLACE_PRICE","PAY_FINANCIAL_ENTRY","RECEIVE_FINANCIAL_ENTRY"]),
  config: z.record(z.string(), z.unknown()).default({}), idempotencyKey: z.string().min(8).optional(),
  safetyClassification: z.string().optional(),
});
export const automationSchema = z.object({
  name: z.string().trim().min(2).max(160), description: z.string().max(1000).nullable().optional(),
  module: z.string().trim().min(2).max(40),
  event: z.enum(["INVENTORY_BELOW_MINIMUM","INVENTORY_ZERO","INVENTORY_RESERVATION_EXPIRED","PURCHASE_SUBMITTED","PURCHASE_APPROVED","PURCHASE_RECEIVED","SALE_SUBMITTED","SALE_APPROVED","SALE_INVOICED","SALE_CANCELED","MARKETPLACE_ORDER_IMPORTED","FISCAL_DOCUMENT_AUTHORIZED","FISCAL_DOCUMENT_REJECTED","FINANCIAL_DUE_SOON","FINANCIAL_OVERDUE","CERTIFICATE_EXPIRING","MARKETPLACE_SYNC_FAILED"]),
  conditions: z.array(automationConditionSchema).default([]), conditionLogic: z.enum(["AND","OR"]).default("AND"),
  actions: z.array(automationActionSchema).min(1), priority: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(["ACTIVE","INACTIVE"]).default("ACTIVE"), startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(), executionLimit: z.coerce.number().int().positive().nullable().optional(),
  cooldownSeconds: z.coerce.number().int().min(0).max(2592000).default(0),
  responsibleId: uuid.nullable().optional(), allowSelfTrigger: z.boolean().default(false),
  maxDepth: z.coerce.number().int().min(1).max(20).default(5),
});
export const automationRunSchema = z.object({
  event: z.string().max(60).optional(), payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().min(8).max(180), correlationId: z.string().max(120).optional(),
  causationId: z.string().max(120).nullable().optional(), depth: z.coerce.number().int().min(0).default(0),
  requestId: z.string().max(120).optional(), origin: z.string().max(60).default("MANUAL"),
  confirmSensitive: z.boolean().default(false),
});
