import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { evaluateAutomation, evaluateCondition, sanitizeAutomationPayload, sensitiveActions } from "../../src/modules/operation/automation-runner.js";

test("condições AND e OR avaliam payload real", () => {
  const conditions = [{ field: "amount", operator: "GREATER_THAN", value: 10 }, { field: "status", operator: "EQUALS", value: "OPEN" }];
  assert.equal(evaluateAutomation({ conditions, conditionLogic: "AND" }, { amount: 20, status: "OPEN" }).matched, true);
  assert.equal(evaluateAutomation({ conditions, conditionLogic: "OR" }, { amount: 1, status: "OPEN" }).matched, true);
});
test("todos os operadores mínimos são suportados", () => {
  const cases = [["EQUALS",1,1],["NOT_EQUALS",1,2],["GREATER_THAN",2,1],["GREATER_OR_EQUAL",2,2],["LESS_THAN",1,2],["LESS_OR_EQUAL",2,2],["CONTAINS","abc","b"],["IN","a",["a","b"]],["IS_EMPTY","",null],["IS_NOT_EMPTY","x",null]];
  for (const [operator, actual, value] of cases) assert.equal(evaluateCondition({ field: "x", operator, value }, { x: actual }).result, true, operator);
});
test("payload remove credenciais e dados fiscais sensíveis recursivamente", () => {
  assert.deepEqual(sanitizeAutomationPayload({ token: "abc", nested: { password: "x", safe: 1 }, rawXml: "<xml/>" }), { token: "[REDACTED]", nested: { password: "[REDACTED]", safe: 1 }, rawXml: "[REDACTED]" });
});
test("ações sensíveis são classificadas para bloqueio", () => {
  for (const action of ["MOVE_INVENTORY","ISSUE_FISCAL_DOCUMENT","CANCEL_FISCAL_DOCUMENT","CHANGE_MARKETPLACE_PRICE","PAY_FINANCIAL_ENTRY","RECEIVE_FINANCIAL_ENTRY"]) assert.equal(sensitiveActions.has(action), true);
});
test("migration e navegação 08C são completas", () => {
  const sql = fs.readFileSync(new URL("../../prisma/migrations/20260728110000_add_operation_automation_core/migration.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
  const shell = fs.readFileSync(new URL("../../../web/components/app-shell.tsx", import.meta.url), "utf8");
  for (const href of ["/operacao","/operacao/estoque","/operacao/compras","/operacao/vendas","/operacao/automacao"]) assert.match(shell, new RegExp(`href: "${href}"`));
});
