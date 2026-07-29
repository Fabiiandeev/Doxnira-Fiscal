import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/modules/auth/auth.service.js";

let server, baseUrl, owner, viewer, company, viewerCompany, token, viewerToken;
const request = (path, options = {}, auth = token) => fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } });
before(async () => {
  const fixture = randomUUID().replaceAll("-", "");
  owner = await prisma.user.create({ data: { name: "Automation HTTP", email: `auto-http-${fixture}@test.invalid`, passwordHash: "test" } });
  viewer = await prisma.user.create({ data: { name: "Automation Viewer", email: `auto-viewer-${fixture}@test.invalid`, passwordHash: "test", role: "VIEWER" } });
  company = await prisma.company.create({ data: { ownerId: owner.id, legalName: "Automation HTTP", cnpj: fixture.slice(0, 14) } });
  viewerCompany = await prisma.company.create({ data: { ownerId: viewer.id, legalName: "Automation Viewer", cnpj: fixture.slice(14, 28) } });
  token = signToken(owner); viewerToken = signToken(viewer);
  await new Promise((resolve) => { server = createServer(app).listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await prisma.operationAutomationRun.deleteMany({ where: { companyId: company.id } });
  await prisma.operationAutomation.deleteMany({ where: { companyId: company.id } });
  await prisma.alert.deleteMany({ where: { companyId: company.id } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: [company.id, viewerCompany.id] } } });
  await prisma.company.deleteMany({ where: { id: { in: [company.id, viewerCompany.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, viewer.id] } } });
  await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
});
test("HTTP dashboard e automação aplicam auth, VIEWER, isolamento e execução", async () => {
  assert.equal((await request(`/companies/${company.id}/operation/dashboard`, {}, null)).status, 401);
  assert.equal((await request(`/companies/${viewerCompany.id}/operation/automations`, { method: "POST", body: "{}" }, viewerToken)).status, 403);
  const body = { name: "HTTP Rule", module: "PURCHASE", event: "PURCHASE_APPROVED", conditions: [{ field: "amount", operator: "GREATER_THAN", value: 10, valueType: "NUMBER", group: "default" }], conditionLogic: "AND", actions: [{ type: "CREATE_ALERT", config: { title: "HTTP Alert" } }], status: "ACTIVE", cooldownSeconds: 0, maxDepth: 5 };
  const response = await request(`/companies/${company.id}/operation/automations`, { method: "POST", body: JSON.stringify(body) });
  assert.equal(response.status, 201); const rule = await response.json();
  assert.equal((await request(`/companies/${viewerCompany.id}/operation/automations/${rule.id}`, {}, viewerToken)).status, 404);
  const run = await request(`/companies/${company.id}/operation/automations/${rule.id}/run`, { method: "POST", body: JSON.stringify({ payload: { amount: 20, password: "secret" }, idempotencyKey: `http:${randomUUID()}`, depth: 0 }) });
  assert.equal(run.status, 201); const runBody = await run.json();
  assert.equal(runBody.status, "COMPLETED"); assert.equal(runBody.payload.password, "[REDACTED]");
  const dashboard = await request(`/companies/${company.id}/operation/dashboard`);
  assert.equal(dashboard.status, 200); assert.equal((await dashboard.json()).indicators.activeAutomations, 1);
});
