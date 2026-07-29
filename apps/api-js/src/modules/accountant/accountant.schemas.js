import { z } from "zod";

export const officeParamsSchema = z.object({ officeId: z.string().uuid() });
export const listSchema = z.object({
  companyId: z.string().uuid().optional(), status: z.string().max(40).optional(),
  severity: z.string().max(20).optional(), responsibleId: z.string().uuid().optional(),
  competence: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  search: z.string().max(120).optional(), page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const queueCreateSchema = z.object({
  companyId: z.string().uuid(), type: z.string().min(2).max(60), origin: z.string().min(2).max(60),
  title: z.string().min(3).max(255), description: z.string().max(4000).optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).default("NORMAL"),
  relatedEntityType: z.string().max(60).optional(), relatedEntityId: z.string().uuid().optional(),
  competence: z.string().regex(/^\d{4}-\d{2}$/).optional(), evidence: z.record(z.string(), z.unknown()).optional(),
});
export const queueActionSchema = z.object({
  responsibleUserId: z.string().uuid().optional(),
  priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).optional(),
  reason: z.string().trim().min(3).max(4000).optional(),
});
