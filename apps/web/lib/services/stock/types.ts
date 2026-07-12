export type StockItem = {
  id: string;
  productId: string;
  productName: string;
  currentQuantity: number;
  reservedQuantity: number;
  minimumQuantity: number | null;
  status: "ok" | "low" | "critical" | "negative";
};

export type StockMovement = {
  id: string;
  productId: string;
  quantity: number;
  direction: "in" | "out" | "reserved" | "released";
  source: "xml" | "order" | "manual" | "marketplace";
  createdAt: string;
};
