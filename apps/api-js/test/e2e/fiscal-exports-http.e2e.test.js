import assert from "node:assert/strict";
import { createServer } from "node:http";
import crypto from "node:crypto";
import test, { after, before } from "node:test";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";

let server, baseUrl, user, company, otherCompany, office, preparation, token, exported;
const uuid = () => crypto.randomUUID();
const request = async (path, init = {}) => { const response = await fetch(`${baseUrl}${path}`, init); const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text(); return { response, body }; };
const headers = () => ({ authorization: `Bearer ${token}`, "x-accountant-office-id": office.id, "content-type": "application/json" });
async function seedPreparation(targetCompany = company) {
  const closing = await prisma.monthlyTaxClosing.create({ data: { companyId: targetCompany.id, officeId: office.id, periodYear: 2026, periodMonth: 7, status: "APPROVED", approvedAt: new Date() } });
  const value = await prisma.fiscalBookPreparation.create({ data: { companyId: targetCompany.id, officeId: office.id, monthlyTaxClosingId: closing.id, periodYear: 2026, periodMonth: 7, status: "READY", snapshotHash: crypto.createHash("sha256").update(uuid()).digest("hex") } });
  await prisma.fiscalBookPreparationDocument.create({ data: { preparationId: value.id, companyId: targetCompany.id, sourceType: "NFE", operationGroup: "NF_E_ENTRADA", accessKey: "1".repeat(44), model: "55", series: "1", number: "1", emissionDate: new Date(), participantDocument: "12345678000199", participantName: "Fornecedor", totalAmount: 1 } });
  return value;
}
before(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "fiscal_exports", "fiscal_book_preparation_items", "fiscal_book_preparation_documents", "fiscal_book_issues", "fiscal_book_preparations", "monthly_tax_closings", "accountant_user_company_access", "accountant_company_links", "accountant_memberships", "accountant_offices", "companies", "users" CASCADE');
  const passwordHash = await bcrypt.hash("TestPassword#2026", 10); user = await prisma.user.create({ data: { name: "Exports", email: `exports-${uuid()}@test.local`, passwordHash } });
  company = await prisma.company.create({ data: { ownerId: user.id, legalName: "Exports A", cnpj: "3".repeat(14), environment: "homologation" } }); otherCompany = await prisma.company.create({ data: { ownerId: user.id, legalName: "Exports B", cnpj: "4".repeat(14), environment: "homologation" } });
  office = await prisma.accountantOffice.create({ data: { name: "Office exports", cnpj: "5".repeat(14) } }); const membership = await prisma.accountantMembership.create({ data: { officeId: office.id, userId: user.id, role: "ADMIN", status: "ACTIVE" } });
  await prisma.accountantCompanyLink.createMany({ data: [{ officeId: office.id, companyId: company.id, status: "ACTIVE" }, { officeId: office.id, companyId: otherCompany.id, status: "ACTIVE" }] }); await prisma.accountantUserCompanyAccess.createMany({ data: [{ membershipId: membership.id, companyId: company.id, accessLevel: "FULL", permissions: [] }, { membershipId: membership.id, companyId: otherCompany.id, accessLevel: "FULL", permissions: [] }] });
  preparation = await seedPreparation(); server = createServer(app); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: user.email, password: "TestPassword#2026" }) }); token = login.body.token;
});
after(async () => { if (server) { server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); } await prisma.$executeRawUnsafe('TRUNCATE TABLE "fiscal_exports", "fiscal_book_preparation_items", "fiscal_book_preparation_documents", "fiscal_book_issues", "fiscal_book_preparations", "monthly_tax_closings", "accountant_user_company_access", "accountant_company_links", "accountant_memberships", "accountant_offices", "companies", "users" CASCADE'); await disconnectDatabase(); });

test("exports HTTP: FULL gera, lista, detalha, baixa e audita", async () => {
  const create = await request(`/api/accountant/companies/${company.id}/fiscal-exports`, { method: "POST", headers: headers(), body: JSON.stringify({ preparationId: preparation.id, type: "SPED_FISCAL" }) }); assert.equal(create.response.status, 201); exported = create.body;
  const list = await request(`/api/accountant/companies/${company.id}/fiscal-exports`, { headers: headers() }); assert.equal(list.response.status, 200); assert.ok(list.body.data.some((item) => item.id === exported.id));
  const detail = await request(`/api/accountant/companies/${company.id}/fiscal-exports/${exported.id}`, { headers: headers() }); assert.equal(detail.response.status, 200); assert.equal(detail.body.contentHash, exported.contentHash);
  const download = await request(`/api/accountant/companies/${company.id}/fiscal-exports/${exported.id}/download`, { headers: headers() }); assert.equal(download.response.status, 200); assert.match(download.response.headers.get("content-disposition"), /attachment/); assert.match(download.response.headers.get("content-type"), /text\/plain/); assert.ok(download.body.includes("|0000|CONFERENCIA|"));
  const audits = await prisma.auditLog.findMany({ where: { entityId: exported.id } }); assert.ok(audits.some((item) => item.action === "accountant.fiscal_export.generated")); assert.ok(audits.some((item) => item.action === "accountant.fiscal_export.downloaded"));
});
test("exports HTTP: escopo e grants impedem vazamento", async () => {
  const noAuth = await request(`/api/accountant/companies/${company.id}/fiscal-exports/${exported.id}/download`); assert.equal(noAuth.response.status, 401);
  const cross = await request(`/api/accountant/companies/${otherCompany.id}/fiscal-exports/${exported.id}`, { headers: headers() }); assert.ok([403, 404].includes(cross.response.status));
  const access = await prisma.accountantUserCompanyAccess.findFirst({ where: { companyId: company.id } }); await prisma.accountantUserCompanyAccess.update({ where: { id: access.id }, data: { accessLevel: "RESTRICTED", permissions: ["fiscal.export.read"] } });
  const read = await request(`/api/accountant/companies/${company.id}/fiscal-exports`, { headers: headers() }); assert.equal(read.response.status, 200);
  const generate = await request(`/api/accountant/companies/${company.id}/fiscal-exports`, { method: "POST", headers: headers(), body: JSON.stringify({ preparationId: preparation.id, type: "SINTEGRA" }) }); assert.equal(generate.response.status, 403);
  const deniedDownload = await request(`/api/accountant/companies/${company.id}/fiscal-exports/${exported.id}/download`, { headers: headers() }); assert.equal(deniedDownload.response.status, 403);
});
