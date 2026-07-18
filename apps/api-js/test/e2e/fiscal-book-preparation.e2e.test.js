import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/config/prisma.js";
import { buildFiscalBookPreparation } from "../../src/services/fiscal-book-preparation.service.js";
import { reopenMonthlyClosing } from "../../src/services/monthly-tax-closing.service.js";

const id = () => crypto.randomUUID();
import crypto from "node:crypto";

test("pre-escrituração exige fechamento aprovado e preserva grupos elegíveis", async () => {
  const user = await prisma.user.create({ data: { name: "Book test", email: `book-${id()}@test.local`, passwordHash: "x" } });
  const company = await prisma.company.create({ data: { ownerId: user.id, legalName: "Book test", cnpj: String(Date.now()).slice(-14).padStart(14,"1"), environment: "homologation" } });
  const closing = await prisma.monthlyTaxClosing.create({ data: { companyId: company.id, periodYear: 2026, periodMonth: 7, status: "DRAFT" } });
  await assert.rejects(() => buildFiscalBookPreparation(company.id, closing.id, { userId: user.id }), { code: "FISCAL_BOOK_CLOSING_NOT_APPROVED" });
  await prisma.monthlyTaxClosing.update({ where: { id: closing.id }, data: { status: "APPROVED", approvedAt: new Date(), taxSettingsSnapshot: { fiscalConfigComplete: false } } });
  const preparation = await buildFiscalBookPreparation(company.id, closing.id, { userId: user.id });
  assert.equal(preparation.status, "BLOCKED");
  assert.ok(preparation.issues.some((item) => item.code === "TAX_SETTINGS_REQUIRED" && item.severity === "BLOCKING"));
  const again = await buildFiscalBookPreparation(company.id, closing.id, { userId: user.id });
  assert.equal(again.id, preparation.id);
  await reopenMonthlyClosing(company.id, closing.id, { userId: user.id, reason: "Teste stale" });
  const stale = await prisma.fiscalBookPreparation.findUnique({ where: { monthlyTaxClosingId: closing.id } });
  assert.equal(stale.status, "STALE");
  await reopenMonthlyClosing(company.id, closing.id, { userId: user.id, reason: "Teste stale novamente" });
  const audits = await prisma.auditLog.findMany({ where: { entityId: preparation.id, action: "accountant.fiscal_book.invalidated" } });
  assert.equal(audits.length, 1);
  await prisma.monthlyTaxClosing.delete({ where: { id: closing.id } });
  await prisma.company.delete({ where: { id: company.id } });
  await prisma.user.delete({ where: { id: user.id } });
});
