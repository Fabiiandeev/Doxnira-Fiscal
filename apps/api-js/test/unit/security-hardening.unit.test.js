import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import jwt from "jsonwebtoken";

import { env } from "../../src/config/env.js";
import { CSRF_COOKIE_NAME, clearSessionCookies, csrfMatches, issueSession, sessionTokenFromRequest, setSessionCookies } from "../../src/modules/auth/session.service.js";
import { RedisRateLimitStore, buildRateLimitIdentity } from "../../src/middlewares/rate-limit.middleware.js";
import { evaluateReadiness } from "../../src/config/readiness.js";
import { csrfProtection } from "../../src/middlewares/csrf.middleware.js";

test("session cookie is httpOnly, bounded and sameSite", () => {
  const cookies = [];
  const response = { cookie: (name, value, options) => cookies.push({ name, value, options }) };
  const session = issueSession({ id: "user-1", email: "user@example.test", role: "ADMIN" });
  setSessionCookies(response, session);
  const authCookie = cookies.find((item) => item.name !== CSRF_COOKIE_NAME);
  assert.equal(authCookie.options.httpOnly, true);
  assert.equal(authCookie.options.path, "/");
  assert.equal(authCookie.options.sameSite, env.SESSION_COOKIE_SAME_SITE);
  assert.equal(authCookie.options.maxAge, env.SESSION_TTL_SECONDS * 1000);
  assert.equal(cookies.find((item) => item.name === CSRF_COOKIE_NAME).options.httpOnly, false);
  const payload = jwt.verify(session.token, env.JWT_SECRET);
  assert.equal(csrfMatches(payload, session.csrfToken), true);
  assert.equal(csrfMatches(payload, "invalid"), false);
  assert.equal("token" in { user: { id: "user-1" }, csrfToken: session.csrfToken }, false);
});

test("query and hash credentials never authenticate and logout expires cookies", () => {
  const request = {
    headers: { cookie: "" },
    query: { nsSession: "stolen", token: "stolen" },
    originalUrl: "/api/private?token=stolen#stolen",
    get: () => null,
  };
  assert.deepEqual(sessionTokenFromRequest(request), { token: null, transport: null });
  const cleared = [];
  clearSessionCookies({ clearCookie: (name, options) => cleared.push({ name, options }) });
  assert.ok(cleared.length >= 2);
  assert.ok(cleared.every((item) => item.options.path === "/"));
});

test("CSRF rejects absent, invalid and cross-origin tokens and accepts a bound token", () => {
  const session = issueSession({ id: "user-2", email: "u2@example.test", role: "ADMIN" });
  const payload = jwt.verify(session.token, env.JWT_SECRET);
  const run = ({ origin = env.CORS_ALLOWED_ORIGINS.split(",")[0], token = session.csrfToken } = {}) => {
    let error;
    let passed = false;
    csrfProtection({
      method: "POST", path: "/api/companies/c1/settings", auth: { transport: "cookie", payload },
      get: (name) => name === "origin" ? origin : name === "x-csrf-token" ? token : null,
    }, {}, (value) => { error = value; passed = !value; });
    return { error, passed };
  };
  assert.equal(run().passed, true);
  assert.equal(run({ token: null }).error.code, "CSRF_TOKEN_INVALID");
  assert.equal(run({ token: "invalid" }).error.code, "CSRF_TOKEN_INVALID");
  assert.equal(run({ origin: "https://evil.example" }).error.code, "CSRF_ORIGIN_REJECTED");
});

test("rate limit state is shared across two API store instances", async () => {
  const values = new Map();
  const sharedRedis = {
    async incr(key) { const next = Number(values.get(key) || 0) + 1; values.set(key, next); return next; },
    async expire() { return 1; },
    async ttl() { return 42; },
  };
  const apiA = new RedisRateLimitStore(sharedRedis);
  const apiB = new RedisRateLimitStore(sharedRedis);
  assert.equal((await apiA.consume("shared", 60_000)).count, 1);
  assert.equal((await apiB.consume("shared", 60_000)).count, 2);
  assert.equal((await apiA.consume("shared", 60_000)).retryAfter, 42);
});

test("rate keys isolate user and company and ignore an untrusted forwarding header", () => {
  const base = { ip: "10.0.0.8", user: { id: "u1" }, params: { companyId: "c1" }, route: { path: "/x" }, path: "/x" };
  const key = buildRateLimitIdentity(base, "AUTH_STRICT");
  assert.notEqual(key, buildRateLimitIdentity({ ...base, params: { companyId: "c2" } }, "AUTH_STRICT"));
  assert.equal(key, buildRateLimitIdentity({ ...base, headers: { "x-forwarded-for": "1.1.1.1" } }, "AUTH_STRICT"));
});

test("readiness requires dependencies, worker when required, and stops during shutdown", () => {
  const up = { database: "up", redis: "up", prisma: "up", worker: "up" };
  assert.equal(evaluateReadiness(up, { workerRequired: true }), true);
  for (const dependency of ["database", "redis", "prisma", "worker"]) {
    assert.equal(evaluateReadiness({ ...up, [dependency]: "down" }, { workerRequired: true }), false);
  }
  assert.equal(evaluateReadiness({ ...up, worker: "disabled" }, { workerRequired: false }), true);
  assert.equal(evaluateReadiness(up, { workerRequired: true, shuttingDown: true }), false);
});

test("frontend has no URL or browser-storage session transport", async () => {
  const files = await Promise.all([
    readFile(new URL("../../../web/lib/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../web/middleware.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../web/app/dev-login/route.ts", import.meta.url), "utf8"),
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /nsSession|sessionStorage|getToken|authToken/i);
  assert.doesNotMatch(source, /localStorage[^;\n]*(token|session)/i);
  assert.match(files[0], /credentials:\s*"include"/);
  assert.match(files[0], /x-csrf-token/);
});

test("homologation and production templates enforce secure cookies and required worker", async () => {
  const [homologation, production] = await Promise.all([
    readFile(new URL("../../.env.homologation.example", import.meta.url), "utf8"),
    readFile(new URL("../../.env.production.example", import.meta.url), "utf8"),
  ]);
  for (const source of [homologation, production]) {
    assert.match(source, /^SESSION_COOKIE_SECURE=true$/m);
    assert.match(source, /^SESSION_COOKIE_SAME_SITE=lax$/m);
    assert.match(source, /^WORKER_REQUIRED=true$/m);
  }
});
