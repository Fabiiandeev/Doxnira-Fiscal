#!/usr/bin/env node

import { prisma } from "../src/config/prisma.js";
import { executeMockSefazSync } from "../src/services/mock-sefaz.service.js";

const companyId = process.argv[2];
const scenario = process.argv[3] || "138";

if (!companyId) {
  console.error("Usage: node run-mock-sync.js <companyId> [scenario]");
  process.exit(1);
}

async function main() {
  try {
    const syncLog = await prisma.syncLog.create({
      data: {
        companyId,
        service: "NFeDistribuicaoDFe",
        requestType: "distNSU",
        requestNsu: null,
        mode: "mock",
        environment: "homologation",
        status: "QUEUED",
        startedAt: new Date(),
      },
    });

    console.log("Created syncLog:", syncLog.id);

    const result = await executeMockSefazSync({ companyId, syncLogId: syncLog.id, scenario });

    console.log("Mock sync result:");
    console.log(JSON.stringify(result, null, 2));

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error running mock sync:", err);
    try {
      await prisma.$disconnect();
    } catch (e) {}
    process.exit(1);
  }
}

main();
