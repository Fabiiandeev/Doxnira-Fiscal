import { apiFetch } from "@/lib/api";

export type SubscriptionInvoice = {
  id: string;
  planId: string;
  planPriceId: string;
  planNameSnapshot: string;
  descriptionSnapshot: string | null;
  amountCents: number;
  currency: string;
  orderNsu: string;
  checkoutUrl: string | null;
  invoiceSlug: string | null;
  transactionNsu: string | null;
  receiptUrl: string | null;
  captureMethod: string | null;
  paidAmountCents: number | null;
  status: "PENDING" | "OPEN" | "PAID" | "FAILED" | "CANCELED" | "EXPIRED";
  dueAt: string;
  paidAt: string | null;
};

const invoiceScope = "/subscription/invoices";

export const subscriptionPaymentService = {
  createInvoice: (planId: string, billingInterval: "MONTHLY" | "YEARLY") =>
    apiFetch<SubscriptionInvoice>(invoiceScope, {
      method: "POST",
      body: JSON.stringify({ planId, billingInterval }),
    }),
  createCheckout: (invoiceId: string) =>
    apiFetch<SubscriptionInvoice>(`${invoiceScope}/${invoiceId}/checkout`, { method: "POST" }),
  getInvoice: (invoiceId: string) =>
    apiFetch<SubscriptionInvoice>(`${invoiceScope}/${invoiceId}`),
  checkPayment: (invoiceId: string, input: { transactionNsu?: string; invoiceSlug?: string; receiptUrl?: string }) =>
    apiFetch<SubscriptionInvoice>(`${invoiceScope}/${invoiceId}/check`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
