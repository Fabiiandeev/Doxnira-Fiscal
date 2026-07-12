import test from "node:test";
import assert from "node:assert/strict";

import { money } from "../../src/modules/nfe-entry/nfe-entry-rules.js";

test("normaliza valores monetários inválidos para zero", () => {
  assert.equal(money("12.50"), 12.5);
  assert.equal(money("invalido"), 0);
  assert.equal(money(null), 0);
});
