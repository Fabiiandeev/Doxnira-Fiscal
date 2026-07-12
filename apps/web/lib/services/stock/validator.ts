import { createValidationResult } from "@/lib/services/service-architecture";
import type { StockItem } from "@/lib/services/stock/types";

export function validateStockItemDraft(stockItem: Partial<StockItem>) {
  void stockItem;
  return createValidationResult();
}
