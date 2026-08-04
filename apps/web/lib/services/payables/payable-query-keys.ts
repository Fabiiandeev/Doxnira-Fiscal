import type { PayableFilters } from "./payable-types";
export const payableKeys = {
  all: (companyId: string) => ["payables", companyId] as const,
  list: (companyId: string, filters: PayableFilters) => ["payables", companyId, "list", filters] as const,
  detail: (companyId: string, payableId: string) => ["payables", companyId, "detail", payableId] as const,
  timeline: (companyId: string, payableId: string) => ["payables", companyId, "timeline", payableId] as const,
  options: (companyId: string) => ["payables", companyId, "options"] as const,
};

