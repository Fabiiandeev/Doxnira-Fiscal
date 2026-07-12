"use client";

import { useCallback, useMemo, useState } from "react";

export type FilterState = Record<string, string | number | boolean | null | undefined>;

export function useFilters<TFilters extends FilterState>(initialFilters: TFilters) {
  const [filters, setFilters] = useState<TFilters>(initialFilters);

  const updateFilter = useCallback(
    <TKey extends keyof TFilters>(key: TKey, value: TFilters[TKey]) => {
      setFilters((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => setFilters(initialFilters), [initialFilters]);

  return useMemo(
    () => ({
      filters,
      setFilters,
      updateFilter,
      resetFilters,
    }),
    [filters, resetFilters, updateFilter],
  );
}
