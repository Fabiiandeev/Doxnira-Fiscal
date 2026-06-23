import { decimal, sumDocuments } from "./fiscal-summary.service.js";

export function calculateEstimatedTaxes(documents, settings, rules = []) {
  const activeDocuments = documents.filter((document) => !document.isCancelled);
  const highlighted = {
    icms: sumDocuments(activeDocuments, "icmsAmount"),
    ipi: sumDocuments(activeDocuments, "ipiAmount"),
    pis: sumDocuments(activeDocuments, "pisAmount"),
    cofins: sumDocuments(activeDocuments, "cofinsAmount"),
  };
  const ruleBased = rules.reduce(
    (totals, rule) => {
      const matching = activeDocuments.filter(
        (document) =>
          (!rule.cfop || document.cfop === rule.cfop) &&
          (!rule.operationDirection ||
            document.operationDirection === rule.operationDirection),
      );
      const base = matching.reduce(
        (sum, document) => sum + decimal(document.totalAmount),
        0,
      );
      totals[rule.taxType] =
        (totals[rule.taxType] || 0) + (base * decimal(rule.rate)) / 100;
      return totals;
    },
    {},
  );
  return {
    highlighted,
    ruleBased,
    estimatedTotal:
      highlighted.icms + highlighted.ipi + highlighted.pis + highlighted.cofins,
    method: rules.length ? "PARAMETERIZED_RULES_AND_XML_CHECK" : "XML_HIGHLIGHTED_VALUES",
    taxRegime: settings.taxRegime,
    definitive: false,
  };
}
