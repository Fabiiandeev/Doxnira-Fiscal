import assert from "node:assert/strict";
import test from "node:test";

import { allocationHash } from "../../src/modules/nfe-entry/cte-allocation-service.js";

const calculation = {
  cte: { accessKey: "352607123", freightAmount: "10.00" },
  method: "VALUE",
  allocatableValue: "10.00",
  components: { included: ["FREIGHT"], excluded: [] },
  documents: [{ accessKey: "2", calculationBase: "50", allocatedValue: "5.00" }, { accessKey: "1", calculationBase: "50", allocatedValue: "5.00" }],
};

test("calculationHash é determinístico e ignora ordem de propriedades", () => {
  const reordered = { documents: calculation.documents, allocatableValue: "10.00", method: "VALUE", cte: calculation.cte, components: calculation.components };
  assert.equal(allocationHash(calculation), allocationHash(reordered));
});

test("calculationHash muda quando método ou base muda", () => {
  assert.notEqual(allocationHash(calculation), allocationHash({ ...calculation, method: "QUANTITY" }));
  assert.notEqual(allocationHash(calculation), allocationHash({ ...calculation, documents: [{ ...calculation.documents[0], calculationBase: "51" }, calculation.documents[1]] }));
});
