import { z } from "zod";

export const createInvoiceSchema = z.object({
  planId: z.string().uuid(),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
}).strict();

export const invoiceIdSchema = z.object({ invoiceId: z.string().uuid() });
export const companyIdSchema = z.string().uuid();

export const checkPaymentSchema = z.object({
  transactionNsu: z.string().trim().min(1).max(160).optional(),
  invoiceSlug: z.string().trim().min(1).max(160).optional(),
  receiptUrl: z.string().url().optional(),
}).strict();

export const webhookSchema = z.object({
  invoice_slug: z.string().trim().min(1).max(160),
  amount: z.coerce.number().int().positive(),
  paid_amount: z.coerce.number().int().nonnegative(),
  installments: z.coerce.number().int().positive(),
  capture_method: z.string().trim().min(1).max(40),
  transaction_nsu: z.string().trim().min(1).max(160),
  order_nsu: z.string().trim().min(1).max(160),
  receipt_url: z.string().url().optional(),
  items: z.array(z.unknown()).optional(),
}).passthrough();

export const parse = (schema, value) => schema.parse(value);
