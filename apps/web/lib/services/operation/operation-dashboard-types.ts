export type DashboardData = {
  period: { from: string; to: string };
  indicators: Record<string, number>;
  movementSeries: Array<{ date: string; entries: number; exits: number }>;
  purchasesByStatus: Array<{ status: string; count: number }>;
  salesByStatus: Array<{ status: string; count: number }>;
  criticalProducts: Array<Record<string, unknown>>;
  latestMovements: Array<Record<string, unknown>>;
  recentPurchases: Array<Record<string, unknown>>;
  recentSales: Array<Record<string, unknown>>;
  failedAutomations: Array<Record<string, unknown>>;
};
