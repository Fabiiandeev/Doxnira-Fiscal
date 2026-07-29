import { z } from "zod";
const money = z.coerce.number().min(0);
const item = z.object({
  productId: z.string().uuid().optional(), description: z.string().min(2),
  quantity: z.coerce.number().positive(), unitPrice: money,
  unit: z.enum(["UN","KG","G","L","ML","M","M2","M3","CX","PC","PAR","DZ"]),
  ncm: z.string().regex(/^\d{8}$/), cfop: z.string().regex(/^\d{4}$/),
  cst: z.string().max(3).optional(), csosn: z.string().max(3).optional(),
});
export const nfceSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  customerDocument: z.string().regex(/^(\d{11}|\d{14})$/).optional().nullable(),
  items: z.array(item).min(1),
  payments: z.array(z.object({ method: z.string().min(2), amount: money })).min(1),
  change: money.default(0), notes: z.string().max(2000).optional().nullable(),
}).superRefine((data, ctx) => {
  data.items.forEach((value, index) => { if (!value.cst && !value.csosn) ctx.addIssue({ code: "custom", path: ["items",index,"cst"], message: "Informe CST ou CSOSN." }); });
  const total = data.items.reduce((s,i)=>s+i.quantity*i.unitPrice,0);
  const paid = data.payments.reduce((s,p)=>s+p.amount,0);
  if (Math.abs(paid - data.change - total) > 0.01) ctx.addIssue({ code:"custom",path:["payments"],message:"Pagamentos, troco e total não conferem." });
});
export const nfseSchema = z.object({
  customerId: z.string().uuid(), serviceId: z.string().uuid(),
  description: z.string().min(3).max(2000), value: money.positive(),
  deductions: money.default(0),
});
