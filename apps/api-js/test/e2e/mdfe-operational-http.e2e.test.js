import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { issueSession } from "../../src/modules/auth/session.service.js";

test("HTTP operacional MDF-e cadastra filial, condutor, veículo e padrões", async (context) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const user = await prisma.user.create({
    data: {
      name: "MDF-e Operational",
      email: `mdfe-operational-${suffix}@example.test`,
      passwordHash: "test",
    },
  });
  const otherUser = await prisma.user.create({
    data: {
      name: "Other Tenant",
      email: `mdfe-other-${suffix}@example.test`,
      passwordHash: "test",
    },
  });
  const company = await prisma.company.create({
    data: {
      ownerId: user.id,
      legalName: "MDF-e Operational Company",
      cnpj: `71${suffix.replace(/\D/g, "").padEnd(12, "7")}`.slice(0, 14),
      city: "Goiânia",
      uf: "GO",
      environment: "homologation",
    },
  });
  const otherCompany = await prisma.company.create({
    data: {
      ownerId: otherUser.id,
      legalName: "Other Company",
      cnpj: `72${suffix.replace(/\D/g, "").padEnd(12, "8")}`.slice(0, 14),
      environment: "homologation",
    },
  });
  const foreignDriver = await prisma.driver.create({
    data: {
      companyId: otherCompany.id,
      name: "Foreign Driver",
      cpf: "99999999999",
    },
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [company.id, otherCompany.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, otherCompany.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/companies/${company.id}`;
  const token = issueSession(user).token;
  const call = async (path, init = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });
    const body = await response.json();
    return { response, body };
  };

  const initial = await call("/establishments");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.data.length, 1);
  assert.equal(initial.body.data[0].isHeadquarters, true);

  const branch = await call("/establishments", {
    method: "POST",
    body: JSON.stringify({
      code: "FILIAL-01",
      legalName: "Filial MDF-e",
      taxId: "12345678000199",
      cityCode: "3550308",
      city: "São Paulo",
      state: "SP",
    }),
  });
  assert.equal(branch.response.status, 201);

  const driver = await call("/drivers", {
    method: "POST",
    body: JSON.stringify({ name: "Maria Condutora", cpf: "12345678901", licenseType: "E" }),
  });
  assert.equal(driver.response.status, 201);

  const vehicle = await call("/fleet-vehicles", {
    method: "POST",
    body: JSON.stringify({ plate: "ABC1D23", plateState: "GO", rntrc: "12345678" }),
  });
  assert.equal(vehicle.response.status, 201);

  const setting = await call("/mdfe-settings", {
    method: "PUT",
    body: JSON.stringify({
      establishmentId: branch.body.id,
      defaultDriverId: driver.body.id,
      defaultVehicleId: vehicle.body.id,
      defaultSeries: "2",
      quickModeEnabled: true,
    }),
  });
  assert.equal(setting.response.status, 201);
  assert.equal(setting.body.establishmentId, branch.body.id);

  const listed = await call("/mdfe-settings");
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.data[0].defaultDriver.id, driver.body.id);
  assert.equal(listed.body.data[0].defaultVehicle.id, vehicle.body.id);

  const crossTenant = await call("/mdfe-settings", {
    method: "PUT",
    body: JSON.stringify({ defaultDriverId: foreignDriver.id }),
  });
  assert.equal(crossTenant.response.status, 400);
  assert.equal(crossTenant.body.code, "TENANT_REFERENCE_INVALID");
});
