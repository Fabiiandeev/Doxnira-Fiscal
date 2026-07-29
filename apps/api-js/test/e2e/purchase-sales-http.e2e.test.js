import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/modules/auth/auth.service.js";

let server, baseUrl, owner, viewer, company, viewerCompany, warehouse, product, supplier, client, token, viewerToken;
const request = (path, options = {}, auth = token) => fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } });
before(async () => {
  const fixture = randomUUID().replaceAll("-", "");
  owner = await prisma.user.create({ data: { name: "08B HTTP", email: `08b-http-${fixture}@test.invalid`, passwordHash: "test" } });
  viewer = await prisma.user.create({ data: { name: "08B Viewer", email: `08b-viewer-${fixture}@test.invalid`, passwordHash: "test", role: "VIEWER" } });
  company = await prisma.company.create({ data: { ownerId: owner.id, legalName: "08B HTTP", cnpj: fixture.slice(0,14) } });
  viewerCompany = await prisma.company.create({ data: { ownerId: viewer.id, legalName: "08B Viewer", cnpj: fixture.slice(14,28) } });
  warehouse = await prisma.warehouse.create({ data: { companyId: company.id, code: "HTTP", name: "HTTP" } });
  product = await prisma.product.create({ data: { companyId: company.id, code: `HTTP-${fixture}`, name: "HTTP Product", price: 20 } });
  supplier = await prisma.fornecedor.create({ data: { companyId: company.id, tipoPessoa: "PJ", razaoSocial: "HTTP Supplier", cnpj: fixture.slice(0,14) } });
  client = await prisma.client.create({ data: { ownerId: owner.id, companyId: company.id, tipoPessoa: "PJ", razaoSocial: "HTTP Client", cnpj: fixture.slice(0,14) } });
  token = signToken(owner); viewerToken = signToken(viewer);
  await new Promise((resolve) => { server = createServer(app).listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await prisma.auditLog.deleteMany({ where: { companyId: { in: [company.id, viewerCompany.id] } } });
  await prisma.inventoryReservation.deleteMany({ where: { companyId: company.id } }); await prisma.inventoryMovement.deleteMany({ where: { companyId: company.id } }); await prisma.inventoryBalance.deleteMany({ where: { companyId: company.id } });
  await prisma.salesOrderItem.deleteMany({ where: { companyId: company.id } }); await prisma.salesOrder.deleteMany({ where: { companyId: company.id } });
  await prisma.purchaseOrderItem.deleteMany({ where: { companyId: company.id } }); await prisma.purchaseOrder.deleteMany({ where: { companyId: company.id } });
  await prisma.client.deleteMany({ where: { companyId: company.id } }); await prisma.fornecedor.deleteMany({ where: { companyId: company.id } }); await prisma.product.deleteMany({ where: { companyId: company.id } }); await prisma.warehouse.deleteMany({ where: { companyId: company.id } });
  await prisma.company.deleteMany({ where: { id: { in: [company.id, viewerCompany.id] } } }); await prisma.user.deleteMany({ where: { id: { in: [owner.id, viewer.id] } } });
  await new Promise((resolve) => server.close(resolve)); await disconnectDatabase();
});
test("HTTP 08B protege mutações, isola recursos e opera compras e vendas", async () => {
  assert.equal((await request(`/companies/${company.id}/operation/purchases`, {}, null)).status, 401);
  assert.equal((await request(`/companies/${viewerCompany.id}/operation/purchases`, { method: "POST", body: "{}" }, viewerToken)).status, 403);
  const common = { warehouseId: warehouse.id, issueDate: new Date().toISOString(), totalAmount: 10, freightAmount: 0, discountAmount: 0, taxAmount: 0, items: [{ productId: product.id, quantity: 1, unitValue: 10, discountAmount: 0, taxAmount: 0 }] };
  const purchaseResponse = await request(`/companies/${company.id}/operation/purchases`, { method: "POST", body: JSON.stringify({ ...common, number: `PC-${randomUUID()}`, supplierId: supplier.id, installments: [{ number: "1", dueDate: new Date().toISOString(), amount: 10 }], attachments: [] }) });
  assert.equal(purchaseResponse.status, 201); const purchase = await purchaseResponse.json();
  assert.equal((await request(`/companies/${company.id}/operation/purchases/${randomUUID()}`)).status, 404);
  assert.equal((await request(`/companies/${company.id}/operation/purchases/${purchase.id}/submit`, { method: "POST", body: "{}" })).status, 200);
  assert.equal((await request(`/companies/${company.id}/operation/purchases/${purchase.id}/approve`, { method: "POST", body: "{}" })).status, 200);
  const saleResponse = await request(`/companies/${company.id}/operation/sales`, { method: "POST", body: JSON.stringify({ ...common, number: `PV-${randomUUID()}`, clientId: client.id, origin: "MANUAL" }) });
  assert.equal(saleResponse.status, 201); const sale = await saleResponse.json();
  assert.equal((await request(`/companies/${company.id}/operation/sales/${sale.id}/submit`, { method: "POST", body: "{}" })).status, 200);
  assert.equal((await request(`/companies/${company.id}/operation/sales/${sale.id}/approve`, { method: "POST", body: "{}" })).status, 200);
});
