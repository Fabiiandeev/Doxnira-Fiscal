import { apiFetch } from "@/lib/api";

export type PlanInterval = "MONTHLY" | "YEARLY";
export type PlanPrice = { id: string; interval: PlanInterval; amountCents: number; currency: string; formatted?: string; validFrom: string; validUntil?: string | null; applicationPolicy?: string };
export type PlanFeature = { code: string; label: string; description?: string | null; valueType: "BOOLEAN" | "INTEGER" | "TEXT" | "UNLIMITED"; value?: string | null; visible: boolean; sortOrder: number; included?: boolean };
export type PlatformPlan = {
  id: string; code: string; slug: string; name: string; title?: string | null; shortDescription?: string | null; description?: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED"; publicVisible: boolean; availableForSale: boolean; featured: boolean;
  sortOrder: number; trialDays: number; checkoutDescription?: string | null; buttonLabel: string; badgeLabel?: string | null;
  prices: { monthly?: PlanPrice; yearly?: PlanPrice }; priceHistory: PlanPrice[]; features: PlanFeature[]; subscribers: number;
};
export type PlanInput = Pick<PlatformPlan, "slug" | "name" | "sortOrder" | "trialDays" | "featured" | "publicVisible" | "availableForSale" | "buttonLabel"> & {
  code?: string; title?: string | null; shortDescription?: string | null; description?: string | null; checkoutDescription?: string | null; badgeLabel?: string | null;
};

const base = "/platform/plans";
export type PlanAction = "publish" | "unpublish" | "activate-sales" | "deactivate-sales" | "archive";
export const platformPlansService = {
  list: () => apiFetch<{ plans: PlatformPlan[] }>(base),
  get: (id: string) => apiFetch<PlatformPlan>(`${base}/${id}`),
  create: (input: PlanInput & { code: string }) => apiFetch<PlatformPlan>(base, { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Partial<PlanInput>) => apiFetch<PlatformPlan>(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  action: (id: string, action: PlanAction) => apiFetch<PlatformPlan>(`${base}/${id}/${action}`, { method: "POST" }),
  price: (id: string, input: { interval: PlanInterval; amountCents: number; currency: string; validFrom: string; applicationPolicy: string }) =>
    apiFetch<PlanPrice>(`${base}/${id}/prices`, { method: "POST", body: JSON.stringify(input) }),
  features: (id: string, features: PlanFeature[]) => apiFetch<PlatformPlan>(`${base}/${id}/features`, { method: "PUT", body: JSON.stringify({ features }) }),
};
