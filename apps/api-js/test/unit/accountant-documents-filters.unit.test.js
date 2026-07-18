import test from "node:test";
import assert from "node:assert/strict";

import { buildWhere } from "../../src/modules/documents/documents.service.js";

test("escopa filtro de conferência ao escritório contábil ativo", () => {
  const where = buildWhere("company-a", { accountantOfficeId: "office-a", reviewStatus: "WITH_ISSUES" });
  assert.deepEqual(where, {
    companyId: "company-a",
    accountantReviews: { some: { officeId: "office-a", status: "WITH_ISSUES" } },
  });
});

test("não conferidos não vaza conferência de outro escritório", () => {
  const where = buildWhere("company-a", { accountantOfficeId: "office-a", reviewStatus: "PENDING" });
  assert.deepEqual(where.accountantReviews, { none: { officeId: "office-a" } });
});

test("filtros de alerta e cancelamento são aplicados no banco", () => {
  const where = buildWhere("company-a", { hasAlerts: "true", cancelled: "true" });
  assert.equal(where.isCancelled, true);
  assert.deepEqual(where.alerts, { some: { status: "open" } });
});

test("filtro de etiqueta permanece escopado à empresa e ao escritório", () => {
  const where = buildWhere("company-a", { accountantOfficeId: "office-a", tagId: "tag-a" });
  assert.equal(where.companyId, "company-a");
  assert.deepEqual(where.accountantTagLinks, { some: { officeId: "office-a", tagId: "tag-a" } });
});

test("tagId sem escritório não habilita filtro não escopado", () => {
  const where = buildWhere("company-a", { tagId: "tag-a" });
  assert.equal(where.accountantTagLinks, undefined);
});
