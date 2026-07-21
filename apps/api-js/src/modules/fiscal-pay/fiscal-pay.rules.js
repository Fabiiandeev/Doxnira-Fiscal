/**
 * Regras e validações de filtros, paginação e ordenação para o módulo FiscalPay.
 * Funções puras destinadas ao service layer de consulta de Payables.
 */

import { AppError } from "../../utils/app-error.js";
import { normalizeCnpj } from "../../utils/cnpj.js";

const ALLOWED_SORT_FIELDS = new Set([
  "dueDate",
  "amount",
  "createdAt",
  "updatedAt",
  "supplierName",
  "installmentNumber",
  "status",
]);

const ALLOWED_SORT_ORDERS = new Set(["asc", "desc"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseNullableDate(value) {
  if (!isNonEmptyString(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export function parseDateFilter(fromValue, toValue) {
  const result = {};

  if (fromValue !== undefined && fromValue !== null && String(fromValue).trim() !== "") {
    const date = parseNullableDate(fromValue);
    if (date === undefined) {
      throw new AppError(
        "Data inicial inválida.",
        "FISCAL_PAY_INVALID_DATE",
        422,
      );
    }
    result.fromDate = date;
  }

  if (toValue !== undefined && toValue !== null && String(toValue).trim() !== "") {
    const date = parseNullableDate(toValue);
    if (date === undefined) {
      throw new AppError(
        "Data final inválida.",
        "FISCAL_PAY_INVALID_DATE",
        422,
      );
    }
    result.toDate = date;
  }

  if (result.fromDate && result.toDate && result.fromDate > result.toDate) {
    throw new AppError(
      "Faixa de datas invertida.",
      "FISCAL_PAY_INVALID_DATE_RANGE",
      422,
    );
  }

  return result;
}

function parseAmountValue(value, errorCode, errorMessage) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    throw new AppError(errorMessage, errorCode, 422);
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || Number.isNaN(number)) {
    throw new AppError(errorMessage, errorCode, 422);
  }
  if (number < 0) {
    throw new AppError(errorMessage, errorCode, 422);
  }
  return number;
}

export function parseAmountFilter(minValue, maxValue) {
  const result = {};

  const min = parseAmountValue(
    minValue,
    "FISCAL_PAY_INVALID_AMOUNT",
    "Valor mínimo inválido.",
  );
  if (min !== undefined) result.minAmount = min;

  const max = parseAmountValue(
    maxValue,
    "FISCAL_PAY_INVALID_AMOUNT",
    "Valor máximo inválido.",
  );
  if (max !== undefined) result.maxAmount = max;

  if (result.minAmount !== undefined && result.maxAmount !== undefined && result.minAmount > result.maxAmount) {
    throw new AppError(
      "Faixa monetária invertida.",
      "FISCAL_PAY_INVALID_AMOUNT_RANGE",
      422,
    );
  }

  return result;
}

export function parseFiscalPayFilters(query = {}) {
  const filters = {};

  const dateFilters = parseDateFilter(query.dueDateFrom, query.dueDateTo);
  if (dateFilters.fromDate) filters.fromDate = dateFilters.fromDate;
  if (dateFilters.toDate) filters.toDate = dateFilters.toDate;

  const amountFilters = parseAmountFilter(query.minAmount, query.maxAmount);
  if (amountFilters.minAmount !== undefined) filters.minAmount = amountFilters.minAmount;
  if (amountFilters.maxAmount !== undefined) filters.maxAmount = amountFilters.maxAmount;

  if (isNonEmptyString(query.status)) filters.status = query.status.trim();
  if (isNonEmptyString(query.source)) filters.source = query.source.trim();
  if (isNonEmptyString(query.paymentMethod)) filters.paymentMethod = query.paymentMethod.trim();
  if (isNonEmptyString(query.supplierId)) filters.supplierId = query.supplierId.trim();

  if (isNonEmptyString(query.supplierCnpj)) {
    filters.supplierCnpj = normalizeCnpj(query.supplierCnpj);
  }

  if (isNonEmptyString(query.nfeEntryId)) filters.nfeEntryId = query.nfeEntryId.trim();

  if (isNonEmptyString(query.q)) filters.q = query.q.trim();

  return filters;
}

export function buildFiscalPayWhere(companyId, filters = {}) {
  const where = { companyId };

  if (filters.status) where.status = filters.status;
  if (filters.source) where.source = filters.source;
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.supplierCnpj) where.supplierCnpj = filters.supplierCnpj;
  if (filters.nfeEntryId) where.nfeEntryId = filters.nfeEntryId;

  if (filters.fromDate || filters.toDate) {
    where.dueDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {
      ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
      ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
    };
  }

  if (isNonEmptyString(filters.q)) {
    where.OR = [
      { supplierName: { contains: filters.q, mode: "insensitive" } },
      { supplierCnpj: { contains: normalizeCnpj(filters.q) } },
      { installmentNumber: { contains: filters.q } },
      { nfeEntry: { number: { contains: filters.q } } },
      { nfeEntry: { series: { contains: filters.q } } },
      { nfeEntry: { accessKey: { contains: filters.q } } },
    ];
  }

  return where;
}

export function buildFiscalPayOrderBy(sortBy, sortOrder) {
  const field = isNonEmptyString(sortBy) ? sortBy.trim() : "dueDate";
  const order = isNonEmptyString(sortOrder) ? sortOrder.trim().toLowerCase() : "asc";

  if (!ALLOWED_SORT_FIELDS.has(field)) {
    throw new AppError("Ordenação inválida.", "FISCAL_PAY_INVALID_SORT", 422);
  }

  if (!ALLOWED_SORT_ORDERS.has(order)) {
    throw new AppError("Ordenação inválida.", "FISCAL_PAY_INVALID_SORT", 422);
  }

  return { [field]: order };
}
