import { prisma } from "../../config/prisma.js";
import {
  SubscriptionConfigurationError,
  SubscriptionInvalidStateError,
  SubscriptionNotFoundError,
} from "./subscription.errors.js";
import { resolvePlanFeatureMap } from "./subscription-plan.service.js";
import { USABLE_SUBSCRIPTION_STATUSES } from "./subscription.constants.js";
import { reconcileSubscription } from "./subscription-reconciliation.service.js";

const includePlans = {
  currentPlan: true,
  currentPrice: true,
  nextPlan: true,
  nextPrice: true,
};

export async function getSubscriptionContext({
  companyId,
  actorId = null,
  requestId = null,
  at = new Date(),
  requireActive = false,
  reconcile = true,
  db = prisma,
}) {
  if (reconcile) {
    await reconcileSubscription({ companyId, actorId, requestId, now: at, db });
  }

  let rows = await db.subscription.findMany({
    where: {
      companyId,
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED"] },
    },
    include: includePlans,
  });

  // A tela precisa continuar exibindo o encerramento real após cancelamento ou
  // expiração. Gates com requireActive ainda rejeitam esses estados abaixo.
  if (!rows.length) {
    const terminal = await db.subscription.findFirst({
      where: { companyId, status: { in: ["CANCELED", "EXPIRED"] } },
      include: includePlans,
      orderBy: { updatedAt: "desc" },
    });
    if (terminal) rows = [terminal];
  }

  if (!rows.length) throw new SubscriptionNotFoundError({ companyId });
  if (rows.length !== 1) {
    throw new SubscriptionConfigurationError({
      companyId,
      reason: "multiple_current_subscriptions",
    });
  }

  const subscription = rows[0];
  if (requireActive && !USABLE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    throw new SubscriptionInvalidStateError({ status: subscription.status });
  }

  const features = await resolvePlanFeatureMap({ planId: subscription.planId, db });
  const limits = Object.fromEntries(
    Object.entries(features).filter(
      ([code]) => code.endsWith(".limit") || code === "xml.retention.months",
    ),
  );
  const usageRows = await db.subscriptionUsageCounter.findMany({
    where: {
      subscriptionId: subscription.id,
      companyId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    },
  });
  const usage = Object.fromEntries(
    usageRows.map((item) => [item.usageCode, item.quantity]),
  );
  const usable = USABLE_SUBSCRIPTION_STATUSES.has(subscription.status);

  return {
    subscription: {
      id: subscription.id,
      status: subscription.status,
      provider: subscription.provider,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      endedAt: subscription.endedAt,
      nextPlanEffectiveAt: subscription.nextPlanEffectiveAt,
    },
    plan: {
      id: subscription.currentPlan.id,
      code: subscription.currentPlan.code,
      name: subscription.currentPlan.name,
      displayOrder: subscription.currentPlan.displayOrder,
    },
    price: {
      billingCycle: subscription.currentPrice.billingCycle,
      amountCents: subscription.currentPrice.amountCents,
      currency: subscription.currentPrice.currency,
    },
    nextPlan:
      subscription.nextPlan && subscription.nextPrice
        ? {
            id: subscription.nextPlan.id,
            code: subscription.nextPlan.code,
            name: subscription.nextPlan.name,
            billingCycle: subscription.nextPrice.billingCycle,
            amountCents: subscription.nextPrice.amountCents,
            effectiveAt: subscription.nextPlanEffectiveAt,
          }
        : null,
    entitlements: features,
    features,
    limits,
    usage,
    capabilities: {
      canUpgrade: usable,
      canDowngrade: usable,
      canChangeCycle: usable,
      canCancel: usable,
      canReactivate: usable && subscription.cancelAtPeriodEnd,
    },
  };
}
