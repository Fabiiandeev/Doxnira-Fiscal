import assert from "node:assert/strict";
import test from "node:test";

import { currentPrices, serializePlan } from "../../src/modules/plans/plans.service.js";
import { isPlatformRole } from "../../src/modules/plans/plans.routes.js";

const at = new Date("2026-07-28T12:00:00.000Z");

test("seleciona somente a versão de preço vigente sem apagar o histórico", () => {
  const expired = {
    id: "old",
    interval: "MONTHLY",
    amountCents: 20000,
    currency: "BRL",
    active: true,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: new Date("2026-07-01T00:00:00.000Z"),
  };
  const current = {
    id: "current",
    interval: "MONTHLY",
    amountCents: 25000,
    currency: "BRL",
    active: true,
    validFrom: new Date("2026-07-01T00:00:00.000Z"),
    validUntil: null,
  };
  const future = {
    ...current,
    id: "future",
    amountCents: 30000,
    validFrom: new Date("2026-08-01T00:00:00.000Z"),
  };

  assert.deepEqual(currentPrices({ prices: [expired, current, future] }, at).monthly.amountCents, 25000);
  assert.equal(serializePlan({ prices: [expired, current, future], features: [] }).priceHistory.length, 3);
});

test("serializa limites e recursos booleanos de forma explicável", () => {
  const result = serializePlan({
    prices: [],
    features: [
      { code: "NFE", valueType: "BOOLEAN", value: "true" },
      { code: "SUPPORT", valueType: "BOOLEAN", value: "false" },
      { code: "USERS", valueType: "INTEGER", value: "5" },
      { code: "DOCUMENTS", valueType: "UNLIMITED", value: null },
    ],
    _count: { subscriptions: 7 },
  });

  assert.deepEqual(result.features.map((feature) => feature.included), [true, false, true, true]);
  assert.equal(result.subscribers, 7);
});

test("não publica preço futuro ou inativo antes da vigência", () => {
  const prices = [
    { id: "inactive", interval: "YEARLY", amountCents: 100, currency: "BRL", active: false, validFrom: new Date("2020-01-01"), validUntil: null },
    { id: "future", interval: "YEARLY", amountCents: 200, currency: "BRL", active: true, validFrom: new Date("2030-01-01"), validUntil: null },
  ];
  assert.deepEqual(currentPrices({ prices }, at), {});
});

test("somente administradores da plataforma pertencem ao escopo administrativo", () => {
  assert.equal(isPlatformRole("PLATFORM_ADMIN"), true);
  assert.equal(isPlatformRole("PLATFORM_SUPER_ADMIN"), true);
  assert.equal(isPlatformRole("ADMIN"), false);
  assert.equal(isPlatformRole("VIEWER"), false);
});
