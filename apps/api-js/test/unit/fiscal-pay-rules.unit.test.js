import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDateFilter,
  parseAmountFilter,
  parseFiscalPayFilters,
  buildFiscalPayWhere,
  buildFiscalPayOrderBy,
} from "../../src/modules/fiscal-pay/fiscal-pay.rules.js";
import { AppError } from "../../src/utils/app-error.js";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

function assertAppError(fn, code, statusCode = 422) {
  let error = null;
  try {
    fn();
  } catch (err) {
    error = err;
  }
  assert.ok(error instanceof AppError, "deve lançar AppError");
  assert.equal(error.code, code);
  assert.equal(error.statusCode, statusCode);
  return error;
}

test("filtros vazios", () => {
  const filters = parseFiscalPayFilters({});
  assert.deepEqual(filters, {});
});

test("companyId fornecido pelo argumento", () => {
  const filters = parseFiscalPayFilters({});
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.companyId, COMPANY_ID);
});

test("query.companyId ignorado", () => {
  const filters = parseFiscalPayFilters({
    companyId: "99999999-9999-9999-9999-999999999999",
  });
  assert.equal(filters.companyId, undefined);
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.companyId, COMPANY_ID);
  assert.equal(where.companyId, COMPANY_ID);
});

test("status", () => {
  const filters = parseFiscalPayFilters({ status: "OPEN" });
  assert.equal(filters.status, "OPEN");
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.status, "OPEN");
});

test("source", () => {
  const filters = parseFiscalPayFilters({ source: "NFE_ENTRY" });
  assert.equal(filters.source, "NFE_ENTRY");
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.source, "NFE_ENTRY");
});

test("paymentMethod", () => {
  const filters = parseFiscalPayFilters({ paymentMethod: "BOLETO" });
  assert.equal(filters.paymentMethod, "BOLETO");
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.paymentMethod, "BOLETO");
});

test("supplierId", () => {
  const filters = parseFiscalPayFilters({ supplierId: "22222222-2222-2222-2222-222222222222" });
  assert.equal(filters.supplierId, "22222222-2222-2222-2222-222222222222");
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.supplierId, "22222222-2222-2222-2222-222222222222");
});

test("supplierCnpj normalizado", () => {
  const filters = parseFiscalPayFilters({ supplierCnpj: "11.222.333/0001-44" });
  assert.equal(filters.supplierCnpj, "11222333000144");
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.supplierCnpj, "11222333000144");
});

test("nfeEntryId", () => {
  const filters = parseFiscalPayFilters({ nfeEntryId: "33333333-3333-3333-3333-333333333333" });
  assert.equal(filters.nfeEntryId, "33333333-3333-3333-3333-333333333333");
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.nfeEntryId, "33333333-3333-3333-3333-333333333333");
});

test("busca textual", () => {
  const filters = parseFiscalPayFilters({ q: "fornecedor x" });
  assert.equal(filters.q, "fornecedor x");
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR.length, 6);
  assert.ok(where.OR.some((clause) => "supplierName" in clause));
  assert.ok(where.OR.some((clause) => "supplierCnpj" in clause));
  assert.ok(where.OR.some((clause) => "installmentNumber" in clause));
  assert.ok(where.OR.some((clause) => "nfeEntry" in clause && "number" in clause.nfeEntry));
  assert.ok(where.OR.some((clause) => "nfeEntry" in clause && "series" in clause.nfeEntry));
  assert.ok(where.OR.some((clause) => "nfeEntry" in clause && "accessKey" in clause.nfeEntry));
});

test("data inicial", () => {
  const filters = parseFiscalPayFilters({ dueDateFrom: "2026-01-01" });
  assert.ok(filters.fromDate instanceof Date);
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.ok(where.dueDate);
  assert.ok(where.dueDate.gte);
});

test("data final", () => {
  const filters = parseFiscalPayFilters({ dueDateTo: "2026-12-31" });
  assert.ok(filters.toDate instanceof Date);
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.ok(where.dueDate);
  assert.ok(where.dueDate.lte);
});

test("data inválida", () => {
  assertAppError(
    () => parseDateFilter("not-a-date", undefined),
    "FISCAL_PAY_INVALID_DATE",
  );
  assertAppError(
    () => parseFiscalPayFilters({ dueDateFrom: "xx" }),
    "FISCAL_PAY_INVALID_DATE",
  );
});

test("faixa de data invertida", () => {
  assertAppError(
    () => parseDateFilter("2026-12-31", "2026-01-01"),
    "FISCAL_PAY_INVALID_DATE_RANGE",
  );
  assertAppError(
    () => parseFiscalPayFilters({ dueDateFrom: "2026-12-31", dueDateTo: "2026-01-01" }),
    "FISCAL_PAY_INVALID_DATE_RANGE",
  );
});

test("minAmount isolado", () => {
  const filters = parseFiscalPayFilters({ minAmount: 100 });
  assert.equal(filters.minAmount, 100);
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.amount.gte, 100);
  assert.equal(where.amount.lte, undefined);
});

test("maxAmount isolado", () => {
  const filters = parseFiscalPayFilters({ maxAmount: 500 });
  assert.equal(filters.maxAmount, 500);
  const where = buildFiscalPayWhere(COMPANY_ID, filters);
  assert.equal(where.amount.lte, 500);
  assert.equal(where.amount.gte, undefined);
});

test("valor negativo", () => {
  assertAppError(
    () => parseAmountFilter(-10, undefined),
    "FISCAL_PAY_INVALID_AMOUNT",
  );
  assertAppError(
    () => parseFiscalPayFilters({ minAmount: -1 }),
    "FISCAL_PAY_INVALID_AMOUNT",
  );
});

test("valor não numérico", () => {
  assertAppError(
    () => parseAmountFilter("abc", undefined),
    "FISCAL_PAY_INVALID_AMOUNT",
  );
  assertAppError(
    () => parseAmountFilter(undefined, "xyz"),
    "FISCAL_PAY_INVALID_AMOUNT",
  );
});

test("faixa monetária invertida", () => {
  assertAppError(
    () => parseAmountFilter(500, 100),
    "FISCAL_PAY_INVALID_AMOUNT_RANGE",
  );
  assertAppError(
    () => parseFiscalPayFilters({ minAmount: 500, maxAmount: 100 }),
    "FISCAL_PAY_INVALID_AMOUNT_RANGE",
  );
});

test("valor zero é aceito", () => {
  const filters = parseFiscalPayFilters({ minAmount: 0, maxAmount: 0 });
  assert.equal(filters.minAmount, 0);
  assert.equal(filters.maxAmount, 0);
});

test("ordenção padrão", () => {
  const orderBy = buildFiscalPayOrderBy(undefined, undefined);
  assert.deepEqual(orderBy, { dueDate: "asc" });
});

test("ordenação descendente válida", () => {
  const orderBy = buildFiscalPayOrderBy("amount", "desc");
  assert.deepEqual(orderBy, { amount: "desc" });
});

test("sortBy inválido", () => {
  assertAppError(
    () => buildFiscalPayOrderBy("invalidField", "asc"),
    "FISCAL_PAY_INVALID_SORT",
  );
});

test("sortOrder inválido", () => {
  assertAppError(
    () => buildFiscalPayOrderBy("dueDate", "sideways"),
    "FISCAL_PAY_INVALID_SORT",
  );
});
