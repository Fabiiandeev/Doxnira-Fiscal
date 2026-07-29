"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { intelligenceService } from "./service";
import type { IntelligenceFilters } from "./types";

export function useIntelligence(kind: "fiscal" | "commerce" | "insights" | "decisions" | "benchmark", filters: IntelligenceFilters) {
  return useQuery<unknown, Error>({
    queryKey: ["intelligence", kind, filters],
    queryFn: async () => intelligenceService[kind](filters) as Promise<unknown>,
  });
}

export function useIntelligenceAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: "insights" | "decisions"; key: string; action: string; justification?: string; assignee?: string }) =>
      intelligenceService.action(input.kind, input.key, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["intelligence"] }),
  });
}
