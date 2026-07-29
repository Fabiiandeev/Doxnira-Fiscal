import { prisma } from "../../config/prisma.js";

export const planInclude = {
  prices: { orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }] },
  features: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
  _count: { select: { subscriptions: true } },
};

export function createPlanRepository(client = prisma) {
  return {
    list(where = {}) {
      return client.subscriptionPlan.findMany({ where, include: planInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    },
    find(id) {
      return client.subscriptionPlan.findUnique({ where: { id }, include: planInclude });
    },
    findByCodeOrSlug(code, slug) {
      return client.subscriptionPlan.findFirst({ where: { OR: [{ code }, { slug }] }, select: { id: true } });
    },
    create(data) {
      return client.subscriptionPlan.create({ data, include: planInclude });
    },
    update(id, data) {
      return client.subscriptionPlan.update({ where: { id }, data, include: planInclude });
    },
    transaction(callback) {
      return client.$transaction((transaction) => callback(createPlanRepository(transaction)));
    },
    currentPrice(planId, interval, at) {
      return client.subscriptionPlanPrice.findFirst({
        where: { planId, interval, active: true, validFrom: { lte: at }, OR: [{ validUntil: null }, { validUntil: { gt: at } }] },
        orderBy: { validFrom: "desc" },
      });
    },
    closePrices(planId, interval, validUntil) {
      return client.subscriptionPlanPrice.updateMany({
        where: { planId, interval, active: true, validFrom: { lt: validUntil }, OR: [{ validUntil: null }, { validUntil: { gt: validUntil } }] },
        data: { active: false, validUntil },
      });
    },
    createPrice(data) {
      return client.subscriptionPlanPrice.create({ data });
    },
    replaceFeatures(planId, features) {
      return client.$transaction(async (transaction) => {
        await transaction.subscriptionPlanFeature.deleteMany({ where: { planId } });
        if (features.length) await transaction.subscriptionPlanFeature.createMany({ data: features.map((feature) => ({ ...feature, planId })) });
        return transaction.subscriptionPlan.findUnique({ where: { id: planId }, include: planInclude });
      });
    },
  };
}

export const planRepository = createPlanRepository();
