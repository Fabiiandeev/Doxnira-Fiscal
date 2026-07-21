import assert from "node:assert/strict";
import test from "node:test";

import { addCalendarMonths, addCalendarYears, calculateNextPeriod, calculateTrialPeriod } from "../../src/modules/subscription/subscription-period.service.js";
import { ManualBillingProvider, MockBillingProvider, getBillingProvider } from "../../src/modules/subscription/subscription-billing-provider.js";
import { findReplay, snapshot } from "../../src/modules/subscription/subscription-history.service.js";
import { conditionalUpdate } from "../../src/modules/subscription/subscription-lifecycle.service.js";
import { buildUsageIdempotencyKey } from "../../src/modules/subscription/subscription-usage.service.js";

test("periodos preservam calendario, horario e limites de trial", () => {
  const now = new Date("2024-01-31T15:30:00.000Z");
  assert.equal(addCalendarMonths(now, 1).toISOString(), "2024-02-29T15:30:00.000Z");
  assert.equal(addCalendarMonths(new Date("2024-03-31T15:30:00.000Z"), 1).toISOString(), "2024-04-30T15:30:00.000Z");
  assert.equal(addCalendarYears(new Date("2024-02-29T15:30:00.000Z"), 1).toISOString(), "2025-02-28T15:30:00.000Z");
  assert.equal(calculateTrialPeriod({ now, trialDays: 14 }).trialEndsAt.toISOString(), "2024-02-14T15:30:00.000Z");
  assert.equal(calculateTrialPeriod({ now, trialDays: 90 }).currentPeriodEnd.toISOString(), "2024-04-30T15:30:00.000Z");
  assert.throws(() => calculateTrialPeriod({ now, trialDays: 0 }), { code: "SUBSCRIPTION_CONFIGURATION_ERROR" });
  assert.equal(calculateNextPeriod({ periodStart: now, billingCycle: "MONTHLY" }).currentPeriodEnd.toISOString(), "2024-02-29T15:30:00.000Z");
  assert.equal(calculateNextPeriod({ periodStart: now, billingCycle: "ANNUAL" }).currentPeriodEnd.toISOString(), "2025-01-31T15:30:00.000Z");
});

test("providers manual e mock sao deterministicos e sem cobranca", async () => {
  const manual = new ManualBillingProvider();
  for (const operation of [manual.createSubscription("a"), manual.changeSubscription("b"), manual.cancelSubscription("c"), manual.reactivateSubscription("d")]) {
    const result = await operation;
    assert.equal(result.provider, "MANUAL"); assert.equal(result.accepted, true); assert.equal(result.financialTransactionCreated, false); assert.equal(result.externalReference, null);
  }
  const mock = getBillingProvider({ provider: "MOCK", allowMock: true, options: { deterministicOperationId: "fixed" } });
  assert.equal((await mock.createSubscription("x")).operationId, "manual:subscription:fixed");
  await assert.rejects(() => new MockBillingProvider({ shouldFail: true, failOperation: "cancel" }).cancelSubscription("x"), { code: "BILLING_PROVIDER_ERROR" });
  assert.throws(() => getBillingProvider({ provider: "MOCK" }), { code: "SUBSCRIPTION_CONFIGURATION_ERROR" });
});

test("history replay, snapshot e chave de usage", async () => {
  const sub = { id:"s", companyId:"c", planId:"p", planPriceId:"pp", billingCycle:"MONTHLY", status:"ACTIVE", currentPeriodStart:new Date(), currentPeriodEnd:new Date(), trialEndsAt:null, cancelAtPeriodEnd:false, nextPlanId:null,nextPlanPriceId:null,nextPlanEffectiveAt:null };
  assert.equal(snapshot(sub).subscriptionId, "s");
  assert.equal(buildUsageIdempotencyKey({ companyId:"c", usageCode:"nfe", sourceType:"DOC", sourceId:"1", periodStart:"2026-07-01" }), "c:nfe:DOC:1:2026-07");
  const tx = { subscriptionHistory: { findFirst: async () => ({ changeType: "UPGRADED" }) } };
  assert.equal((await findReplay(tx, "s", "key", "UPGRADED")).changeType, "UPGRADED");
  await assert.rejects(() => findReplay(tx, "s", "key", "CANCELED"), { code:"SUBSCRIPTION_IDEMPOTENCY_CONFLICT" });
});

test("conditionalUpdate usa updateMany e detecta concorrencia", async () => {
  const sub = { id:"s", companyId:"c", status:"ACTIVE",planId:"p",planPriceId:"pp",billingCycle:"MONTHLY",cancelAtPeriodEnd:false,canceledAt:null,endedAt:null,nextPlanId:null,nextPlanPriceId:null,nextPlanEffectiveAt:null,currentPeriodStart:new Date(),currentPeriodEnd:new Date(),trialEndsAt:null };
  let calls = 0;
  const tx = { subscription: { updateMany: async () => { calls++; return { count: 1 }; }, findUnique: async () => ({ ...sub, status:"CANCELED" }) } };
  assert.equal((await conditionalUpdate(tx, sub, { status:"CANCELED" }, "CANCELED")).subscription.status, "CANCELED"); assert.equal(calls, 1);
  await assert.rejects(() => conditionalUpdate({ subscription:{ updateMany:async()=>({count:0}) } }, sub, {}, "CANCELED"), { code:"SUBSCRIPTION_CONCURRENT_MODIFICATION" });
});
