"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { platformPlansService } from "./platform-plans-service";
import type { PlanAction, PlanFeature, PlanInput, PlanInterval } from "./platform-plans-service";

type PlanMutationInput =
  | { kind: "create"; data: PlanInput & { code: string } }
  | { kind: "update"; id: string; data: Partial<PlanInput> }
  | { kind: "action"; id: string; action: PlanAction }
  | { kind: "price"; id: string; data: { interval: PlanInterval; amountCents: number; currency: string; validFrom: string; applicationPolicy: string } }
  | { kind: "features"; id: string; data: PlanFeature[] };

export const usePlatformPlans = () =>
  useQuery({ queryKey: ["platform-plans"], queryFn: platformPlansService.list });

export const usePlatformPlan = (id?: string) =>
  useQuery({
    queryKey: ["platform-plans", id],
    queryFn: () => platformPlansService.get(id || ""),
    enabled: Boolean(id),
  });

export function usePlatformPlanMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanMutationInput) => {
      if (input.kind === "create") return platformPlansService.create(input.data);
      if (input.kind === "update") return platformPlansService.update(input.id, input.data);
      if (input.kind === "action") return platformPlansService.action(input.id, input.action);
      if (input.kind === "price") return platformPlansService.price(input.id, input.data);
      return platformPlansService.features(input.id, input.data);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["platform-plans"] }),
        client.invalidateQueries({ queryKey: ["marketing", "plans"] }),
        client.invalidateQueries({ queryKey: ["subscription-plans"] }),
      ]);
    },
  });
}
