"use client";

import { useMemo, useState } from "react";

export function usePagination(initialPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  return useMemo(
    () => ({
      page,
      pageSize,
      setPage,
      setPageSize: (nextPageSize: number) => {
        setPage(1);
        setPageSize(nextPageSize);
      },
      resetPagination: () => setPage(1),
    }),
    [page, pageSize],
  );
}
