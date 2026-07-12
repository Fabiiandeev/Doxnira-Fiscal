"use client";

import { useQuery } from "@tanstack/react-query";

import { listCompanies } from "@/lib/services/companies/service";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });
}
