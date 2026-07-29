import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/modules/auth/auth.service.js";

let server, baseUrl, owner, viewer, company, viewerCompany, product, token, viewerToken;
const ids = [];
const request = (path, options = {}, auth = token) => fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...options.headers } });
const json = (response) => response.json();

before(async () => {
  const fixture = randomUUID().replaceAll("-", "");
  owner = await prisma.user.create({ data: { name: "Inventory HTTP", email: `inventory-http-${fixture}@test.invalid`, passwordHash: "test" } });
  viewer = await prisma.user.create({ data: { name: "Inventory Viewer", email: `inventory-viewer-${fixture}@test.invalid`, passwordHash: "test", role: "VIEWER" } });
  company = await prisma.company.create({ data: { ownerId: owner.id, legalName: "Inventory HTTP", cnpj: fixture.slice(0, 14) } });
  viewerCompany = await prisma.company.create({ data: { ownerId: viewer.id, legalName: "Inventory Viewer", cnpj: fixture.slice(14, 28) } });
  product = await prisma.product.create({ data: { companyId: company.id, code: `HTTP-${fixture}`, name: "Produto HTTP", price: 1 } });
  token = signToken(owner);
  viewerToken = signToken(viewer);
  await new Promise((resolve) => { server = createServer(app).listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await prisma.auditLog.deleteMany({ where: { companyId: { in: [company.id, viewerCompany.id] } } });
  await prisma.inventoryCountItem.deleteMany({ where: { companyId: company.id } });
  await prisma.inventoryCount.deleteMany({ where: { companyId: company.id } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId: company.id } });
  await prisma.inventoryTransferItem.deleteMany({ where: { companyId: company.id } });
  await prisma.inventoryTransfer.deleteMany({ where: { companyId: company.id } });
  await prisma.inventoryReservation.deleteMany({ where: { companyId: company.id } });
  await prisma.inventoryBalance.deleteMany({ where: { companyId: company.id } });
  await prisma.warehouse.deleteMany({ where: { companyId: { in: [company.id, viewerCompany.id] } } });
  await prisma.product.deleteMany({ where: { companyId: company.id } });
  await prisma.company.deleteMany({ where: { id: { in: [company.id, viewerCompany.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, viewer.id] } } });
  await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
});

test("HTTP estoque aplica autenticação, VIEWER, isolamento e fluxos reais", async () => {
  assert.equal((await request(`/companies/${company.id}/operation/inventory/summary`, {}, null)).status, 401);
  assert.equal((await request(`/companies/${viewerCompany.id}/operation/inventory/warehouses`, { method: "POST", body: JSON.stringify({ code: "X", name: "X" }) }, viewerToken)).status, 403);
  const sourceResponse = await request(`/companies/${company.id}/operation/inventory/warehouses`, { method: "POST", body: JSON.stringify({ code: "A", name: "Origem", isDefault: true }) });
  assert.equal(sourceResponse.status, 201); const source = await json(sourceResponse); ids.push(source.id);
  const destination = await json(await request(`/companies/${company.id}/operation/inventory/warehouses`, { method: "POST", body: JSON.stringify({ code: "B", name: "Destino" }) }));
  const foreign = await prisma.warehouse.create({ data: { companyId: viewerCompany.id, code: "F", name: "Foreign" } });
  assert.equal((await request(`/companies/${company.id}/operation/inventory/warehouses/${foreign.id}`)).status, 404);
  const adjustment = await request(`/companies/${company.id}/operation/inventory/adjustments`, { method: "POST", body: JSON.stringify({ warehouseId: source.id, productId: product.id, quantity: 10, unitCost: 2, reason: "Carga HTTP", idempotencyKey: `http:${randomUUID()}` }) });
  assert.equal(adjustment.status, 201);
  const balances = await json(await request(`/companies/${company.id}/operation/inventory/balances`));
  assert.equal(balances.data.length, 1);
  const reservation = await json(await request(`/companies/${company.id}/operation/inventory/reservations`, { method: "POST", body: JSON.stringify({ warehouseId: source.id, productId: product.id, quantity: 1, sourceType: "HTTP", externalKey: `http-res:${randomUUID()}` }) }));
  assert.equal(reservation.status, "ACTIVE");
  const transfer = await json(await request(`/companies/${company.id}/operation/inventory/transfers`, { method: "POST", body: JSON.stringify({ sourceWarehouseId: source.id, destinationWarehouseId: destination.id, items: [{ productId: product.id, quantity: 2 }] }) }));
  assert.equal((await request(`/companies/${company.id}/operation/inventory/transfers/${transfer.id}/complete`, { method: "POST" })).status, 200);
  const count = await json(await request(`/companies/${company.id}/operation/inventory/counts`, { method: "POST", body: JSON.stringify({ warehouseId: destination.id }) }));
  assert.equal(count.status, "COUNTING");
});
