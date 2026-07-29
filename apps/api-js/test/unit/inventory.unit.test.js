import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { adjustmentSchema, transferSchema } from "../../src/modules/operation/operation.schemas.js";
import { availableQuantity, calculateAverageCost, requireReason } from "../../src/modules/operation/inventory.service.js";
import { viewerForbidden } from "../../src/modules/operation/operation-errors.js";

test("entrada calcula custo médio monetário com Decimal", () => assert.equal(calculateAverageCost("10", "5.00", "10", "7.00").toFixed(2), "6.00"));
test("saída preserva custo médio", () => assert.equal(calculateAverageCost("10", "5.25", "-2", "99").toFixed(2), "5.25"));
test("disponibilidade desconta reservas sem alterar físico", () => assert.equal(availableQuantity({ physicalQuantity: "12.5", reservedQuantity: "2.25" }).toFixed(2), "10.25"));
test("ajuste exige justificativa", () => {
  assert.throws(() => requireReason(" "), /Justificativa/);
  assert.equal(requireReason(" contagem "), "contagem");
  assert.equal(adjustmentSchema.safeParse({ warehouseId: crypto.randomUUID(), productId: crypto.randomUUID(), quantity: 1, reason: "", idempotencyKey: "12345678" }).success, false);
});
test("transferência exige origem e destino diferentes", () => {
  const id = crypto.randomUUID();
  assert.equal(transferSchema.safeParse({ sourceWarehouseId: id, destinationWarehouseId: id, items: [{ productId: crypto.randomUUID(), quantity: 1 }] }).success, false);
});
test("VIEWER recebe erro 403", () => assert.equal(viewerForbidden().statusCode, 403));
test("migration de estoque é aditiva e contém constraints críticas", () => {
  const sql = fs.readFileSync(new URL("../../prisma/migrations/20260728070000_add_inventory_operation_core/migration.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
  assert.match(sql, /inventory_balances_quantities_check/);
  assert.match(sql, /operation_warehouses_one_active_default/);
  assert.match(sql, /inventory_movements_company_id_idempotency_key_key/);
});
