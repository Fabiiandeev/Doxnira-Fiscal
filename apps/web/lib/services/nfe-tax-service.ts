import type { NfeItem } from "@/lib/nfe-types";

function money(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateNfeItemTaxes(item: Pick<NfeItem, "valorTotal" | "descontoValor" | "icmsRate" | "ipiRate" | "pisRate" | "cofinsRate">) {
  const base = Math.max(money(item.valorTotal) - money(item.descontoValor), 0);
  return {
    icmsBase: base,
    icmsAmount: round2(base * (money(item.icmsRate) / 100)),
    ipiBase: base,
    ipiAmount: round2(base * (money(item.ipiRate) / 100)),
    pisBase: base,
    pisAmount: round2(base * (money(item.pisRate) / 100)),
    cofinsBase: base,
    cofinsAmount: round2(base * (money(item.cofinsRate) / 100)),
  };
}

export function needsAccountantReview(ruleName: string | null | undefined) {
  return !ruleName || /ncm|cest|cfop|cst|csosn|regime/i.test(ruleName);
}
