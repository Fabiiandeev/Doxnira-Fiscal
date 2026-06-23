import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const suppliers = [
  ["07632598000188", "Atacado Cerrado Ltda.", "GO"],
  ["33014556000196", "Indústria Horizonte S.A.", "SP"],
  ["60701190000104", "Distribuidora Norte Sul Ltda.", "MG"],
  ["19131243000197", "Comercial Vale Verde Ltda.", "PR"],
  ["45362571000145", "Tecnologia Prisma Comércio Ltda.", "SC"],
  ["11222333000181", "Logística Planalto Ltda.", "DF"],
  ["27865757000102", "Alimentos Nova Safra S.A.", "BA"],
  ["02558157000162", "Materiais Goiás Centro Ltda.", "GO"],
];

const statusCycle = ["AUTHORIZED", "AUTHORIZED", "AUTHORIZED", "CANCELLED", "EVENT"];
const manifestationCycle = ["PENDING", "AWARE", "CONFIRMED", "UNKNOWN", "NOT_PERFORMED"];

function accessKey(index, issuerCnpj) {
  return `52${String(2606 + (index % 6)).padStart(4, "0")}${issuerCnpj}5500100${String(
    100000 + index,
  ).padStart(9, "0")}1`.slice(0, 44);
}

function dateDaysAgo(days, hour = 10) {
  return new Date(
    Date.now() -
      days * 24 * 60 * 60 * 1000 -
      Math.max(1, hour) * 60 * 60 * 1000 -
      (days * 7) % 60 * 60 * 1000,
  );
}

