"use strict";

const { config } = require("dotenv");
const { enforceTestDatabaseEnvironment } = require("../src/config/test-database-safety.js");
const { formatResults } = require("./preflight-report.cjs");
const {
  checkNodeVersion,
  checkPnpmVersion,
  checkDockerAvailable,
  checkTestDatabaseEnv,
  checkPrismaClientGenerated,
  checkPostgresReachable,
} = require("./preflight-checks.cjs");

async function main() {
  process.env.NODE_ENV = "test";
  config({ path: ".env.test", override: true });

  const syncResults = [
    checkNodeVersion(),
    checkPnpmVersion(),
    checkDockerAvailable(),
    checkTestDatabaseEnv(process.env, enforceTestDatabaseEnvironment),
    checkPrismaClientGenerated(),
  ];
  const pgResult = await checkPostgresReachable(process.env);
  const results = [...syncResults, pgResult];

  const report = formatResults(results);
  process.stdout.write(report.text);
  if (!report.ok) {
    process.stderr.write(
      "\nEm caso de banco indisponível, suba o serviço local (usando .env.docker) com:\n" +
        "  pnpm --filter @ns-fiscal/api-js db:up\n",
    );
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`preflight-e2e: erro inesperado: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
