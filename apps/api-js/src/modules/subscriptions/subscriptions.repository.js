import { prisma } from "../../config/prisma.js";

export function createSubscriptionRepository(client = prisma) {
  return {
    transaction(callback) {
      return client.$transaction((transaction) => callback(createSubscriptionRepository(transaction)));
    },
    companyForUser(companyId, userId) {
      return client.company.findFirst({
        where: { id: companyId, ownerId: userId, status: { not: "deleted" } },
        select: { id: true, legalName: true },
      });
    },
    planWithCurrentPrice(planId, interval, at) {
      return client.subscriptionPlan.findFirst({
        where: { id: planId, status: "ACTIVE", availableForSale: true },
        include: {
          prices: {
            where: {
              interval,
              active: true,
              validFrom: { lte: at },
              OR: [{ validUntil: null }, { validUntil: { gt: at } }],
            },
            orderBy: { validFrom: "desc" },
            take: 1,
          },
        },
      });
    },
    subscriptionForCompany(companyId) {
      return client.subscription.findUnique({ where: { companyId } });
    },
    createSubscription(data) {
      return client.subscription.create({ data });
    },
    createInvoice(data) {
      return client.subscriptionInvoice.create({ data, include: { plan: true, planPrice: true } });
    },
    invoiceForCompany(invoiceId, companyId) {
      return client.subscriptionInvoice.findFirst({
        where: { id: invoiceId, subscription: { companyId } },
        include: { plan: true, planPrice: true, subscription: true },
      });
    },
    invoiceByOrder(orderNsu) {
      return client.subscriptionInvoice.findUnique({
        where: { orderNsu },
        include: { subscription: true },
      });
    },
    updateInvoice(id, data) {
      return client.subscriptionInvoice.update({ where: { id }, data });
    },
    activateSubscription(id, planId, planPriceId, periodStart, periodEnd) {
      return client.subscription.update({
        where: { id },
        data: { planId, planPriceId, status: "ACTIVE", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
      });
    },
    registerWebhook(data) {
      return client.infinitePayWebhookEvent.create({ data });
    },
    webhookByFingerprint(fingerprint) {
      return client.infinitePayWebhookEvent.findUnique({ where: { fingerprint } });
    },
    updateWebhook(id, data) {
      return client.infinitePayWebhookEvent.update({ where: { id }, data });
    },
  };
}

export const subscriptionRepository = createSubscriptionRepository();
