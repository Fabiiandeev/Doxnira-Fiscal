import { z } from "zod";

export const actionSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1),
  action: z.enum(["AUTO_SAFE", "AUTO_CONFIRM", "MANUAL_GUIDED", "ACCOUNTANT_REVIEW", "REVALIDATE", "IGNORE", "ANALYZED", "ASSIGN"]),
  justification: z.string().trim().min(3).optional(),
  assignee: z.string().trim().min(2).optional(),
}).superRefine((value, context) => {
  if (value.action === "IGNORE" && !value.justification) {
    context.addIssue({ code: "custom", path: ["justification"], message: "Justificativa obrigatória." });
  }
});

export const messageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(2).max(4000),
  documentId: z.string().uuid().optional(),
});

export const ruleSchema = z.object({
  taxRegime: z.string().trim().min(2).max(40),
  uf: z.string().trim().length(2).optional().nullable(),
  cfop: z.string().trim().max(10).optional().nullable(),
  ncm: z.string().trim().max(20).optional().nullable(),
  cst: z.string().trim().max(10).optional().nullable(),
  csosn: z.string().trim().max(10).optional().nullable(),
  taxType: z.string().trim().min(2).max(30),
  operationDirection: z.string().trim().max(30).optional().nullable(),
  rate: z.coerce.number().min(0).max(100),
  creditAllowed: z.boolean().default(false),
  debitAllowed: z.boolean().default(false),
  effectiveFrom: z.coerce.date(),
});
