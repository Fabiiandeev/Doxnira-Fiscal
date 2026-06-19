import { createHash, randomUUID } from "node:crypto";

import { prisma } from "../config/prisma.js";
import { addHours } from "../utils/date.js";
import { reconcileNfeLinks } from "./document-link.service.js";
import { nextNsu } from "./nsu-control.service.js";

const mockSuppliers = [
  ["07632598000188", "Atacado Cerrado Ltda.", "GO"],
  ["33014556000196", "Indústria Horizonte S.A.", "SP"],
  ["60701190000104", "Distribuidora Norte Sul Ltda.", "MG"],
  ["19131243000197", "Comercial Vale Verde Ltda.", "PR"],
];

function buildAccessKey(company, invoiceNumber, supplierIndex) {
  const digits = `${company.cnpj}${String(invoiceNumber).padStart(9, "0")}${supplierIndex}${Date.now()}`;
  return digits.replace(/\D/g, "").padEnd(44, "0").slice(0, 44);
}

export async function executeMockSefazSync({ companyId, syncLogId, scenario = "138" }) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const startedAt = new Date();
  if (scenario === "137" || scenario === "656") {
    const blocked = scenario === "656";
    await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: {
          lastSyncAt: new Date(),
          nfeNextAllowedSyncAt: addHours(new Date(), 1),
        },
      }),
      prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          responseUltNsu: company.nfeLastNsu,
          responseMaxNsu: company.nfeMaxNsu || company.nfeLastNsu,
          cstat: scenario,
          xmotivo: blocked
            ? "Consumo indevido - janela de consulta aplicada (simulação)"
            : "Nenhum documento localizado (simulação)",
          documentsCount: 0,
          status: blocked ? "WARNING" : "WAITING",
          finishedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          companyId,
          action: "sync.completed",
          entityType: "SyncLog",
          entityId: syncLogId,
          metadata: { mode: "mock", cstat: scenario, documentsCount: 0, startedAt },
        },
      }),
    ]);
    return { syncLogId, documentsCount: 0, lastNsu: company.nfeLastNsu, cstat: scenario };
  }
  const count = 3;
  const baseNsu = company.nfeLastNsu || "000000000000000";
  const documents = [];

  for (let index = 1; index <= count; index += 1) {
    const [issuerCnpj, issuerName, uf] = mockSuppliers[
      (Number(BigInt(baseNsu) % BigInt(mockSuppliers.length)) + index) %
        mockSuppliers.length
    ];
    const nsu = nextNsu(baseNsu, index);
    const invoiceNumber = String(90000 + Number(nsu.slice(-5)));
    const accessKey = buildAccessKey(company, invoiceNumber, index);
    const amount = 1200 + index * 875.45;
    const xml = `<nfeProc versao="4.00"><NFe><infNFe Id="NFe${accessKey}"><ide><nNF>${invoiceNumber}</nNF></ide><emit><CNPJ>${issuerCnpj}</CNPJ><xNome>${issuerName}</xNome></emit><dest><CNPJ>${company.cnpj}</CNPJ><xNome>${company.legalName}</xNome></dest><total><ICMSTot><vNF>${amount.toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><nProt>MOCK${Date.now()}${index}</nProt></infProt></protNFe></nfeProc>`;
    documents.push({
      companyId,
      documentType: "NFE",
      invoiceNumber,
      series: "1",
      model: "55",
      accessKey,
      nsu,
      schemaName: "procNFe_v4.00.xsd",
      status: "AUTHORIZED",
      protocol: `MOCK${Date.now()}${index}`,
      issuerCnpj,
      issuerName,
      recipientCnpj: company.cnpj,
      recipientName: company.legalName,
      uf,
      cfop: "5102",
      emissionDate: new Date(Date.now() - index * 3_600_000),
      authorizationDate: new Date(Date.now() - index * 3_500_000),
      totalAmount: amount,
      xmlStorageKey: `mock/nfe/${accessKey}.xml`,
      xmlHashSha256: createHash("sha256").update(xml).digest("hex"),
      rawXml: xml,
      products: [{ code: `MOCK-${index}`, description: "Produto fiscal simulado", quantity: index, unitValue: amount / index }],
      taxes: { icms: amount * 0.18, pis: amount * 0.0165, cofins: amount * 0.076 },
      isSummary: index === 3,
      isNewSupplier: index === 1,
    });
  }

  const lastNsu = nextNsu(baseNsu, count);
  await prisma.$transaction([
    ...documents.map((data) =>
      prisma.fiscalDocument.upsert({
        where: { companyId_nsu: { companyId, nsu: data.nsu } },
        create: data,
        update: {},
      }),
    ),
    prisma.company.update({
      where: { id: companyId },
      data: {
        nfeLastNsu: lastNsu,
        nfeMaxNsu: lastNsu,
        lastSyncAt: new Date(),
        nfeNextAllowedSyncAt: addHours(new Date(), 1),
      },
    }),
    prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        responseUltNsu: lastNsu,
        responseMaxNsu: lastNsu,
        cstat: "138",
        xmotivo: "Documentos localizados (simulação)",
        documentsCount: count,
        status: "SUCCESS",
        finishedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        action: "sync.completed",
        entityType: "SyncLog",
        entityId: syncLogId,
        metadata: { mode: "mock", documentsCount: count, startedAt },
      },
    }),
  ]);
  for (const item of documents) {
    const document = await prisma.fiscalDocument.findUnique({
      where: { companyId_nsu: { companyId, nsu: item.nsu } },
      select: { id: true, accessKey: true },
    });
    if (document) {
      await reconcileNfeLinks(companyId, document.id, document.accessKey);
    }
  }
  return { syncLogId, documentsCount: count, lastNsu };
}
