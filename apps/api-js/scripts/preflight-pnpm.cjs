"use strict";

const { checkPnpmVersion } = require("./preflight-checks.cjs");
const { formatResults } = require("./preflight-report.cjs");

function main() {
  const results = [checkPnpmVersion()];
  const report = formatResults(results);
  process.stdout.write(report.text);
  process.exit(report.ok ? 0 : 1);
}

main();
