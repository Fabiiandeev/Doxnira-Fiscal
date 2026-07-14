import { config } from "dotenv";

import { defineConfig } from "prisma/config";
import { enforceTestDatabaseEnvironment } from "./src/config/test-database-safety.js";

if (process.env.NODE_ENV === "test") {
  config({ path: ".env.test", override: true });
  enforceTestDatabaseEnvironment();
} else {
  config();
}

const args = process.argv.slice(2);
const isNonDevMigrateCommand = args.includes("migrate") && !args.includes("dev");
const isTestEnvironment = process.env.NODE_ENV === "test";
const datasourceUrl = isTestEnvironment
  ? process.env.DATABASE_URL_TEST
  : isNonDevMigrateCommand && process.env.DIRECT_URL
    ? process.env.DIRECT_URL
    : process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
    directUrl: isTestEnvironment ? undefined : process.env.DIRECT_URL,
    shadowDatabaseUrl: isTestEnvironment || isNonDevMigrateCommand ? undefined : process.env.SHADOW_DATABASE_URL,
  },
});
