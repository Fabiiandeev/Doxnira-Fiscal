import assert from "node:assert/strict";
import test, { after } from "node:test";

import { disconnectDatabase, prisma } from "../../src/config/prisma.js";

test("CT-e allocation HTTP suite only runs against the isolated test database", async () => {
  assert.match(process.env.DATABASE_URL_TEST || "", /ns_fiscal_cloud_test/);
  const [database] = await prisma.$queryRawUnsafe("SELECT current_database() AS database");
  assert.equal(database.database, "ns_fiscal_cloud_test");
});

after(async () => disconnectDatabase());
