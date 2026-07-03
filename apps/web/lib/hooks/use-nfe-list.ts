"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { NfeFilters } from "@/lib/nfe-types";
import {
  createNfeDraft,
  deleteNfeDraft,
  listNfe,
} from "@/lib/services/nfe-service";

export const initialNfeFilters: NfeFilters = {
  search: "",
  status: "",
  startDate: "",
  endDate: "",
  environment: "",
  customer: "",
  number: "",
  series: "",
  accessKey: "",
  value: "",
  uf: "",
  operationType: "",
};

export function useNfeFilters() {
  const [filters, setFilters] = useState<NfeFilters>(initialNfeFilters);
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "search" && Boolean(value),
  ).length;

  return {
    filters,
    setFilters,
    activeFilterCount,
    resetFilters: () => setFilters(initialNfeFilters),
  };
}

export function useNfeList(input: {
  page: number;
  limit: number;
  filters: NfeFilters;
  sortBy: string;
  sortOrder: "asc" | "desc";
}) {
  const debouncedFilters = useDebouncedValue(input.filters, 350);
  return useQuery({
    queryKey: ["nfe-list", input.page, input.limit, debouncedFilters, input.sortBy, input.sortOrder],
    queryFn: () =>
      listNfe({
        page: input.page,
        limit: input.limit,
        filters: debouncedFilters,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateNfeDraft() {
  return useMutation({ mutationFn: createNfeDraft });
}

export function useDeleteNfeDraft() {
  return useMutation({ mutationFn: deleteNfeDraft });
}
