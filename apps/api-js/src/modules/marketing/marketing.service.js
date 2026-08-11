import { createHash } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { listPublicPlans } from "../subscription/subscription-plan.service.js";

const clean = (value) => value?.replace(/[<>]/g, "").trim() || null;
const duplicateWindow = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export async function getPublicPlans() {
  const [monthly, annual] = await Promise.all([listPublicPlans({ billingCycle: "MONTHLY" }), listPublicPlans({ billingCycle: "ANNUAL" })]);
  const plans = new Map();
  for (const item of [...monthly, ...annual]) {
    const plan = plans.get(item.code) ?? { code: item.code, name: item.name, description: item.description, displayOrder: item.displayOrder, prices: [], highlights: Object.entries(item.features).filter(([, enabled]) => enabled === true).slice(0, 4).map(([code]) => code), recommended: item.code === "PROFESSIONAL", customPricing: item.code === "COMPANY", checkoutAvailable: false };
    plan.prices.push({ billingCycle: item.price.billingCycle, amountCents: item.price.amountCents, currency: item.price.currency }); plans.set(item.code, plan);
  }
  return [...plans.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getPublicFeatures() {
  const rows = await prisma.subscriptionFeature.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return rows.map((item) => ({ code: item.code, name: item.name, description: item.description, status: "AVAILABLE", statusLabel: "Disponível" }));
}

export async function createLead(input, request) {
  const email = input.email.toLowerCase();
  const duplicate = await prisma.marketingLead.findFirst({ where: { email, planCode: input.planCode, createdAt: { gte: duplicateWindow() } } });
  if (duplicate) throw new AppError("Já recebemos seu interesse. Nosso time entrará em contato.", "MARKETING_LEAD_DUPLICATE", 409);
  try { return await prisma.marketingLead.create({ data: { name: clean(input.name), email, phone: clean(input.phone), companyName: clean(input.companyName), document: input.document ?? null, interest: input.interest, planCode: input.planCode ?? null, message: clean(input.message), source: clean(input.source), requestId: request.id, ipHash: createHash("sha256").update(request.ip || "").digest("hex") } }); }
  catch (error) { if (error.code === "P2002") throw new AppError("Já recebemos seu interesse. Nosso time entrará em contato.", "MARKETING_LEAD_DUPLICATE", 409); throw error; }
}

export async function createContact(input, request) {
  return prisma.marketingLead.create({ data: { name: input.companyName, email: input.contact.toLowerCase(), phone: null, companyName: clean(input.companyName), interest: "OTHER", planCode: input.planCode ?? null, subject: clean(input.subject), message: clean(input.message), source: clean(input.source), requestId: request.id, ipHash: createHash("sha256").update(request.ip || "").digest("hex") } });
}
