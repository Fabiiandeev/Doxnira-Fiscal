import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIncomingInventoryPlan,
  incomingInventoryReadiness,
  validateIncomingPayableInstallments,
} from "../../src/modules/nfe-entry/nfe-entry-rules.js";

test("NF-e de entrada prepara custos rateados sem movimentar estoque", () => {
  const plan = buildIncomingInventoryPlan({
    productsAmount: 300,
    freightAmount: 30,
    discountAmount: 15,
    items: [
      { id: "item-1", productId: "product-1", quantity: 2, totalValue: 100 },
      { id: "item-2", productId: "product-2", quantity: 4, totalValue: 200 },
    ],
  });

  assert.equal(plan.length, 2);
  assert.equal(plan[0].freightShare, 10);
  assert.equal(plan[0].discountShare, 5);
  assert.equal(plan[0].totalCost, 105);
  assert.equal(plan[0].unitCost, 52.5);
  assert.equal(plan[0].totalCost + plan[1].totalCost, 315);
});

test("NF-e de entrada bloqueia estoque com produto pendente ou alerta crítico", () => {
  assert.deepEqual(
    incomingInventoryReadiness({ items: [{ id: "item-1", productId: null, stockIgnored: false }], alerts: [] }),
    { status: "BLOCKED", canPost: false },
  );
  assert.deepEqual(
    incomingInventoryReadiness({ items: [{ id: "item-1", productId: "product-1" }], alerts: [{ severity: "error" }] }),
    { status: "BLOCKED", canPost: false },
  );
});

test("NF-e de entrada só libera estoque preparado sem pendências críticas", () => {
  assert.deepEqual(
    incomingInventoryReadiness({ items: [{ id: "item-1", productId: "product-1" }], alerts: [], status: "PENDENTE_ESTOQUE" }),
    { status: "READY_TO_POST", canPost: true },
  );
});

test("contas a pagar exigem parcelas únicas, válidas e com soma igual à NF-e", () => {
  const entry = { totalAmount: 300 };
  assert.deepEqual(
    validateIncomingPayableInstallments(entry, [
      { number: "001", dueDate: "2026-08-10", amount: 100 },
      { number: "002", dueDate: "2026-09-10", amount: 200 },
    ]),
    [],
  );
  const issues = validateIncomingPayableInstallments(entry, [{ number: "001", dueDate: "invalid", amount: 99 }]);
  assert.equal(issues.length, 2);
  assert.match(issues.join(" "), /Vencimento/);
  assert.match(issues.join(" "), /soma das parcelas/i);
});
