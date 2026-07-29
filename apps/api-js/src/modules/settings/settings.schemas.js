import { z } from "zod";
export const settingsListSchema = z.object({
  search: z.string().max(120).optional(), module: z.string().max(60).optional(),
  action: z.string().max(120).optional(), userId: z.string().uuid().optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const companySettingsSchema = z.object({
  legalName: z.string().min(3).max(255).optional(), tradeName: z.string().max(255).nullable().optional(),
  stateRegistration: z.string().max(40).nullable().optional(), uf: z.string().length(2).transform((v) => v.toUpperCase()).optional(),
  city: z.string().max(120).nullable().optional(), environment: z.enum(["production", "homologation"]).optional(),
  status: z.enum(["active", "inactive"]).optional(), taxRegime: z.string().max(60).optional(),
  confirmCriticalChange: z.literal(true).optional(),
}).strict();
export const integrationActionSchema = z.object({ action: z.enum(["test", "activate", "deactivate", "disconnect"]) });
