export type IntelligenceFilters = { from?: string; to?: string };

export type FiscalIntelligence = {
  period: { from: string; to: string };
  metrics: Record<string, number>;
  certificate: { id: string; validUntil: string; subject: string | null } | null;
  closing: { id: string; status: string; periodYear: number; periodMonth: number } | null;
  risk: number;
  ranking: Array<{ name: string; value: number }>;
  documents: Array<{
    id: string; documentType: string; operationDirection: string; status: string | null;
    invoiceNumber: string | null; issuerName: string | null; totalAmount: number; emissionDate: string | null;
  }>;
};

export type CommerceIntelligence = {
  period: { from: string; to: string };
  metrics: Record<string, number>;
  syncFailures: number;
  orders: Array<{ id: string; providerOrderId: string; status: string; totalAmount: number; orderedAt: string }>;
  listings: Array<{ id: string; title: string | null; sku: string | null; status: string; price: number }>;
};

export type Insight = {
  key: string; type: string; severity: "critical" | "warning"; title: string;
  count: number; href: string; status: string; assignee: string | null; justification: string | null;
  priority?: string; evidence?: string; timeline?: Array<{ action: string; at: string; justification: string | null }>;
};

export type Benchmark = {
  company: { id: string; tradeName: string | null; legalName: string } | null;
  sufficientData: boolean;
  metrics: Record<string, { current: number; previous: number; variation: number | null }>;
};
