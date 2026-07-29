import test from "node:test";
import assert from "node:assert/strict";
import { calculateCompanyRisk, classifyRisk } from "../../src/modules/accountant/accountant-risk.service.js";
import { readFile } from "node:fs/promises";

test("ranking contábil é determinístico, explicável e classifica todos os níveis", () => {
  const evidence = { criticalAlert: 2, highAlert: 1, rejectedDocument: 1 };
  assert.deepEqual(calculateCompanyRisk(evidence), calculateCompanyRisk(evidence));
  assert.equal(calculateCompanyRisk(evidence).classification, "HIGH");
  assert.deepEqual([classifyRisk(0), classifyRisk(10), classifyRisk(30), classifyRisk(60), classifyRisk(90)], ["HEALTHY", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
});

test("relatório não contém métricas financeiras inventadas e migration é aditiva", async () => {
  const service = await readFile(new URL("../../src/modules/accountant/accountant-value-report.service.js", import.meta.url), "utf8");
  assert.doesNotMatch(service, /economia|impostos recuperados|multas evitadas/i);
  const sql = await readFile(new URL("../../prisma/migrations/20260728150000_add_accountant_fiscal_queue/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE/);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
});

test("rotas cobrem escopos, paginação e mutações da fila", async () => {
  const routes = await readFile(new URL("../../src/modules/accountant/accountant-office.routes.js", import.meta.url), "utf8");
  for (const route of ["dashboard", "risk-ranking", "fiscal-queue", "value-report", "requests", "documents"]) assert.match(routes, new RegExp(route));
  for (const action of ["assign", "start", "request-information", "resolve", "dismiss", "reopen", "change-priority"]) assert.match(routes, new RegExp(action));
});
