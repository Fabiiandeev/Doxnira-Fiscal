import { ApiError, apiFetch } from "@/lib/api";

export type BillingCycle = "MONTHLY" | "ANNUAL";
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "CANCELED" | "EXPIRED" | "PAST_DUE" | "SUSPENDED";
export type PlanPrice = { id: string; billingCycle: BillingCycle; amountCents: number; currency: string; discountPercentage: number | null };
export type SubscriptionPlan = { id: string; code: string; name: string; description: string | null; displayOrder: number; features: Record<string, boolean | number | string | null>; prices: PlanPrice[] };
export type SubscriptionContext = {
  subscription: null | { id: string; status: SubscriptionStatus; provider: string; billingCycle: BillingCycle; currentPeriodStart: string; currentPeriodEnd: string; trialEndsAt: string | null; cancelAtPeriodEnd: boolean; canceledAt: string | null; endedAt: string | null; nextPlanEffectiveAt: string | null };
  plan: null | { id: string; code: string; name: string; displayOrder: number };
  price: null | { billingCycle: BillingCycle; amountCents: number; currency: string };
  nextPlan: null | { id: string; code: string; name: string; billingCycle: BillingCycle; amountCents: number; effectiveAt: string };
  entitlements: Record<string, boolean | number | string | null>;
  usage: Record<string, number>;
  capabilities: { canUpgrade: boolean; canDowngrade: boolean; canChangeCycle: boolean; canCancel: boolean; canReactivate: boolean };
};
export type UsageItem = { featureCode: string; featureName: string; limit: number | null; used: number; remaining: number | null; unlimited: boolean; periodStart: string; periodEnd: string };
export type ChangeSubscriptionInput = { targetPlanCode: string; targetBillingCycle: BillingCycle; reason?: string };
export type SubscriptionOperationResponse = { result?: "APPLIED_NOW" | "SCHEDULED" | "IDEMPOTENT_REPLAY"; operation?: { type?: string; idempotentReplay?: boolean }; subscription?: unknown };

const scope = "/subscription";

export function unwrapSubscriptionResponse<T>(payload: T | { data: T }): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function request<T>(endpoint: string, init?: RequestInit) {
  try {
    const payload = await apiFetch<T | { data: T }>(`${scope}/${endpoint}`, init);
    return unwrapSubscriptionResponse(payload);
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof ApiError) {
      console.error(`[subscription/${endpoint}]`, {
        status: error.status,
        code: error.code,
        message: error.message,
        requestId: error.requestId ?? null,
      });
    }
    throw error;
  }
}

export const subscriptionService = {
  catalog: () => request<{ plans: SubscriptionPlan[] }>("catalog"),
  current: () => request<SubscriptionContext>("current"),
  usage: () => request<{ items: UsageItem[] }>("usage"),
  change: (input: ChangeSubscriptionInput, idempotencyKey: string) => request<SubscriptionOperationResponse>("change", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input) }),
  cancel: (mode: "IMMEDIATE" | "PERIOD_END", reason: string | undefined, idempotencyKey: string) => request<SubscriptionOperationResponse>("cancel", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ mode, reason }) }),
  reactivate: (idempotencyKey: string) => request<SubscriptionOperationResponse>("reactivate", { method: "POST", headers: { "Idempotency-Key": idempotencyKey } }),
};
