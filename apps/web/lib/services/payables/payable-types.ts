export type Money = string;

export type PayableStatus = "PENDING" | "OVERDUE" | "PARTIALLY_PAID" | "PAID" | "CANCELED";
export type PayableEvent = { id: string; action: string; createdAt: string; userId?: string | null; beforeState?: Record<string, unknown> | null; afterState?: Record<string, unknown> | null; metadata?: Record<string, unknown> | null; justification?: string | null; correlationId?: string | null };
export type Payable = {
  id: string; description?: string | null; supplierId?: string | null; supplierName?: string | null; supplierCnpj?: string | null;
  installmentNumber: string; totalInstallments: number; issueDate?: string | null; dueDate: string; amount: Money; paidAmount: Money; balance: Money;
  status: PayableStatus; categoryId?: string | null; costCenterId?: string | null; financialAccountId?: string | null; paymentMethod?: string | null;
  source: string; sourceType?: string | null; sourceId?: string | null; externalKey?: string | null; notes?: string | null;
  paidAt?: string | null; canceledAt?: string | null; cancellationReason?: string | null; createdAt: string; updatedAt: string;
  history?: PayableEvent[]; allocations?: Array<Record<string, unknown>>; attachments?: Array<Record<string, unknown>>;
};
export type PayableFilters = { q?: string; status?: string; source?: string; page: number; pageSize: number };
export type PayableInput = { description: string; supplierId?: string | null; supplierName?: string | null; issueDate?: string | null; dueDate: string; amount: string; categoryId?: string | null; costCenterId?: string | null; financialAccountId?: string | null; notes?: string | null; paymentMethod?: string | null };
export type FinancialOption = { id: string; name: string; code?: string; active?: boolean };

