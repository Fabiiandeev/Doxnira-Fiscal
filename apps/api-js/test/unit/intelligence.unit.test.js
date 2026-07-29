import assert from "node:assert/strict";
import test from "node:test";

import { periodRange } from "../../src/modules/intelligence/intelligence.repository.js";
import { calculateFiscalMetrics } from "../../src/modules/intelligence/intelligence.service.js";

test("intelligence period filter includes the complete requested days", () => {
  const range = periodRange({ from: "2026-07-01", to: "2026-07-31" });
  assert.equal(range.start.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-31T23:59:59.999Z");
});

test("fiscal intelligence counts only active real facts and explains risk inputs", () => {
  const result = calculateFiscalMetrics({
    validationIssues: 2,
    alerts: 3,
    documents: [
      { documentType: "NFE", operationDirection: "OUTBOUND", status: "AUTHORIZED", isCancelled: false, isSummary: false, taxAmount: 18, totalAmount: 100 },
      { documentType: "NFE", operationDirection: "INBOUND", status: "REJECTED", isCancelled: false, isSummary: true, taxAmount: 4, totalAmount: 40 },
      { documentType: "CTE", operationDirection: "TRANSPORT_INBOUND", status: "AUTHORIZED", isCancelled: false, isSummary: false, taxAmount: 2, totalAmount: 20 },
      { documentType: "NFE", operationDirection: "OUTBOUND", status: "CANCELLED", isCancelled: true, isSummary: false, taxAmount: 99, totalAmount: 999 },
    ],
  });
  assert.deepEqual(result.metrics, {
    nfeIssued: 1, nfeInbound: 1, cte: 1, mdfe: 0, rejections: 3,
    pending: 4, estimatedTax: 24, revenue: 100,
  });
});
