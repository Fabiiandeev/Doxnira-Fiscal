import { AppError } from "../../utils/app-error.js";
import { planRepository } from "./plans.repository.js";

const notFound = () => new AppError("Plano não encontrado.", "PLAN_NOT_FOUND", 404);
const money = (amountCents, currency = "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amountCents / 100);

export function currentPrices(plan, at = new Date()) {
  const valid = plan.prices.filter((price) => price.active && price.validFrom <= at && (!price.validUntil || price.validUntil > at));
  return Object.fromEntries(valid.map((price) => [price.interval.toLowerCase(), {
    id: price.id, amountCents: price.amountCents, currency: price.currency,
    formatted: money(price.amountCents, price.currency), validFrom: price.validFrom,
  }]));
}

export function serializePlan(plan) {
  return {
    ...plan,
    prices: currentPrices(plan),
    priceHistory: plan.prices,
    features: plan.features.map((feature) => ({
      ...feature,
      included: feature.valueType === "UNLIMITED" || feature.valueType !== "BOOLEAN" || feature.value === "true",
    })),
    subscribers: plan._count?.subscriptions ?? 0,
    _count: undefined,
  };
}

export const plansService = {
  async publicCatalog() {
    const plans = await planRepository.list({ status: "ACTIVE", publicVisible: true, availableForSale: true });
    return plans.map(serializePlan);
  },
  async subscriptionCatalog() {
    const plans = await planRepository.list({ status: "ACTIVE", availableForSale: true });
    return plans.map(serializePlan);
  },
  async listPlatform() {
    return (await planRepository.list()).map(serializePlan);
  },
  async get(id) {
    const plan = await planRepository.find(id);
    if (!plan) throw notFound();
    return serializePlan(plan);
  },
  async create(input, actorId) {
    if (await planRepository.findByCodeOrSlug(input.code, input.slug)) throw new AppError("Código ou slug já cadastrado.", "PLAN_ALREADY_EXISTS", 409);
    return serializePlan(await planRepository.create({ ...input, createdById: actorId, updatedById: actorId }));
  },
  async update(id, input, actorId) {
    if (!await planRepository.find(id)) throw notFound();
    return serializePlan(await planRepository.update(id, { ...input, updatedById: actorId }));
  },
  async createPrice(id, input, actorId) {
    const plan = await planRepository.find(id);
    if (!plan) throw notFound();
    const oldPrice = await planRepository.currentPrice(id, input.interval, input.validFrom);
    const price = await planRepository.transaction(async (repository) => {
      await repository.closePrices(id, input.interval, input.validFrom);
      return repository.createPrice({ planId: id, createdById: actorId, ...input });
    });
    return { price, oldAmountCents: oldPrice?.amountCents ?? null };
  },
  async replaceFeatures(id, features) {
    if (!await planRepository.find(id)) throw notFound();
    return serializePlan(await planRepository.replaceFeatures(id, features));
  },
  async transition(id, action, actorId) {
    const plan = await planRepository.find(id);
    if (!plan) throw notFound();
    const transitions = {
      publish: { status: "ACTIVE", publicVisible: true },
      unpublish: { publicVisible: false },
      "activate-sales": { availableForSale: true },
      "deactivate-sales": { availableForSale: false },
      archive: { status: "ARCHIVED", publicVisible: false, availableForSale: false, archivedAt: new Date() },
    };
    return serializePlan(await planRepository.update(id, { ...transitions[action], updatedById: actorId }));
  },
};
