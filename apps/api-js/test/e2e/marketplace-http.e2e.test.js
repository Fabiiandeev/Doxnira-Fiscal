import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";

const nativeFetch = globalThis.fetch;
let providerMode = "success";
globalThis.fetch = async (input) => {
  const url = String(input);
  if (!url.startsWith("https://api.mercadolibre.com/")) {
    throw new Error(`Unexpected external request: ${url}`);
  }
  if (providerMode === "denied") {
    return new Response(JSON.stringify({ message: "permission denied" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  if (url.endsWith("/users/me")) {
    return new Response(JSON.stringify({ id: 12345, nickname: "TEST_ACCOUNT" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ results: [], paging: { total: 0 } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

process.env.MERCADO_LIVRE_CLIENT_ID = "temporary-test-client";
process.env.MERCADO_LIVRE_CLIENT_SECRET = "temporary-test-secret";
process.env.MERCADO_LIVRE_REDIRECT_URI = "http://localhost:3000/commerce/marketplaces";
process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY = "temporary-marketplace-test-key-32";

const { app } = await import("../../src/app.js");
const { disconnectDatabase, prisma } = await import("../../src/config/prisma.js");
const { signToken } = await import("../../src/modules/auth/auth.service.js");
const { encryptMarketplaceToken } = await import("../../src/modules/marketplace/marketplace-crypto.js");
const { marketplaceRepository } = await import("../../src/modules/marketplace/marketplace.repository.js");

let server;
let baseUrl;
let owner;
let outsider;
let company;
let otherCompany;
let connection;

function cnpjFrom(value, offset = 0) {
  const digits = Buffer.from(value).toString("hex").replace(/\D/g, "");
  return (digits.slice(offset, offset + 14) + "12345678901234").slice(0, 14);
}

async function request(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return nativeFetch(`${baseUrl}${path}`, { ...options, headers });
}

before(async () => {
  const fixture = randomUUID();
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database`;
  assert.equal(identity.database, "ns_fiscal_cloud_test");

  owner = await prisma.user.create({
    data: {
      name: "HTTP Marketplace Owner",
      email: `marketplace-owner-${fixture}@test.invalid`,
      passwordHash: "temporary-test-hash",
    },
  });
  outsider = await prisma.user.create({
    data: {
      name: "HTTP Marketplace Outsider",
      email: `marketplace-outsider-${fixture}@test.invalid`,
      passwordHash: "temporary-test-hash",
    },
  });
  company = await prisma.company.create({
    data: {
      ownerId: owner.id,
      legalName: `Marketplace HTTP ${fixture}`,
      cnpj: cnpjFrom(fixture),
    },
  });
  otherCompany = await prisma.company.create({
    data: {
      ownerId: owner.id,
      legalName: `Marketplace HTTP Other ${fixture}`,
      cnpj: cnpjFrom(fixture, 8),
    },
  });
  connection = await prisma.marketplaceConnection.create({
    data: {
      companyId: company.id,
      provider: "mercado_livre",
      name: "Conta HTTP simulada",
      status: "connected",
      externalAccountId: "12345",
      accessToken: encryptMarketplaceToken("temporary-http-token"),
      refreshToken: encryptMarketplaceToken("temporary-http-refresh"),
      connectedAt: new Date(),
      metadata: {},
    },
  });

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  if (company) {
    await prisma.company.deleteMany({ where: { id: { in: [company.id, otherCompany.id] } } });
  }
  if (owner) {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, outsider.id] } } });
  }
  await disconnectDatabase();
  globalThis.fetch = nativeFetch;
  delete process.env.MERCADO_LIVRE_CLIENT_ID;
  delete process.env.MERCADO_LIVRE_CLIENT_SECRET;
  delete process.env.MERCADO_LIVRE_REDIRECT_URI;
  delete process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY;
});

test("rotas Marketplace cobrem autenticação, isolamento, sync, webhook e desconexão", async () => {
  const ownerToken = signToken(owner);
  const outsiderToken = signToken(outsider);
  const root = `/api/companies/${company.id}/commerce/marketplaces`;

  assert.equal((await request(root)).status, 401);
  assert.equal((await request(root, { token: outsiderToken })).status, 404);

  const listResponse = await request(root, { token: ownerToken });
  assert.equal(listResponse.status, 200);
  const listBody = await listResponse.json();
  assert.equal(JSON.stringify(listBody).includes("accessToken"), false);
  assert.equal(JSON.stringify(listBody).includes("refreshToken"), false);

  const connectResponse = await request(`${root}/mercado-livre/connect`, { token: ownerToken });
  assert.equal(connectResponse.status, 200);
  assert.match(JSON.stringify(await connectResponse.json()), /auth\.mercadolivre\.com\.br/);

  const connectionResponse = await request(`${root}/${connection.id}`, { token: ownerToken });
  assert.equal(connectionResponse.status, 200);
  assert.equal(JSON.stringify(await connectionResponse.json()).includes("accessToken"), false);

  assert.equal(
    (await request(
      `/api/companies/${otherCompany.id}/commerce/marketplaces/${connection.id}`,
      { token: ownerToken },
    )).status,
    404,
  );

  const testResponse = await request(`${root}/${connection.id}/test`, {
    method: "POST",
    token: ownerToken,
  });
  assert.equal(testResponse.status, 200);

  providerMode = "denied";
  assert.equal(
    (await request(`${root}/${connection.id}/test`, { method: "POST", token: ownerToken })).status,
    403,
  );
  providerMode = "success";

  const idempotencyKey = `http-sync-${randomUUID()}`;
  const syncOptions = {
    method: "POST",
    token: ownerToken,
    headers: { "idempotency-key": idempotencyKey },
  };
  const firstSync = await request(`${root}/${connection.id}/sync`, syncOptions);
  const secondSync = await request(`${root}/${connection.id}/sync`, syncOptions);
  assert.equal(firstSync.status, 202);
  assert.equal(secondSync.status, 202);
  const firstSyncBody = await firstSync.json();
  const secondSyncBody = await secondSync.json();
  assert.equal(firstSyncBody.id, secondSyncBody.id);

  const webhook = {
    id: `http-webhook-${randomUUID()}`,
    user_id: 12345,
    topic: "orders_v2",
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal(
      (await request("/api/webhooks/marketplaces/mercado-livre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(webhook),
      })).status,
      202,
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    await prisma.marketplaceWebhookEvent.count({
      where: { connectionId: connection.id, providerEventId: webhook.id },
    }),
    1,
  );

  assert.equal(
    (await request("/api/webhooks/marketplaces/mercado-livre", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid-json",
    })).status,
    400,
  );

  assert.equal(
    (await request(`${root}/${connection.id}/disconnect`, {
      method: "POST",
      token: ownerToken,
    })).status,
    204,
  );
  const disconnected = await marketplaceRepository.findConnection(company.id, connection.id, {
    includeSecrets: true,
  });
  assert.equal(disconnected.accessToken, null);
  assert.equal(disconnected.refreshToken, null);
});
