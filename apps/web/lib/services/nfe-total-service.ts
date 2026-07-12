import type { NfeItem, NfeTotal } from "@/lib/nfe-types";

function money(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateNfeTotals(items: NfeItem[]): NfeTotal {
  const totals = items.reduce(
    (sum, item) => {
      sum.valorProdutos += money(item.valorTotal);
      sum.desconto += money(item.descontoValor);
      sum.frete += money(item.freightValue);
      sum.seguro += money(item.insuranceValue);
      sum.outrasDespesas += money(item.otherCosts);
      sum.totalIcmsBase += money(item.icmsBase);
      sum.totalIcms += money(item.icmsAmount);
      sum.totalIpi += money(item.ipiAmount);
      sum.totalPis += money(item.pisAmount);
      sum.totalCofins += money(item.cofinsAmount);
      return sum;
    },
    {
      valorProdutos: 0,
      desconto: 0,
      frete: 0,
      seguro: 0,
      outrasDespesas: 0,
      totalIcmsBase: 0,
      totalIcms: 0,
      totalIpi: 0,
      totalPis: 0,
      totalCofins: 0,
    },
  );
  const valorTotal = round2(totals.valorProdutos - totals.desconto + totals.frete + totals.seguro + totals.outrasDespesas + totals.totalIpi);
  return {
    valorProdutos: round2(totals.valorProdutos),
    valorTotal,
    desconto: round2(totals.desconto),
    frete: round2(totals.frete),
    seguro: round2(totals.seguro),
    outrasDespesas: round2(totals.outrasDespesas),
    totalIcmsBase: round2(totals.totalIcmsBase),
    totalIcms: round2(totals.totalIcms),
    totalIcmsStBase: 0,
    totalIcmsSt: 0,
    totalFcp: 0,
    totalIpi: round2(totals.totalIpi),
    totalPis: round2(totals.totalPis),
    totalCofins: round2(totals.totalCofins),
    totalTributos: round2(totals.totalIcms + totals.totalIpi + totals.totalPis + totals.totalCofins),
  };
}
