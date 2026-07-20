"use strict";

const { config } = require("dotenv");
const { enforceTestDatabaseEnvironment } = require("../src/config/test-database-safety.js");
const { checkTestDatabaseEnv, checkPrismaClientGenerated } = require("./preflight-checks.cjs");
const { formatResults } = require("./preflight-report.cjs");

function main() {
  process.env.NODE_ENV = "test";
  config({ path: ".env.test", override: true });

  const results = [
    checkTestDatabaseEnv(process.env, enforceTestDatabaseEnvironment),
    checkPrismaClientGenerated(),
  ];
  const report = formatResults(results);
  process.stdout.write(report.text);
  process.exit(report.ok ? 0 : 1);
}

main();
