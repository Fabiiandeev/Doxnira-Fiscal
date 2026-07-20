import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

import { enforceTestDatabaseEnvironment } from "../src/config/test-database-safety.js";

process.env.NODE_ENV = "test";
config({ path: ".env.test", override: true });
if (!process.env.DATABASE_URL_TEST) {
  throw new Error("DATABASE_URL_TEST obrigatória para migrations de teste.");
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
delete process.env.DIRECT_URL;
delete process.env.SHADOW_DATABASE_URL;
const target = enforceTestDatabaseEnvironment();
console.log(`Test database target: host=${target.host}; database=${target.database}; schema=${target.schema}`);

const localPrisma = resolve("node_modules", "prisma", "build", "index.js");
if (!existsSync(localPrisma)) {
  throw new Error(`Prisma local não encontrado: ${localPrisma}`);
}
const result = spawnSync(process.execPath, [localPrisma, "migrate", "deploy", "--config", "prisma.config.js"], {
  stdio: "inherit",
  env: process.env,
});
if (result.error) {
  console.error("Falha ao iniciar Prisma:", result.error.stack || result.error);
}
console.log(`Prisma migrate deploy exit code: ${result.status ?? "null"}`);
process.exitCode = result.error ? 1 : (result.status ?? 1);
