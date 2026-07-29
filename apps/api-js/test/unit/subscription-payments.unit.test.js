import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createInfinitePayClient } from "../../src/modules/subscriptions/infinitepay.client.js";
import { createInvoiceSchema } from "../../src/modules/subscriptions/subscriptions.schemas.js";
import { createSubscriptionService, validatePayment } from "../../src/modules/subscriptions/subscriptions.service.js";

const invoice = {
  id: "invoice-1",
  subscriptionId: "subscription-1",
  planId: "plan-1",
  planPriceId: "price-1",
  amountCents: 22990,
  orderNsu: "order-1",
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodEnd: new Date("2026-09-01T00:00:00.000Z"),
  descriptionSnapshot: "Plano Professional",
  status: "OPEN",
};

test("payload de criação aceita somente planId e periodicidade", () => {
  assert.throws(
    () => createInvoiceSchema.parse({
      planId: "b5a0bf03-915d-475b-a241-d38ce6890815",
      billingInterval: "MONTHLY",
      amountCents: 1,
    }),
    /unrecognized/i,
  );
});

test("InfinitePayClient envia exclusivamente o valor fixado na fatura", async () => {
  let request;
  const client = createInfinitePayClient({
    fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return new Response(JSON.stringify({ url: "https://checkout.infinitepay.test/link" }), { status: 200 });
    },
    config: {
      INFINITEPAY_API_BASE_URL: "https://api.checkout.infinitepay.test",
      INFINITEPAY_HANDLE: "phfabian",
      INFINITEPAY_REDIRECT_URL: "https://app.test/return",
      INFINITEPAY_WEBHOOK_URL: "https://api.test/webhook",
    },
  });
  await client.createCheckout({ orderNsu: invoice.orderNsu, amountCents: invoice.amountCents, description: invoice.descriptionSnapshot });
  assert.equal(request.items[0].price, 22990);
  assert.equal(request.order_nsu, "order-1");
  assert.equal(request.handle, "phfabian");
});

test("snapshot da fatura copia preço vigente do banco e não recebe valor externo", async () => {
  let created;
  const repository = {
    companyForUser: async () => ({ id: "company-1" }),
    planWithCurrentPrice: async () => ({
      id: "plan-1",
      code: "PROFESSIONAL",
      name: "Profissional",
      checkoutDescription: "Assinatura Professional",
      prices: [{ id: "price-1", amountCents: 22990, currency: "BRL" }],
    }),
    transaction: async (callback) => callback(repository),
    subscriptionForCompany: async () => null,
    createSubscription: async () => ({ id: "subscription-1" }),
    createInvoice: async (data) => {
      created = data;
      return { id: "invoice-1", ...data };
    },
  };
  const service = createSubscriptionService(repository, {});
  await service.createInvoice({
    companyId: "company-1",
    userId: "user-1",
    planId: "plan-1",
    billingInterval: "MONTHLY",
    amountCents: 1,
  });
  assert.equal(created.amountCents, 22990);
  assert.equal(created.planPriceId, "price-1");
  assert.equal(created.planNameSnapshot, "Profissional");
});

test("checkout usa amountCents da SubscriptionInvoice", async () => {
  let providerInput;
  const repository = {
    invoiceForCompany: async () => invoice,
    updateInvoice: async (_id, data) => ({ ...invoice, ...data }),
  };
  const provider = {
    createCheckout: async (input) => {
      providerInput = input;
      return { url: "https://checkout.infinitepay.test/link" };
    },
  };
  await createSubscriptionService(repository, provider).createCheckout(invoice.id, "company-1");
  assert.equal(providerInput.amountCents, invoice.amountCents);
});

test("validação exige status pago, valor, NSUs e método permitido", () => {
  const valid = {
    success: true,
    paid: true,
    amount: 22990,
    paid_amount: 22990,
    capture_method: "pix",
  };
  assert.deepEqual(validatePayment(invoice, valid, { orderNsu: "order-1", transactionNsu: "txn-1" }), []);
  assert.deepEqual(
    validatePayment(invoice, { ...valid, paid: false, amount: 1, paid_amount: 0, capture_method: "cash" }, { orderNsu: "wrong", transactionNsu: "" }),
    ["paid", "order_nsu", "transaction_nsu", "amount", "paid_amount", "capture_method"],
  );
});

test("assinatura só é ativada após payment_check válido", async () => {
  let activated = false;
  const repository = {
    transaction: async (callback) => callback(repository),
    updateInvoice: async (_id, data) => ({ ...invoice, ...data }),
    activateSubscription: async () => { activated = true; },
  };
  const goodProvider = { checkPayment: async () => ({ success: true, paid: true, amount: 22990, paid_amount: 22990, capture_method: "credit_card" }) };
  await createSubscriptionService(repository, goodProvider).confirm(invoice, {
    orderNsu: "order-1",
    transactionNsu: "txn-1",
    invoiceSlug: "slug-1",
  });
  assert.equal(activated, true);

  activated = false;
  const badProvider = { checkPayment: async () => ({ success: true, paid: true, amount: 1, paid_amount: 1, capture_method: "pix" }) };
  await assert.rejects(
    createSubscriptionService(repository, badProvider).confirm(invoice, {
      orderNsu: "order-1",
      transactionNsu: "txn-2",
      invoiceSlug: "slug-2",
    }),
    (error) => error.code === "PAYMENT_VALIDATION_FAILED",
  );
  assert.equal(activated, false);
});

test("webhook repetido é idempotente pelo fingerprint", async () => {
  const payload = { order_nsu: "order-1", transaction_nsu: "txn-1" };
  const serviceProbe = createSubscriptionService({}, {});
  const fingerprint = serviceProbe.fingerprint(payload);
  const repository = {
    webhookByFingerprint: async (value) => value === fingerprint ? { id: "event-1", fingerprint } : null,
  };
  const result = await createSubscriptionService(repository, {}).receiveWebhook(payload);
  assert.equal(result.duplicate, true);
  assert.equal(result.event.id, "event-1");
});

test("migration é aditiva e frontend está conectado às APIs de pagamento", async () => {
  const migration = await readFile(new URL("../../prisma/migrations/20260729010000_infinitepay_checkout/migration.sql", import.meta.url), "utf8");
  assert.doesNotMatch(migration, /\b(DROP\s+(TABLE|COLUMN)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i);
  assert.match(migration, /protect_subscription_invoice_snapshot_before_update/);
  assert.match(migration, /NEW\."amount_cents"\s+IS\s+DISTINCT\s+FROM\s+OLD\."amount_cents"/i);
  const frontend = await readFile(new URL("../../../web/lib/services/subscription-payment-service.ts", import.meta.url), "utf8");
  const catalog = await readFile(new URL("../../../web/components/subscription-plans/plan-catalog.tsx", import.meta.url), "utf8");
  const paymentReturn = await readFile(new URL("../../../web/components/subscription-plans/payment-return.tsx", import.meta.url), "utf8");
  const routes = await readFile(new URL("../../src/modules/subscriptions/subscriptions.routes.js", import.meta.url), "utf8");
  assert.match(frontend, /subscription\/invoices/);
  assert.match(catalog, /createInvoice/);
  assert.match(catalog, /createCheckout/);
  assert.match(paymentReturn, /checkPayment/);
  for (const event of ["CHECKOUT_CREATED", "PAYMENT_WEBHOOK_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_VALIDATION_FAILED", "INVOICE_PAID"]) {
    assert.match(routes, new RegExp(event));
  }
});
