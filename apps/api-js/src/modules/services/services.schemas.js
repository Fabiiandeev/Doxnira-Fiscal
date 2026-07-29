import { z } from "zod";
const rate = z.coerce.number().min(0).max(100);
export const serviceSchema = z.object({
  code: z.string().trim().min(1).max(80),
  description: z.string().trim().min(3).max(255),
  municipalCode: z.string().trim().min(1).max(40),
  nationalCode: z.string().trim().min(1).max(40),
  serviceListItem: z.string().trim().max(40).optional().nullable(),
  municipality: z.string().trim().min(2).max(120),
  municipalityIbgeCode: z.string().regex(/^\d{7}$/, "Código IBGE deve possuir 7 dígitos."),
  cnae: z.string().regex(/^\d{7}$/).optional().nullable(),
  issRate: rate, issWithheld: z.boolean().default(false),
  operationNature: z.string().max(80).optional().nullable(),
  enforceability: z.string().max(80).optional().nullable(),
  incidenceLocation: z.string().max(120).optional().nullable(),
  inssRate: rate.default(0), irRate: rate.default(0), csllRate: rate.default(0),
  pisRate: rate.default(0), cofinsRate: rate.default(0), otherWithholdingRate: rate.default(0),
  defaultValue: z.coerce.number().min(0), active: z.boolean().default(true),
});
