import "dotenv/config";

import { defineConfig } from "prisma/config";

const args = process.argv.slice(2);
const isNonDevMigrateCommand = args.includes("migrate") && !args.includes("dev");
const isTestEnvironment = process.env.NODE_ENV === "test";
const datasourceUrl = isTestEnvironment
  ? process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
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
