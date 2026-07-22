import { formatCurrency } from "@/lib/utils";

export const enumValue = {
  monthly: "MONTHLY" as const,
  annual: "ANNUAL" as const,
};

export type PricingCycle = typeof enumValue.monthly | typeof enumValue.annual;

export function formatAmount(amountCents: number, currency = "BRL"): string {
  if (!Number.isFinite(amountCents)) return "—";
  const value = amountCents / 100;
  if (currency !== "BRL") {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
    } catch {
      return formatCurrency(value);
    }
  }
  return formatCurrency(value);
}

export function annualSavingsCents(
  monthlyAmountCents: number | undefined,
  annualAmountCents: number | undefined,
): number | null {
  if (!Number.isFinite(monthlyAmountCents ?? 0) || !Number.isFinite(annualAmountCents ?? 0)) {
    return null;
  }
  const monthly = Number(monthlyAmountCents ?? 0);
  const annual = Number(annualAmountCents ?? 0);
  if (monthly <= 0 || annual <= 0) return null;
  const expectedAnnual = monthly * 12;
  const saved = expectedAnnual - annual;
  return saved > 0 ? saved : null;
}

export function normalizePhone(value: string): string {
  return String(value ?? "").replace(/[^\d+]/g, "").slice(0, 20);
}

export function normalizeCnpj(value: string): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, 14);
}

const STRIP_TAGS = /<\/?[^>]+>/g;
const DANGEROUS_SCRIPT = /<script[\s\S]*?<\/script>/gi;

export function sanitizePlainText(value: string): string {
  return String(value ?? "")
    .replace(DANGEROUS_SCRIPT, "")
    .replace(STRIP_TAGS, "")
    .trim()
    .slice(0, 5000);
}
