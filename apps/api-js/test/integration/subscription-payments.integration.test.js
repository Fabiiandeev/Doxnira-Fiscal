import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { createSubscriptionService } from "../../src/modules/subscriptions/subscriptions.service.js";
import { subscriptionRepository } from "../../src/modules/subscriptions/subscriptions.repository.js";

after(disconnectDatabase);

test("fatura preserva snapshot e bloqueia leitura cruzada entre empresas", async () => {
  const marker = randomUUID();
  const digits = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`.replace(/\D/g, "").padEnd(28, "7");
  const owner = await prisma.user.create({ data: { name: "Billing Owner", email: `billing-${marker}@test.invalid`, passwordHash: "test" } });
  const otherOwner = await prisma.user.create({ data: { name: "Other Billing", email: `billing-other-${marker}@test.invalid`, passwordHash: "test" } });
  const company = await prisma.company.create({ data: { ownerId: owner.id, legalName: "Billing Company", cnpj: digits.slice(0, 14) } });
  const otherCompany = await prisma.company.create({ data: { ownerId: otherOwner.id, legalName: "Other Company", cnpj: digits.slice(14, 28) } });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: `TEST_${marker.replaceAll("-", "").slice(0, 10)}`,
      slug: `test-${marker}`,
      name: "Plano Original",
      status: "ACTIVE",
      availableForSale: true,
      prices: {
        create: {
          interval: "MONTHLY",
          amountCents: 19990,
          currency: "BRL",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    },
    include: { prices: true },
  });
  const service = createSubscriptionService(subscriptionRepository, {});
  try {
    const invoice = await service.createInvoice({
      companyId: company.id,
      userId: owner.id,
      planId: plan.id,
      billingInterval: "MONTHLY",
      amountCents: 1,
    });
    assert.equal(invoice.amountCents, 19990);
    assert.equal(invoice.planNameSnapshot, "Plano Original");

    await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { name: "Plano Alterado" } });
    await prisma.subscriptionPlanPrice.update({ where: { id: plan.prices[0].id }, data: { amountCents: 29990 } });
    const persisted = await prisma.subscriptionInvoice.findUnique({ where: { id: invoice.id } });
    assert.equal(persisted.amountCents, 19990);
    assert.equal(persisted.planNameSnapshot, "Plano Original");
    await assert.rejects(
      service.getInvoice(invoice.id, otherCompany.id),
      (error) => error.code === "INVOICE_NOT_FOUND",
    );
  } finally {
    await prisma.infinitePayWebhookEvent.deleteMany({ where: { invoice: { subscription: { companyId: company.id } } } });
    await prisma.subscriptionInvoice.deleteMany({ where: { subscription: { companyId: company.id } } });
    await prisma.subscription.deleteMany({ where: { companyId: company.id } });
    await prisma.subscriptionPlanPrice.deleteMany({ where: { planId: plan.id } });
    await prisma.subscriptionPlan.delete({ where: { id: plan.id } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, otherCompany.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherOwner.id] } } });
  }
});
