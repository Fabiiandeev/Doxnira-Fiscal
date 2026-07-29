import assert from "node:assert/strict";
import test from "node:test";

import { createMarketplaceHttpClient } from "../../src/modules/marketplace/marketplace.adapter.js";
import { decryptMarketplaceToken, encryptMarketplaceToken } from "../../src/modules/marketplace/marketplace-crypto.js";
import { marketplaceErrorCodes } from "../../src/modules/marketplace/marketplace-errors.js";
import { createOAuthState, verifyOAuthState } from "../../src/modules/marketplace/marketplace-oauth-state.js";
import { createMercadoLivreAdapter } from "../../src/modules/marketplace/mercado-livre.adapter.js";
import { createMarketplaceService } from "../../src/modules/marketplace/marketplace.service.js";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost/callback",
};

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("AES-256-GCM encrypts and decrypts without exposing plaintext", () => {
  const key = "a".repeat(32);
  const encrypted = encryptMarketplaceToken("secret-token", key);
  assert.notEqual(encrypted, "secret-token");
  assert.equal(decryptMarketplaceToken(encrypted, key), "secret-token");
  const parts = encrypted.split(".");
  parts[1] = `${parts[1][0] === "A" ? "B" : "A"}${parts[1].slice(1)}`;
  assert.throws(() => decryptMarketplaceToken(parts.join("."), key));
});

test("OAuth state is signed, expiring, tamper-proof and single-use", () => {
  const signingSecret = "s".repeat(32);
  const state = createOAuthState({ companyId: "company", userId: "user", now: 100, ttlMs: 100, signingSecret });
  assert.equal(verifyOAuthState(state, { now: 150, signingSecret }).companyId, "company");
  assert.throws(() => verifyOAuthState(state, { now: 150, signingSecret }), { code: marketplaceErrorCodes.OAUTH_STATE_INVALID });
  assert.throws(() => verifyOAuthState(`${state}x`, { now: 150, signingSecret }), { code: marketplaceErrorCodes.OAUTH_STATE_INVALID });
  const expired = createOAuthState({ companyId: "company", userId: "user", now: 100, ttlMs: 10, signingSecret });
  assert.throws(() => verifyOAuthState(expired, { now: 200, signingSecret }), { code: marketplaceErrorCodes.OAUTH_STATE_EXPIRED });
});

test("Mercado Livre authorization URL carries configured OAuth parameters", () => {
  const adapter = createMercadoLivreAdapter({ config, fetchImpl: async () => jsonResponse({}) });
  const url = new URL(adapter.getAuthorizationUrl("signed-state"));
  assert.equal(url.searchParams.get("client_id"), config.clientId);
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(url.searchParams.get("state"), "signed-state");
});

test("Mercado Livre exchanges code and refresh token using native fetch", async () => {
  const bodies = [];
  const adapter = createMercadoLivreAdapter({
    config,
    fetchImpl: async (_url, init) => {
      bodies.push(String(init.body));
      return jsonResponse({ access_token: "access", refresh_token: "refresh" });
    },
  });
  await adapter.exchangeAuthorizationCode("code");
  await adapter.refreshAccessToken("refresh");
  assert.match(bodies[0], /grant_type=authorization_code/);
  assert.match(bodies[1], /grant_type=refresh_token/);
});

test("HTTP client maps 401, 403 and 429 with Retry-After", async () => {
  for (const [status, code] of [
    [401, marketplaceErrorCodes.TOKEN_EXPIRED],
    [403, marketplaceErrorCodes.PERMISSION_DENIED],
  ]) {
    const request = createMarketplaceHttpClient({ fetchImpl: async () => jsonResponse({ message: "failed" }, status) });
    await assert.rejects(request("https://example.test"), { code });
  }
  const request = createMarketplaceHttpClient({
    fetchImpl: async () => jsonResponse({ message: "slow down" }, 429, { "retry-after": "5" }),
  });
  await assert.rejects(request("https://example.test"), (error) => {
    assert.equal(error.code, marketplaceErrorCodes.RATE_LIMITED);
    assert.equal(error.details[0].retryAfter, "5");
    return true;
  });
});

test("HTTP client maps 404 and provider network failures", async () => {
  const notFound = createMarketplaceHttpClient({
    fetchImpl: async () => jsonResponse({ message: "missing" }, 404),
  });
  await assert.rejects(notFound("https://example.test"), {
    code: marketplaceErrorCodes.RESOURCE_NOT_FOUND,
  });

  const unavailable = createMarketplaceHttpClient({
    fetchImpl: async () => {
      throw new TypeError("network down");
    },
  });
  await assert.rejects(unavailable("https://example.test"), {
    code: marketplaceErrorCodes.PROVIDER_UNAVAILABLE,
  });
});

test("HTTP client aborts requests after timeout", async () => {
  const request = createMarketplaceHttpClient({
    timeoutMs: 5,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  });
  await assert.rejects(request("https://example.test"), { code: marketplaceErrorCodes.PROVIDER_UNAVAILABLE });
});

test("listing pagination stops at provider total", async () => {
  let calls = 0;
  const adapter = createMercadoLivreAdapter({
    config,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({
        results: calls === 1 ? ["A", "B"] : ["C"],
        paging: { total: 3 },
      });
    },
  });
  assert.deepEqual(await adapter.listListings("token", "seller", { limit: 2 }), ["A", "B", "C"]);
  assert.equal(calls, 2);
});

test("service enforces company isolation when resolving a connection", async () => {
  const lookups = [];
  const service = createMarketplaceService({
    enqueueSync: async () => {},
    repository: {
      findConnection: async (...args) => {
        lookups.push(args);
        return null;
      },
    },
  });

  await assert.rejects(service.getConnection("company-a", "connection-b"), {
    code: marketplaceErrorCodes.CONNECTION_NOT_FOUND,
  });
  assert.deepEqual(lookups, [["company-a", "connection-b", undefined]]);
});

test("service prevents concurrent full synchronization", async () => {
  const service = createMarketplaceService({
    enqueueSync: async () => {},
    repository: {
      findConnection: async () => ({ id: "connection", companyId: "company", accessToken: "encrypted" }),
      createSyncJob: async () => ({ running: { id: "running-job" } }),
    },
  });

  await assert.rejects(service.startSync("company", "connection", "same-operation"), {
    code: marketplaceErrorCodes.SYNC_ALREADY_RUNNING,
  });
});

test("service disconnects only the company-scoped connection", async () => {
  const calls = [];
  const service = createMarketplaceService({
    repository: {
      findConnection: async (companyId, connectionId) => ({ id: connectionId, companyId }),
      disconnect: async (...args) => calls.push(args),
    },
  });

  await service.disconnect("company-a", "connection-a");
  assert.deepEqual(calls, [["company-a", "connection-a"]]);
});

test("service matches and deduplicates webhook through the repository", async () => {
  const recorded = [];
  const payload = { id: "event-1", user_id: 123, topic: "orders_v2" };
  const service = createMarketplaceService({
    adapter: {
      handleWebhook: () => ({
        userId: "123",
        providerEventId: "event-1",
        topic: "orders_v2",
        payload,
      }),
    },
    repository: {
      findByExternalAccount: async (provider, accountId) => {
        assert.equal(provider, "mercado_livre");
        assert.equal(accountId, "123");
        return { id: "connection", companyId: "company" };
      },
      recordWebhook: async (data) => recorded.push(data),
    },
  });

  assert.deepEqual(await service.processWebhook(payload), { accepted: true, matched: true });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].providerEventId, "event-1");
  assert.equal(recorded[0].companyId, "company");
});
