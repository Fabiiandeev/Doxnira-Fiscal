import type { Product } from "@/lib/product-types";

export type NfeEntrySummary = {
  total: number;
  pendingManifestation: number;
  pendingEntry: number;
  confirmed: number;
  divergence: number;
  cancelled: number;
};

export type NfeEntryItem = {
  id: string;
  itemNumber: number;
  supplierProductCode: string | null;
  ean: string | null;
  description: string | null;
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
  csosn: string | null;
  unit: string | null;
  quantity: number;
  unitValue: number;
  totalValue: number;
  linkStatus: string;
  linkConfidence: number | null;
  stockIgnored: boolean;
  productId: string | null;
  product?: Pick<Product, "id" | "code" | "name" | "ncm" | "unit" | "stock"> | null;
};

export type NfeEntryAlert = {
  id: string;
  type: string;
  severity: "error" | "warning" | "info" | string;
  title: string;
  message: string;
  recommendation: string | null;
  status: string;
  createdAt: string;
};

export type NfeEntryEvent = {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type NfeEntryManifestation = {
  id: string;
  eventType: string;
  protocol: string | null;
  status: string;
  justification: string | null;
  source: string;
  createdAt: string;
};

export type NfeEntryPayable = {
  id: string;
  installmentNumber: string;
  dueDate: string;
  amount: number;
  paymentMethod: string | null;
  status: string;
};

export type NfeEntryCteLink = {
  id: string;
  nfeAccessKey: string;
  freightShare: number;
  cteEntry?: {
    id: string;
    accessKey: string;
    number: string | null;
    series: string | null;
    carrierName: string | null;
    carrierCnpj: string | null;
    freightAmount: number;
    status: string | null;
  } | null;
};

export type NfeEntry = {
  id: string;
  status: string;
  source: string;
  entryStatus: string;
  manifestationStatus: string;
  stockStatus: string;
  financialStatus: string;
  cteStatus: string;
  sefazStatus: string | null;
  accessKey: string;
  nsu: string | null;
  number: string | null;
  series: string | null;
  issueDate: string | null;
  authorizationDate: string | null;
  supplierName: string | null;
  supplierCnpj: string | null;
  recipientCnpj: string | null;
  totalAmount: number;
  productsAmount: number;
  freightAmount: number;
  discountAmount: number;
  protocol: string | null;
  riskScore: number;
  recommendation: string;
  validationSummary?: {
    alerts?: number;
    errors?: number;
    warnings?: number;
    pendingItems?: number;
    analyzedAt?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  items?: NfeEntryItem[];
  alerts?: NfeEntryAlert[];
  events?: NfeEntryEvent[];
  manifestations?: NfeEntryManifestation[];
  payables?: NfeEntryPayable[];
  cteLinks?: NfeEntryCteLink[];
  _count?: {
    items: number;
    alerts: number;
    cteLinks: number;
    payables: number;
  };
};

export type NfeEntryFilters = {
  q: string;
  startDate: string;
  endDate: string;
  supplier: string;
  accessKey: string;
  number: string;
  series: string;
  status: string;
  manifestation: string;
  stock: string;
  minAmount: string;
  maxAmount: string;
};

export type NfeEntryListResponse = {
  data: NfeEntry[];
  summary: NfeEntrySummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
