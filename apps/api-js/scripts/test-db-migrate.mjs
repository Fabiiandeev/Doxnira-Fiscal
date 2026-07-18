import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

import { enforceTestDatabaseEnvironment } from "../src/config/test-database-safety.js";

process.env.NODE_ENV = "test";
config({ path: ".env.test", override: true });
const target = enforceTestDatabaseEnvironment();
console.log(`Test database target: host=${target.host}; database=${target.database}; schema=${target.schema}`);

const localPrisma = resolve("node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
if (!existsSync(localPrisma)) {
  throw new Error(`Prisma local não encontrado: ${localPrisma}`);
}
const result = spawnSync(localPrisma, ["migrate", "deploy", "--config", "prisma.config.js"], {
  stdio: "inherit",
  env: process.env,
});
process.exitCode = result.status ?? 1;
