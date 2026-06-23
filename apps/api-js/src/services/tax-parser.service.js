function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstTaxGroup(tax) {
  if (!tax || typeof tax !== "object") return {};
  return Object.values(tax).find((value) => value && typeof value === "object") || {};
}

export function parseTaxTotals(total = {}) {
  const values = {
    productsAmount: number(total.vProd),
    freightAmount: number(total.vFrete),
    discountAmount: number(total.vDesc),
    icmsBase: number(total.vBC),
    icmsAmount: number(total.vICMS),
    icmsStAmount: number(total.vST),
    fcpAmount: number(total.vFCP),
    ipiAmount: number(total.vIPI),
    pisAmount: number(total.vPIS),
    cofinsAmount: number(total.vCOFINS),
    otherAmount: number(total.vOutro),
  };
  return {
    ...values,
    taxAmount:
      values.icmsAmount +
      values.icmsStAmount +
      values.fcpAmount +
      values.ipiAmount +
      values.pisAmount +
      values.cofinsAmount,
  };
}

export function parseItemTaxes(imposto = {}) {
  const icms = firstTaxGroup(imposto.ICMS);
  const ipi = firstTaxGroup(imposto.IPI);
  const pis = firstTaxGroup(imposto.PIS);
  const cofins = firstTaxGroup(imposto.COFINS);
  return {
    cst: String(icms.CST ?? ipi.CST ?? "").trim() || null,
    csosn: String(icms.CSOSN ?? "").trim() || null,
    icmsBase: number(icms.vBC),
    icmsRate: number(icms.pICMS),
    icmsAmount: number(icms.vICMS),
    ipiBase: number(ipi.vBC),
    ipiRate: number(ipi.pIPI),
    ipiAmount: number(ipi.vIPI),
    pisBase: number(pis.vBC),
    pisRate: number(pis.pPIS),
    pisAmount: number(pis.vPIS),
    cofinsBase: number(cofins.vBC),
    cofinsRate: number(cofins.pCOFINS),
    cofinsAmount: number(cofins.vCOFINS),
  };
}
