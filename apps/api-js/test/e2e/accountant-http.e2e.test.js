import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/modules/auth/auth.service.js";

let server, baseUrl, user, company, foreignCompany, office, token;
const request = (path, options = {}, auth = token) => fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } });
before(async () => {
  const fixture = randomUUID().replaceAll("-", "");
  user = await prisma.user.create({ data: { name: "Accountant HTTP", email: `accountant-${fixture}@test.invalid`, passwordHash: "test" } });
  company = await prisma.company.create({ data: { ownerId: user.id, legalName: "Cliente Contábil", cnpj: fixture.slice(0, 14) } });
  foreignCompany = await prisma.company.create({ data: { ownerId: user.id, legalName: "Empresa sem Grant", cnpj: fixture.slice(14, 28) } });
  office = await prisma.accountantOffice.create({ data: { name: "Escritório HTTP", cnpj: fixture.slice(2, 16) } });
  const membership = await prisma.accountantMembership.create({ data: { officeId: office.id, userId: user.id, role: "OPERATOR" } });
  await prisma.accountantCompanyLink.create({ data: { officeId: office.id, companyId: company.id } });
  await prisma.accountantUserCompanyAccess.create({ data: { membershipId: membership.id, companyId: company.id, accessLevel: "FULL", permissions: [] } });
  token = signToken(user);
  await new Promise((resolve) => { server = createServer(app).listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await prisma.auditLog.deleteMany({ where: { companyId: company.id } });
  await prisma.accountantFiscalQueueItem.deleteMany({ where: { officeId: office.id } });
  await prisma.accountantUserCompanyAccess.deleteMany({ where: { membership: { officeId: office.id } } });
  await prisma.accountantCompanyLink.deleteMany({ where: { officeId: office.id } });
  await prisma.accountantMembership.deleteMany({ where: { officeId: office.id } });
  await prisma.accountantOffice.delete({ where: { id: office.id } });
  await prisma.company.deleteMany({ where: { id: { in: [company.id, foreignCompany.id] } } });
  await prisma.user.delete({ where: { id: user.id } });
  await new Promise((resolve) => server.close(resolve)); await disconnectDatabase();
});
test("HTTP Contabilidade aplica autenticação, grants, fila e auditoria", async () => {
  assert.equal((await request(`/accountant/offices/${office.id}/dashboard`, {}, null)).status, 401);
  assert.equal((await request(`/accountant/offices/${office.id}/dashboard?companyId=${foreignCompany.id}`)).status, 404);
  const dashboard = await request(`/accountant/offices/${office.id}/dashboard?companyId=${company.id}`);
  assert.equal(dashboard.status, 200);
  const created = await request(`/accountant/offices/${office.id}/fiscal-queue`, { method: "POST", body: JSON.stringify({ companyId: company.id, type: "FISCALAI", origin: "FISCAL_AI", title: "Ocorrência real", severity: "HIGH" }) });
  assert.equal(created.status, 201); const item = await created.json();
  assert.equal((await request(`/accountant/offices/${office.id}/fiscal-queue/${item.id}/resolve`, { method: "POST", body: "{}" })).status, 422);
  assert.equal((await request(`/accountant/offices/${office.id}/fiscal-queue/${item.id}/resolve`, { method: "POST", body: JSON.stringify({ reason: "Evidência conferida" }) })).status, 200);
  assert.equal(await prisma.auditLog.count({ where: { entityId: item.id } }), 2);
});
