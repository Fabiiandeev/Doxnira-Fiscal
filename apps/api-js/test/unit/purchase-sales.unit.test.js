import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { invoiceSchema, purchaseSchema, reasonSchema, salesSchema } from "../../src/modules/operation/operation.schemas.js";

const id = () => crypto.randomUUID();
test("compras validam itens, valores e justificativa", () => {
  const purchase = { number: "PC-1", supplierId: id(), warehouseId: id(), issueDate: new Date(), totalAmount: 10, items: [{ productId: id(), quantity: 1, unitValue: 10 }] };
  assert.equal(purchaseSchema.safeParse(purchase).success, true);
  assert.equal(purchaseSchema.safeParse({ ...purchase, items: [] }).success, false);
  assert.equal(reasonSchema.safeParse({ reason: "" }).success, false);
});
test("vendas validam chave, itens e tipos fiscais", () => {
  const sale = { number: "PV-1", clientId: id(), warehouseId: id(), issueDate: new Date(), totalAmount: 10, items: [{ productId: id(), quantity: 1, unitValue: 10 }] };
  assert.equal(salesSchema.safeParse(sale).success, true);
  assert.equal(invoiceSchema.safeParse({ documentType: "FAKE", idempotencyKey: "12345678", items: [{ salesOrderItemId: id(), quantity: 1 }] }).success, false);
});
test("migration 08B é aditiva e relacional", () => {
  const sql = fs.readFileSync(new URL("../../prisma/migrations/20260728090000_add_purchase_sales_operation_core/migration.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
  for (const table of ["purchase_orders","purchase_order_items","purchase_receipts","sale_orders","sales_order_items","sales_invoice_allocations","sales_returns"]) assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
});
test("frontend 08B está conectado às APIs, filtros, paginação e ações", () => {
  const root = new URL("../../../web/", import.meta.url);
  const list = fs.readFileSync(new URL("components/operation/orders/orders-view.tsx", root), "utf8");
  const form = fs.readFileSync(new URL("components/operation/orders/order-form.tsx", root), "utf8");
  const detail = fs.readFileSync(new URL("components/operation/orders/order-detail.tsx", root), "utf8");
  assert.match(list, /isLoading[\s\S]*isError[\s\S]*Nenhum pedido[\s\S]*pagination/);
  assert.match(form, /useQuery/); assert.match(form, /required/); assert.match(form, /mutation\.mutate/);
  for (const action of ["approve","receive","reserve","invoice","returns"]) assert.match(detail, new RegExp(action));
});
