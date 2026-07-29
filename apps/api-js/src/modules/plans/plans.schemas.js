import { z } from "zod";

export const planIdSchema = z.object({ planId: z.string().uuid() });
export const createPlanSchema = z.object({
  code: z.string().trim().min(2).max(60).regex(/^[A-Z0-9_]+$/),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(160),
  title: z.string().trim().max(200).nullable().optional(),
  shortDescription: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  trialDays: z.number().int().min(0).max(365).default(0),
  featured: z.boolean().default(false),
  publicVisible: z.boolean().default(false),
  availableForSale: z.boolean().default(false),
  checkoutDescription: z.string().trim().max(500).nullable().optional(),
  buttonLabel: z.string().trim().min(1).max(100).default("Começar agora"),
  badgeLabel: z.string().trim().max(100).nullable().optional(),
});
export const updatePlanSchema = createPlanSchema.partial().omit({ code: true });
export const createPriceSchema = z.object({
  interval: z.enum(["MONTHLY", "YEARLY"]),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("BRL"),
  amountCents: z.number().int().min(0).max(1_000_000_000),
  validFrom: z.coerce.date(),
  applicationPolicy: z.enum(["NEW_CUSTOMERS_ONLY", "ALL_NEXT_RENEWAL", "SELECTED_CUSTOMERS", "SCHEDULED"]),
});
export const updateFeaturesSchema = z.object({
  features: z.array(z.object({
    code: z.string().trim().min(2).max(80).regex(/^[A-Z0-9_]+$/),
    label: z.string().trim().min(1).max(180),
    description: z.string().trim().max(400).nullable().optional(),
    valueType: z.enum(["BOOLEAN", "INTEGER", "TEXT", "UNLIMITED"]),
    value: z.string().max(300).nullable().optional(),
    visible: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })).max(100),
});

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error("Dados do plano inválidos.");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    error.details = result.error.issues;
    throw error;
  }
  return result.data;
}
