import assert from "node:assert/strict";
import test from "node:test";
import { calculateCteAllocation } from "../../src/modules/nfe-entry/cte-allocation-rules.js";

test("rateia residual pela chave, independentemente do ID interno", () => {
  const result = calculateCteAllocation({ method: "VALUE", allocatableValue: "0.01", documents: [{ id: "a", accessKey: "9", productsAmount: "1.00" }, { id: "z", accessKey: "1", productsAmount: "1.00" }] });
  assert.deepEqual(result.documents.map((item) => [item.nfeEntryId, item.allocatedValue]), [["z", "0.01"], ["a", "0.00"]]);
});

test("rejeita rateio manual divergente e base automática zerada", () => {
  assert.throws(() => calculateCteAllocation({ method: "MANUAL", allocatableValue: "10.00", documents: [{ id: "a" }], manualAllocations: [{ nfeEntryId: "a", value: "9.99" }] }), /CTE_ALLOCATION_TOTAL_MISMATCH/);
  assert.throws(() => calculateCteAllocation({ method: "WEIGHT", allocatableValue: "10.00", documents: [{ id: "a", weight: 0 }] }), /CTE_ALLOCATION_WEIGHT_BASE_REQUIRED/);
});
