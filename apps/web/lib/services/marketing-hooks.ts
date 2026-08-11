"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { marketingService, type LeadInput, type ContactInput } from "@/lib/services/marketing-service";

const STALE_PLANS = 1000 * 60 * 10;
const STALE_FEATURES = 1000 * 60 * 30;

export function useMarketingPlans() {
  return useQuery({
    queryKey: ["marketing", "plans"],
    queryFn: () => marketingService.plans(),
    staleTime: STALE_PLANS,
    retry: 1,
  });
}
export const useMarketingPlansQuery = useMarketingPlans;

export function useMarketingFeatures() {
  return useQuery({
    queryKey: ["marketing", "features"],
    queryFn: () => marketingService.features(),
    staleTime: STALE_FEATURES,
    retry: 1,
  });
}

export function useSubmitLead() {
  return useMutation({
    mutationFn: (input: LeadInput) => marketingService.submitLead(input),
  });
}

export function useSubmitContact() {
  return useMutation({
    mutationFn: (input: ContactInput) => marketingService.submitContact(input),
  });
}
