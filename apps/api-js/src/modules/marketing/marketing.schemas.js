import { z } from "zod";

const text = (max) => z.string().trim().max(max);
const optionalText = (max) => text(max).optional().transform((value) => value || undefined);
const interest = z.enum(["PLAN_INFO", "DEMO", "INTEGRATION", "COMMERCE", "PORTAL_CONTABIL", "SUPPORT", "OTHER"]);
const planCode = z.enum(["STARTER", "PROFESSIONAL", "BUSINESS", "COMPANY"]);

export const leadSchema = z.object({
  name: text(100).min(2), email: z.string().trim().toLowerCase().email().max(150),
  phone: z.string().trim().regex(/^\+?[0-9\s()\-]{7,20}$/), companyName: text(150).min(2),
  document: z.string().trim().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/).optional(),
  interest, planCode: planCode.optional(), message: optionalText(1000), source: optionalText(200),
  consent: z.literal(true), website: z.string().max(0).optional().default(""),
}).strict();

export const contactSchema = z.object({
  subject: text(200).min(3), message: text(2000).min(10), companyName: text(150).min(2),
  contact: z.string().trim().toLowerCase().email().max(150), planCode: planCode.optional(),
  source: optionalText(200), consent: z.literal(true), website: z.string().max(0).optional().default(""),
}).strict();
