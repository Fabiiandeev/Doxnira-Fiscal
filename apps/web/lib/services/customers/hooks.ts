"use client";

import { useQuery } from "@tanstack/react-query";

import { listClients } from "@/lib/services/customers/service";

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ["customers", search ?? ""],
    queryFn: () => listClients(search),
  });
}
