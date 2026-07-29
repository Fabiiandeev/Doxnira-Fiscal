import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test, { after, before } from "node:test";

import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/modules/auth/auth.service.js";

let server;
let baseUrl;
let owner;
let outsider;
let viewer;
let company;
let viewerCompany;
let token;
let viewerToken;

async function request(path, options = {}, auth = token) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      ...options.headers,
    },
  });
}

before(async () => {
  const fixture = randomUUID().replaceAll("-", "");
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database`;
  assert.equal(identity.database, "ns_fiscal_cloud_test");
  owner = await prisma.user.create({
    data: { name: "MDF-e HTTP Owner", email: `mdfe-http-${fixture}@test.invalid`, passwordHash: "x" },
  });
  outsider = await prisma.user.create({
    data: { name: "MDF-e HTTP Outsider", email: `mdfe-http-out-${fixture}@test.invalid`, passwordHash: "x" },
  });
  viewer = await prisma.user.create({
    data: { name: "MDF-e HTTP Viewer", email: `mdfe-http-view-${fixture}@test.invalid`, passwordHash: "x", role: "VIEWER" },
  });
  company = await prisma.company.create({
    data: { ownerId: owner.id, legalName: "MDF-e HTTP Co", cnpj: fixture.slice(0, 14), environment: "homologation" },
  });
  viewerCompany = await prisma.company.create({
    data: { ownerId: viewer.id, legalName: "MDF-e Viewer Co", cnpj: fixture.slice(14, 28), environment: "homologation" },
  });
  token = signToken(owner);
  viewerToken = signToken(viewer);
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await prisma.mdfeDraft.deleteMany({ where: { companyId: { in: [company.id, viewerCompany.id] } } });
  await prisma.company.deleteMany({ where: { id: { in: [company.id, viewerCompany.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, outsider.id, viewer.id] } } });
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
});

test("HTTP MDF-e cobre auth, RBAC, fila automática, CRUD, validação e idempotência", async () => {
  const root = `/companies/${company.id}/mdfe`;
  assert.equal((await request(root, {}, null)).status, 401);
  assert.equal((await request(root, {}, signToken(outsider))).status, 404);
  assert.equal(
    (await request(`/companies/${viewerCompany.id}/mdfe`, {
      method: "POST", body: JSON.stringify({ series: "1" }),
    }, viewerToken)).status,
    403,
  );
  assert.equal((await request(`${root}/eligible-nfes`, {}, null)).status, 401);
  const eligibleResponse = await request(`${root}/eligible-nfes`);
  assert.equal(eligibleResponse.status, 200);
  assert.deepEqual((await eligibleResponse.json()).data, []);
  assert.equal(
    (await request(`${root}/prepare-from-nfes`, {
      method: "POST",
      body: JSON.stringify({ nfeIds: [randomUUID()] }),
    })).status,
    400,
  );
  assert.equal(
    (await request(`${root}/prepare-from-nfes`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ nfeIds: [] }),
    })).status,
    400,
  );

  const createResponse = await request(root, {
    method: "POST",
    body: JSON.stringify({
      series: "1",
      issuerType: "TRANSPORTADOR_CARGA_PROPRIA",
      carrierType: "PROPRIO",
      modal: "RODOVIARIO",
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.status, "DRAFT");

  const progressiveSave = await request(`${root}/${created.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      currentStep: 1,
      loadingMunicipalities: [],
      unloadingCities: [],
      routeStates: [],
      drivers: [],
      fiscalDocuments: [],
      insurances: [],
    }),
  });
  assert.equal(progressiveSave.status, 200);

  const patchResponse = await request(`${root}/${created.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      loadingState: "SP",
      unloadingState: "RJ",
      loadingMunicipalities: [{ stateCode: "SP", cityCode: "3550308", cityName: "São Paulo" }],
      unloadingCities: [{ stateCode: "RJ", cityCode: "3304557", cityName: "Rio de Janeiro" }],
    }),
  });
  assert.equal(patchResponse.status, 200);
  assert.equal((await patchResponse.json()).loadingState, "SP");

  const listResponse = await request(root);
  assert.equal(listResponse.status, 200);
  assert.ok((await listResponse.json()).data.some((item) => item.id === created.id));

  const validationResponse = await request(`${root}/${created.id}/validate`, { method: "POST" });
  assert.equal(validationResponse.status, 200);
  assert.equal((await validationResponse.json()).valid, false);

  const authorizeWithoutKey = await request(`${root}/${created.id}/authorize`, { method: "POST" });
  assert.equal(authorizeWithoutKey.status, 400);
  assert.equal((await authorizeWithoutKey.json()).code, "IDEMPOTENCY_KEY_REQUIRED");
});
