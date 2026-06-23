#!/usr/bin/env node

import { prisma } from "../src/config/prisma.js";

const companyId = process.argv[2];

if (!companyId) {
  console.error("Uso: node scripts/cleanup-fake-documents.js COMPANY_ID");
  process.exit(1);
}

try {
  console.log(`Iniciando limpeza de documentos fake para empresa: ${companyId}`);

  const mockRemoved = await prisma.fiscalDocument.deleteMany({
    where: {
      companyId,
      source: "MOCK",
    },
  });

  const seedRemoved = await prisma.fiscalDocument.deleteMany({
    where: {
      companyId,
      source: "SEED",
    },
  });

  const realPreserved = await prisma.fiscalDocument.count({
    where: {
      companyId,
      source: { in: ["REAL_SEFAZ", "MANUAL_IMPORT", "ERP_IMPORT"] },
    },
  });

  console.log(`Empresa: ${companyId}`);
  console.log(`MOCK removidos: ${mockRemoved.count}`);
  console.log(`SEED removidos: ${seedRemoved.count}`);
  console.log(`REAL_SEFAZ preservados: ${realPreserved}`);

  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error("Erro durante limpeza:", error.message);
  await prisma.$disconnect();
  process.exit(1);
}
