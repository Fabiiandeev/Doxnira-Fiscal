import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { prisma } from "../../src/config/prisma.js";
import { generateFiscalExport, validateFiscalExport } from "../../src/services/fiscal-export.service.js";

const id = () => crypto.randomUUID();

async function fixture() {
  const user = await prisma.user.create({ data: { name: "Export test", email: `export-${id()}@test.local`, passwordHash: "x" } });
  const company = await prisma.company.create({ data: { ownerId: user.id, legalName: "Export test", cnpj: String(Date.now()).slice(-14).padStart(14, "2"), environment: "homologation" } });
  const officeId = id();
  const closing = await prisma.monthlyTaxClosing.create({ data: { companyId: company.id, officeId, periodYear: 2026, periodMonth: 7, status: "APPROVED", approvedAt: new Date() } });
  const preparation = await prisma.fiscalBookPreparation.create({ data: { companyId: company.id, officeId, monthlyTaxClosingId: closing.id, periodYear: 2026, periodMonth: 7, status: "READY", snapshotHash: crypto.createHash("sha256").update("fixture").digest("hex") } });
  await prisma.fiscalBookPreparationDocument.create({ data: { preparationId: preparation.id, companyId: company.id, sourceType: "NFE", operationGroup: "NF_E_ENTRADA", accessKey: "1".repeat(44), model: "55", series: "1", number: "10", emissionDate: new Date("2026-07-01T00:00:00.000Z"), participantDocument: "12345678000199", participantName: "Participante", totalAmount: 10, cfop: "1102", sourceOrigin: "REAL_SEFAZ" } });
  return { user, company, officeId, closing, preparation };
}

async function cleanup(data) {
  await prisma.fiscalExport.deleteMany({ where: { companyId: data.company.id } });
  await prisma.monthlyTaxClosing.delete({ where: { id: data.closing.id } });
  await prisma.company.delete({ where: { id: data.company.id } });
  await prisma.user.delete({ where: { id: data.user.id } });
}

test("exportações locais são determinísticas, imutáveis e separadas por tipo", async () => {
  const data = await fixture();
  try {
    const first = await generateFiscalExport(data.company.id, data.officeId, data.preparation.id, "SPED_FISCAL", { userId: data.user.id });
    const repeated = await generateFiscalExport(data.company.id, data.officeId, data.preparation.id, "SPED_FISCAL", { userId: data.user.id });
    const sintegra = await generateFiscalExport(data.company.id, data.officeId, data.preparation.id, "SINTEGRA", { userId: data.user.id });
    assert.equal(repeated.id, first.id);
    assert.equal(repeated.contentHash, first.contentHash);
    assert.notEqual(sintegra.contentHash, first.contentHash);
    assert.match(first.content, /\|0000\|CONFERENCIA\|202607\|/);
    assert.match(sintegra.content, /^10\|CONFERENCIA\|202607/m);
    assert.equal(first.content.includes("SEFAZ"), false);
  } finally { await cleanup(data); }
});

test("exportação bloqueia preparation stale, fechamento não aprovado e issue bloqueante", async () => {
  const data = await fixture();
  try {
    await prisma.fiscalBookPreparation.update({ where: { id: data.preparation.id }, data: { status: "STALE" } });
    await assert.rejects(() => validateFiscalExport(data.company.id, data.officeId, data.preparation.id), { code: "FISCAL_EXPORT_PREPARATION_STALE" });
    await prisma.fiscalBookPreparation.update({ where: { id: data.preparation.id }, data: { status: "READY" } });
    await prisma.monthlyTaxClosing.update({ where: { id: data.closing.id }, data: { status: "REOPENED" } });
    await assert.rejects(() => validateFiscalExport(data.company.id, data.officeId, data.preparation.id), { code: "FISCAL_EXPORT_CLOSING_NOT_APPROVED" });
    await prisma.monthlyTaxClosing.update({ where: { id: data.closing.id }, data: { status: "APPROVED" } });
    await prisma.fiscalBookIssue.create({ data: { preparationId: data.preparation.id, companyId: data.company.id, severity: "BLOCKING", code: "TAX_SETTINGS_REQUIRED", title: "Tax", message: "Tax settings", status: "OPEN" } });
    await assert.rejects(() => validateFiscalExport(data.company.id, data.officeId, data.preparation.id), { code: "FISCAL_EXPORT_BLOCKING_ISSUES" });
  } finally { await cleanup(data); }
});
