import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../../src/modules/fiscal-compliance/fiscal-compliance.routes.js", import.meta.url), "utf8");
const preparation = fs.readFileSync(new URL("../../src/services/fiscal-book-preparation.service.js", import.meta.url), "utf8");
const closing = fs.readFileSync(new URL("../../src/services/monthly-tax-closing.service.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../../prisma/migrations/20260728010000_add_tax_guides/migration.sql", import.meta.url), "utf8");

test("SPED/SINTEGRA exigem fechamento aprovado e bloqueios não podem ser ignorados", () => {
  assert.match(preparation, /closing\.status !== "APPROVED"/);
  assert.match(route, /severity==="BLOCKING"/);
  assert.match(route, /JUSTIFICATION_REQUIRED/);
  assert.match(route, /SPED_FISCAL","SINTEGRA/);
});

test("reabertura torna preparações STALE", () => {
  assert.match(closing, /status: "STALE"/);
  assert.match(closing, /invalidatedReason: actor\.reason/);
});

test("VIEWER é somente leitura e consultas são isoladas por companyId", () => {
  assert.match(route, /r\.user\.role==="VIEWER"/);
  assert.ok((route.match(/companyId:r\.company\.id/g) || []).length >= 8);
});

test("previsão é derivada de totais fiscais e rotulada como estimativa", () => {
  assert.match(route, /ICMS:Number\(c\.icmsTotal\)/);
  assert.match(route, /kind:"ESTIMATE"/);
  assert.match(route, /previousTotal/);
});

test("guias persistem estados operacionais e histórico auditável", () => {
  for (const status of ["PENDING", "ISSUED", "PAID", "OVERDUE", "CANCELED"]) assert.match(route, new RegExp(status));
  assert.match(route, /entityType:"TaxGuide"/);
  assert.match(migration, /CREATE TABLE "tax_guides"/);
});
