export type BillingCycle = "MONTHLY" | "ANNUAL";

const CHECKOUT_ENV_BY_PLAN_AND_CYCLE: Record<string, string | undefined> = {
  STARTER_MONTHLY: process.env.NEXT_PUBLIC_CHECKOUT_STARTER_MONTHLY,
  STARTER_ANNUAL: process.env.NEXT_PUBLIC_CHECKOUT_STARTER_ANNUAL,
  PROFESSIONAL_MONTHLY: process.env.NEXT_PUBLIC_CHECKOUT_PROFESSIONAL_MONTHLY,
  PROFESSIONAL_ANNUAL: process.env.NEXT_PUBLIC_CHECKOUT_PROFESSIONAL_ANNUAL,
  BUSINESS_MONTHLY: process.env.NEXT_PUBLIC_CHECKOUT_BUSINESS_MONTHLY,
  BUSINESS_ANNUAL: process.env.NEXT_PUBLIC_CHECKOUT_BUSINESS_ANNUAL,
};

export const ENTERPRISE_CONTACT_URL =
  process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_URL ?? null;

/**
 * Retorna a URL de checkout pública validada para um plano/ciclo.
 * Quando não configurada, retorna null (o frontend faz fallback para /contato?plano=CODE).
 * Validação HTTPS + host está em checkout-url-validator.
 */
export function resolveCheckoutUrl(
  planCode: string,
  billingCycle: BillingCycle,
): string | null {
  const key = `${planCode}_${billingCycle}`;
  const raw = CHECKOUT_ENV_BY_PLAN_AND_CYCLE[key];
  return raw ? raw.trim() : null;
}

export function isEnterprisePlan(planCode: string | undefined | null): boolean {
  return planCode === "COMPANY";
}