async function clearDatabase() {
  await prisma.documentTagLink.deleteMany();
  await prisma.documentNote.deleteMany();
  await prisma.xmlDownloadLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.manifestation.deleteMany();
  await prisma.fiscalEvent.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.fiscalDocumentLink.deleteMany();
  await prisma.transportDocument.deleteMany();
  await prisma.fiscalDocument.deleteMany();
  await prisma.digitalCertificate.deleteMany();
  await prisma.savedFilter.deleteMany();
  await prisma.documentTag.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearDatabase();

  const user = await prisma.user.create({
    data: {
      name: "Fabian",
      email: "admin@nssistemas.com.br",
      passwordHash: await bcrypt.hash("123456", 12),
      role: "OWNER",
    },
  });

  const company = await prisma.company.create({
    data: {
      ownerId: user.id,
      legalName: "NS Sistemas Tecnologia Ltda.",
      tradeName: "NS Sistemas",
      cnpj: "12874659000142",
      stateRegistration: "106521670",
      uf: "GO",
      taxRegime: "Lucro Presumido",
      environment: "homologation",
      status: "active",
      nfeLastNsu: "000009876543127",
      nfeMaxNsu: "000009876543127",
      lastSyncAt: dateDaysAgo(0, 8),
      nfeNextAllowedSyncAt: null,
    },
  });

  await prisma.userPreference.create({
    data: {
      userId: user.id,
      defaultCompanyId: company.id,
      theme: "light",
      accentColor: "#E8FF5A",
      tableDensity: "comfortable",
      dashboardLayout: { metrics: true, flow: true, suppliers: true, alerts: true },
    },
  });

  const documents = [];
  for (let index = 0; index < 80; index += 1) {
    const [issuerCnpj, issuerName, uf] = suppliers[index % suppliers.length];
    const key = accessKey(index, issuerCnpj);
    const amount = Number((620 + ((index * 913.73) % 64_000)).toFixed(2));
    const status = statusCycle[index % statusCycle.length];
    const invoiceNumber = String(10800 + index);
    const xml = `<nfeProc versao="4.00"><NFe><infNFe Id="NFe${key}"><ide><cUF>52</cUF><mod>55</mod><serie>1</serie><nNF>${invoiceNumber}</nNF></ide><emit><CNPJ>${issuerCnpj}</CNPJ><xNome>${issuerName}</xNome></emit><dest><CNPJ>${company.cnpj}</CNPJ><xNome>${company.legalName}</xNome></dest><det nItem="1"><prod><cProd>ITEM-${index + 1}</cProd><xProd>Produto fiscal ${index + 1}</xProd><qCom>${(index % 5) + 1}</qCom><vUnCom>${amount.toFixed(2)}</vUnCom></prod></det><total><ICMSTot><vNF>${amount.toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><nProt>152260000${String(index).padStart(6, "0")}</nProt></infProt></protNFe></nfeProc>`;
    // provide specific examples for the first indices to cover NFe/CTe inbound/outbound
    let documentType = index % 11 === 0 ? "CTE" : "NFE";
    let operationDirection = null;
    let companyRole = null;
    if (index === 0) {
      documentType = "NFE";
      operationDirection = "INBOUND";
      companyRole = "RECIPIENT";
    } else if (index === 1) {
      documentType = "NFE";
      operationDirection = "OUTBOUND";
      companyRole = "ISSUER";
    } else if (index === 2) {
      documentType = "CTE";
      operationDirection = "TRANSPORT_INBOUND";
      companyRole = "RECIPIENT";
    } else if (index === 3) {
      documentType = "CTE";
      operationDirection = "TRANSPORT_OUTBOUND";
      companyRole = "ISSUER";
    } else {
      documentType = index % 11 === 0 ? "CTE" : "NFE";
      operationDirection = index % 2 === 0 ? "INBOUND" : "OUTBOUND";
      companyRole = operationDirection === "INBOUND" ? "RECIPIENT" : "ISSUER";
    }

    documents.push({
      companyId: company.id,
      documentType,
      invoiceNumber,
      series: String((index % 3) + 1),
      model: documentType === "CTE" ? "57" : "55",
      accessKey: key,
      nsu: String(9_876_543_048 + index).padStart(15, "0"),
      schemaName: index % 4 === 0 ? "resNFe_v1.01.xsd" : "procNFe_v4.00.xsd",
      status,
      protocol: `152260000${String(index).padStart(6, "0")}`,
      manifestationStatus: manifestationCycle[index % manifestationCycle.length],
      issuerCnpj,
      issuerName,
      recipientCnpj: company.cnpj,
      recipientName: company.legalName,
      uf,
      cfop: index % 3 === 0 ? "6102" : "5102",
      emissionDate: dateDaysAgo(index % 170, 8 + (index % 10)),
      authorizationDate: dateDaysAgo(index % 170, 9 + (index % 9)),
      totalAmount: amount,
      xmlStorageKey: `seed/nfe/${key}.xml`,
      xmlHashSha256: createHash("sha256").update(xml).digest("hex"),
      source: "SEED",
      rawXml: xml,
      products: [
        {
          code: `ITEM-${index + 1}`,
          description: `Produto fiscal ${index + 1}`,
          quantity: (index % 5) + 1,
          unitValue: amount / ((index % 5) + 1),
        },
      ],
      taxes: {
        icms: Number((amount * 0.18).toFixed(2)),
        pis: Number((amount * 0.0165).toFixed(2)),
        cofins: Number((amount * 0.076).toFixed(2)),
      },
      isSummary: index % 6 === 0,
      isCancelled: status === "CANCELLED",
      isNewSupplier: index < 8,
      operationDirection,
      companyRole,
    });
  }

  await prisma.fiscalDocument.createMany({ data: documents });
  const createdDocuments = await prisma.fiscalDocument.findMany({
    where: { companyId: company.id },
    orderBy: { emissionDate: "desc" },
  });

  // create links for CT-e seed documents to some NF-e documents to emulate real links
  // Note: Currently disabled because CT-es are created as FiscalDocuments, not TransportDocuments
  // This will be re-enabled when CT-e documents are properly separated
  // const cteDocs = createdDocuments.filter((d) => d.documentType === "CTE");
  // const nfeDocs = createdDocuments.filter((d) => d.documentType === "NFE");
  // if (cteDocs.length && nfeDocs.length) {
  //   const links = cteDocs.slice(0, nfeDocs.length).map((cte, i) => ({
  //     companyId: company.id,
  //     nfeDocumentId: nfeDocs[i].id,
  //     cteDocumentId: cte.id,
  //     nfeAccessKey: nfeDocs[i].accessKey,
  //     cteAccessKey: cte.accessKey,
  //     linkType: "CTE_TO_NFE",
  //     source: "SEED",
  //     createdAt: dateDaysAgo(i + 1, 10),
  //   }));
  //   await prisma.fiscalDocumentLink.createMany({ data: links });
  // }

  await prisma.fiscalEvent.createMany({
    data: createdDocuments.slice(0, 10).map((document, index) => ({
      companyId: company.id,
      fiscalDocumentId: document.id,
      accessKey: document.accessKey,
      eventType: index % 3 === 0 ? "CANCELAMENTO" : "AUTORIZACAO",
      eventSequence: 1,
      protocol: `EVENTO-${String(index + 1).padStart(5, "0")}`,
      eventDate: dateDaysAgo(index, 12),
      nsu: document.nsu,
      schemaName: "procEventoNFe_v1.00.xsd",
      xmlStorageKey: `seed/events/${document.accessKey}-${index}.xml`,
      xmlHashSha256: createHash("sha256").update(`event-${document.id}`).digest("hex"),
    })),
  });

  await prisma.manifestation.createMany({
    data: createdDocuments.slice(10, 15).map((document, index) => ({
      companyId: company.id,
      fiscalDocumentId: document.id,
      accessKey: document.accessKey,
      eventType: manifestationCycle[index],
      justification:
        manifestationCycle[index] === "NOT_PERFORMED"
          ? "Operação comercial não reconhecida pela empresa destinatária."
          : null,
      protocol: `MANIFEST-${String(index + 1).padStart(5, "0")}`,
      status: "REGISTERED_MOCK",
      responseStorageKey: `seed/manifestations/${document.accessKey}-${index}.xml`,
      createdAt: dateDaysAgo(index + 1, 14),
    })),
  });

  const alertTypes = [
    ["certificate", "high", "Certificado digital não cadastrado"],
    ["cancelled", "high", "NF-e cancelada após entrada"],
    ["summary", "medium", "XML completo pendente"],
    ["new_supplier", "low", "Novo fornecedor identificado"],
    ["sync", "medium", "Janela de sincronização disponível"],
  ];
  await prisma.alert.createMany({
    data: Array.from({ length: 10 }, (_, index) => {
      const [type, severity, title] = alertTypes[index % alertTypes.length];
      return {
        companyId: company.id,
        fiscalDocumentId: type === "certificate" || type === "sync" ? null : createdDocuments[index].id,
        type,
        severity,
        title,
        message:
          type === "certificate"
            ? "Envie um certificado A1 para habilitar a sincronização simulada e preparar a integração fiscal."
            : `Verifique o item fiscal relacionado ao alerta ${index + 1}.`,
        status: index < 6 ? "open" : index < 8 ? "unread" : "resolved",
        readAt: index < 6 || index >= 8 ? dateDaysAgo(index, 15) : null,
        resolvedAt: index >= 8 ? dateDaysAgo(index - 7, 16) : null,
        createdAt: dateDaysAgo(index, 7 + index),
      };
    }),
  });

  await prisma.syncLog.createMany({
    data: Array.from({ length: 8 }, (_, index) => {
      const startedAt = dateDaysAgo(index, 8);
      const finishedAt = new Date(startedAt.getTime() + (12 + index * 4) * 1000);
      const status = index === 5 ? "WARNING" : index === 7 ? "ERROR" : "SUCCESS";
      const cstat = index === 5 ? "137" : index === 7 ? "656" : "138";
      return {
        companyId: company.id,
        service: "NFeDistribuicaoDFe",
        requestType: "distNSU",
        requestNsu: String(9_876_543_100 + index).padStart(15, "0"),
        responseUltNsu: String(9_876_543_108 + index).padStart(15, "0"),
        responseMaxNsu: "000009876543127",
        cstat,
        xmotivo:
          cstat === "138"
            ? "Documentos localizados"
            : cstat === "137"
              ? "Nenhum documento localizado"
              : "Consumo indevido - aguarde a janela de consulta",
        documentsCount: cstat === "138" ? 6 + index : 0,
        documentsReceived: cstat === "138" ? 6 + index : 0,
        documentsSaved: cstat === "138" ? 6 + index : 0,
        mode: "mock",
        environment: company.environment,
        status,
        startedAt,
        finishedAt,
        errorMessage: status === "ERROR" ? "Janela mínima de consulta ainda não cumprida." : null,
      };
    }),
  });

  await prisma.auditLog.createMany({
    data: [
      {
        companyId: company.id,
        userId: user.id,
        action: "seed.created",
        entityType: "Company",
        entityId: company.id,
        metadata: { documents: 80, alerts: 10, syncLogs: 8 },
      },
      {
        companyId: company.id,
        userId: user.id,
        action: "auth.login",
        metadata: { source: "seed" },
      },
    ],
  });

  console.log(
    JSON.stringify(
      {
        user: { email: user.email, password: "123456" },
        companyId: company.id,
        documents: createdDocuments.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
