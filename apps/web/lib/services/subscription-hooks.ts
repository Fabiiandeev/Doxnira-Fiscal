"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionService, type BillingCycle } from "./subscription-service";
export const subscriptionQueryKeys = { all: ["subscription"] as const, catalog: ["subscription", "catalog"] as const, current: ["subscription", "current"] as const, usage: ["subscription", "usage"] as const, capabilities: ["subscription", "capabilities"] as const };
export function createSubscriptionIdempotencyKey(operation: string) { const uuid = globalThis.crypto?.randomUUID?.(); const fallback = `${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; return `subscription-ui:${operation}:${uuid ?? fallback}`.slice(0, 160); }
export function useSubscription(companyId?: string | null) { return useQuery({ queryKey: [...subscriptionQueryKeys.current, companyId], queryFn: subscriptionService.current, enabled: Boolean(companyId) }); }
export function useSubscriptionCatalog(companyId?: string | null) { return useQuery({ queryKey: [...subscriptionQueryKeys.catalog, companyId], queryFn: subscriptionService.catalog, enabled: Boolean(companyId) }); }
export function useSubscriptionUsage(companyId?: string | null) { return useQuery({ queryKey: [...subscriptionQueryKeys.usage, companyId], queryFn: subscriptionService.usage, enabled: Boolean(companyId) }); }
export function useSubscriptionActions() {
  const client = useQueryClient();
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: subscriptionQueryKeys.current }), client.invalidateQueries({ queryKey: subscriptionQueryKeys.usage }), client.invalidateQueries({ queryKey: subscriptionQueryKeys.capabilities })]); };
  return {
    change: useMutation({ mutationFn: (input: { targetPlanCode: string; targetBillingCycle: BillingCycle; reason?: string; idempotencyKey: string }) => { const { idempotencyKey, ...payload } = input; return subscriptionService.change(payload, idempotencyKey); }, onSuccess: refresh }),
    cancel: useMutation({ mutationFn: (input: { mode: "IMMEDIATE" | "PERIOD_END"; reason?: string; idempotencyKey: string }) => subscriptionService.cancel(input.mode, input.reason, input.idempotencyKey), onSuccess: refresh }),
    reactivate: useMutation({ mutationFn: (input: { idempotencyKey: string }) => subscriptionService.reactivate(input.idempotencyKey), onSuccess: refresh }),
  };
}
