"use client";

import { useQuery } from "@tanstack/react-query";

import { listProducts } from "@/lib/services/products/service";

export function useProducts(search?: string) {
  return useQuery({
    queryKey: ["products", search ?? ""],
    queryFn: () => listProducts(search),
  });
}
