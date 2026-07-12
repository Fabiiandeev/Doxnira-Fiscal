import { mapIdentity } from "@/lib/services/service-architecture";
import type { StockItem, StockMovement } from "@/lib/services/stock/types";

export const mapStockItem = mapIdentity<StockItem>;
export const mapStockMovement = mapIdentity<StockMovement>;
