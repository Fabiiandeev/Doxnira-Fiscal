export function getPagination(query, defaultPageSize = 25) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const requestedPageSize =
    Number.parseInt(query.pageSize || String(defaultPageSize), 10) || defaultPageSize;
  const pageSize = Math.min(100, Math.max(1, requestedPageSize));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginationMeta(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
