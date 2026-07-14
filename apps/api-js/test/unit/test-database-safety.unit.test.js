import assert from "node:assert/strict";
import test from "node:test";

import { enforceTestDatabaseEnvironment } from "../../src/config/test-database-safety.js";

const testUrl = "postgresql://user:secret@localhost:5432/ns_fiscal_cloud_test?schema=public";

test("aceita exclusivamente DATABASE_URL_TEST identificada como teste", () => {
  const runtimeEnv = { NODE_ENV: "test", DATABASE_URL_TEST: testUrl };
  const target = enforceTestDatabaseEnvironment(runtimeEnv);
  assert.equal(runtimeEnv.DATABASE_URL, testUrl);
  assert.equal(target.database, "ns_fiscal_cloud_test");
});

test("falha sem DATABASE_URL_TEST, em banco não-test e com DIRECT_URL", () => {
  assert.throws(() => enforceTestDatabaseEnvironment({ NODE_ENV: "test" }), /TEST_DATABASE_SAFETY_CHECK_FAILED/);
  assert.throws(() => enforceTestDatabaseEnvironment({ NODE_ENV: "test", DATABASE_URL_TEST: "postgresql://user:secret@localhost:5432/ns_fiscal_cloud?schema=public" }), /TEST_DATABASE_SAFETY_CHECK_FAILED/);
  assert.throws(() => enforceTestDatabaseEnvironment({ NODE_ENV: "test", DATABASE_URL_TEST: testUrl, DIRECT_URL: "postgresql://external" }), /TEST_DATABASE_SAFETY_CHECK_FAILED/);
});
