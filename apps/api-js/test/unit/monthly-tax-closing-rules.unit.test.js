import test from "node:test";
import assert from "node:assert/strict";

import { closingCategory, isClosingEligible } from "../../src/services/monthly-tax-closing.service.js";

test("fechamento mensal aceita somente fontes fiscais reais e documentos ativos", () => {
  for (const source of ["REAL_SEFAZ", "MANUAL_IMPORT", "ERP_IMPORT"]) assert.equal(isClosingEligible({ source, isCancelled: false, status: "AUTORIZADO" }), true);
  for (const source of ["MOCK", "SEED"]) assert.equal(isClosingEligible({ source, isCancelled: false, status: "AUTORIZADO" }), false);
  assert.equal(isClosingEligible({ source: "REAL_SEFAZ", isCancelled: true, status: "CANCELADO" }), false);
  assert.equal(isClosingEligible({ source: "ERP_IMPORT", isCancelled: false, status: "INUTILIZADA" }), false);
});

test("fechamento mensal preserva grupos distintos de NF-e e CT-e", () => {
  assert.equal(closingCategory({ documentType: "NFE", operationDirection: "INBOUND" }), "NF_E_ENTRADA");
  assert.equal(closingCategory({ documentType: "NFE", operationDirection: "OUTBOUND" }), "NF_E_SAIDA");
  assert.equal(closingCategory({ documentType: "CTE", operationDirection: "TRANSPORT_INBOUND" }), "CT_E_ENTRADA");
});
