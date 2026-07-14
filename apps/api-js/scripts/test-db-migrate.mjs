import { spawnSync } from "node:child_process";

import { config } from "dotenv";

import { enforceTestDatabaseEnvironment } from "../src/config/test-database-safety.js";

process.env.NODE_ENV = "test";
config({ path: ".env.test", override: true });
const target = enforceTestDatabaseEnvironment();
console.log(`Test database target: host=${target.host}; database=${target.database}; schema=${target.schema}`);

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["prisma", "migrate", "deploy", "--config", "prisma.config.js"], {
  stdio: "inherit",
  env: process.env,
});
process.exitCode = result.status ?? 1;
