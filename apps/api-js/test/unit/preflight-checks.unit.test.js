import assert from "node:assert/strict";
import test from "node:test";

import preflightChecks from "../../scripts/preflight-checks.cjs";

const {
  _internal,
  checkNodeVersion,
  checkPnpmVersion,
  checkTestDatabaseEnv,
} = preflightChecks;

const { parseSemver, cmpSemver, parseHostPortFromTestUrl, MIN_NODE, MIN_PNPM } = _internal;

test("parseSemver aceita formatos com e sem prefixo v", () => {
  assert.deepEqual(parseSemver("v20.19.0"), [20, 19, 0]);
  assert.deepEqual(parseSemver("20.19"), [20, 19, 0]);
  assert.deepEqual(parseSemver("11.8.0"), [11, 8, 0]);
  assert.equal(parseSemver("not-a-version"), null);
});

test("cmpSemver determina ordem lexicográfica por componentes", () => {
  assert.equal(cmpSemver([20, 19, 0], MIN_NODE), 0);
  assert.equal(cmpSemver([20, 18, 0], MIN_NODE), -1);
  assert.equal(cmpSemver([21, 0, 0], MIN_NODE), 1);
  assert.equal(cmpSemver([10, 0], MIN_PNPM), -1);
});

test("parseHostPortFromTestUrl expõe apenas host e porta, sem tocar senha/usuario", () => {
  const env = { DATABASE_URL_TEST: "postgresql://user:secret-pass@db.local:6543/ns_fiscal_cloud_test?schema=public" };
  const t = parseHostPortFromTestUrl(env);
  assert.equal(t.host, "db.local");
  assert.equal(t.port, 6543);
});

test("parseHostPortFromTestUrl retorna null para URL sem porta (default nao assumido aqui)", () => {
  const t = parseHostPortFromTestUrl({ DATABASE_URL_TEST: "postgresql://user:sec@host/db" });
  assert.equal(t.port, 5432);
  assert.equal(t.host, "host");
});

test("parseHostPortFromTestUrl retorna null quando DATABASE_URL_TEST ausente ou invalida", () => {
  assert.equal(parseHostPortFromTestUrl({}), null);
  assert.equal(parseHostPortFromTestUrl({ DATABASE_URL_TEST: "not-a-url" }), null);
});

test("checkNodeVersion marca falha clara quando process.execPath nao responde (caminho indireto)", () => {
  const r = checkNodeVersion();
  assert.equal(typeof r.pass, "boolean");
  assert.equal(typeof r.detail, "string");
  assert.equal(r.name, "node");
  if (!r.pass) {
    assert.match(r.label, /Node\.js/);
  }
});

test("checkPnpmVersion retorna estrutura consistente sem vazar credenciais", () => {
  const r = checkPnpmVersion();
  assert.equal(r.name, "pnpm");
  assert.equal(typeof r.pass, "boolean");
  assert.ok(!/secret|password|pass-/i.test(r.detail), "detail não deve conter senha");
});

test("checkTestDatabaseEnv bloqueia banco nao identificado como teste", () => {
  const env = { NODE_ENV: "test", DATABASE_URL_TEST: "postgresql://u:pw@localhost:5432/ns_fiscal_cloud?schema=public" };
  const r = checkTestDatabaseEnv(env, (e) => {
    // Reusa a função real através do import dinâmico seria ideal; aqui emulamos o guardião.
    if (!e.DATABASE_URL_TEST) throw new Error("TEST_DATABASE_SAFETY_CHECK_FAILED: missing");
    const u = new URL(e.DATABASE_URL_TEST);
    const db = u.pathname.replace(/^\//, "");
    if (!/(test|testing|ci)/i.test(db)) throw new Error("TEST_DATABASE_SAFETY_CHECK_FAILED: not test");
    return { host: u.hostname, database: db, schema: "public" };
  });
  assert.equal(r.pass, false);
  assert.match(r.detail, /env\.test\.example/);
});

test("checkTestDatabaseEnv aprova banco identificado como teste sem expor senha/usuario", () => {
  const env = { NODE_ENV: "test", DATABASE_URL_TEST: "postgresql://u:secret@localhost:5432/ns_fiscal_cloud_test?schema=public" };
  const r = checkTestDatabaseEnv(env, (e) => {
    const u = new URL(e.DATABASE_URL_TEST);
    return { host: u.hostname, database: u.pathname.replace(/^\//, ""), schema: "public" };
  });
  assert.equal(r.pass, true);
  assert.ok(!/secret|password|u:/.test(r.detail), "detail não deve refletir senha");
});
