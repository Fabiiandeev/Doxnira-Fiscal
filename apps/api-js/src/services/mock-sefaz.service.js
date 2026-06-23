import { createHash } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { buildMockNfeAccessKey } from "../utils/nfe-access-key.js";
import { reconcileNfeLinks } from "./document-link.service.js";
import { nextNsu } from "./nsu-control.service.js";

const mockSuppliers = [
  ["07632598000188", "Atacado Cerrado Ltda.", "GO"],
  ["33014556000196", "Indústria Horizonte S.A.", "SP"],
  ["60701190000104", "Distribuidora Norte Sul Ltda.", "MG"],
  ["19131243000197", "Comercial Vale Verde Ltda.", "PR"],
];

export async function executeMockSefazSync({ companyId, syncLogId, scenario = "138" }) {
  if (env.SEFAZ_INTEGRATION_ENABLED) {
    throw new AppError(
      "Mock SEFAZ bloqueado quando a integração real está ativa.",
      "MOCK_SEFAZ_BLOCKED",
      409,
    );
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const startedAt = new Date();
  if (scenario === "137" || scenario === "656") {
    const blocked = scenario === "656";
    await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: {
          lastSyncAt: new Date(),
          nfeNextAllowedSyncAt: new Date(
            Date.now() + (blocked ? env.NSU_WAIT_656_MS : env.NSU_WAIT_137_MS),
          ),
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
          documentsReceived: 0,
          documentsSaved: 0,
          status: blocked ? "WARNING" : "NO_DOCUMENTS",
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
    return {
      syncLogId,
      documentsCount: 0,
      lastNsu: company.nfeLastNsu,
      cstat: scenario,
      mode: "mock",
      environment: company.environment,
    };
  }
  const count = 5;
  const baseNsu = company.nfeLastNsu || "000000000000000";
  const documents = [];

  for (let index = 1; index <= count; index += 1) {
    const [partnerCnpj, partnerName, uf] = mockSuppliers[
      (Number(BigInt(baseNsu) % BigInt(mockSuppliers.length)) + index) %
        mockSuppliers.length
    ];
    const nsu = nextNsu(baseNsu, index);
    const invoiceNumber = String(90000 + Number(nsu.slice(-5)));
    const documentType = index === 3 || index === 4 ? "CTE" : "NFE";
    const outbound = index === 2 || index === 4;
    const issuerCnpj = outbound ? company.cnpj : partnerCnpj;
    const issuerName = outbound ? company.legalName : partnerName;
    const recipientCnpj = outbound ? partnerCnpj : company.cnpj;
    const recipientName = outbound ? partnerName : company.legalName;
    const model = documentType === "CTE" ? "57" : "55";
    const operationDirection =
      documentType === "CTE"
        ? outbound
          ? "TRANSPORT_OUTBOUND"
          : "TRANSPORT_INBOUND"
        : outbound
          ? "OUTBOUND"
          : "INBOUND";
    const accessKey = buildMockNfeAccessKey({
      uf,
      issuerCnpj,
      invoiceNumber,
      model,
      issuedAt: new Date(),
      seed: `${company.id}:${nsu}:${index}`,
    });
    const amount = 1200 + index * 875.45;
    const xml =
      documentType === "CTE"
        ? `<cteProc versao="4.00"><CTe><infCte Id="CTe${accessKey}"><ide><mod>57</mod><nCT>${invoiceNumber}</nCT><serie>1</serie></ide><emit><CNPJ>${issuerCnpj}</CNPJ><xNome>${issuerName}</xNome></emit><dest><CNPJ>${recipientCnpj}</CNPJ><xNome>${recipientName}</xNome></dest><vPrest><vTPrest>${amount.toFixed(2)}</vTPrest></vPrest></infCte></CTe></cteProc>`
        : `<nfeProc versao="4.00"><NFe><infNFe Id="NFe${accessKey}"><ide><mod>55</mod><nNF>${invoiceNumber}</nNF><serie>1</serie></ide><emit><CNPJ>${issuerCnpj}</CNPJ><xNome>${issuerName}</xNome></emit><dest><CNPJ>${recipientCnpj}</CNPJ><xNome>${recipientName}</xNome></dest><total><ICMSTot><vNF>${amount.toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><nProt>MOCK${Date.now()}${index}</nProt></infProt></protNFe></nfeProc>`;
    const taxAmount = documentType === "CTE" ? amount * 0.12 : amount * 0.2725;
    documents.push({
      companyId,
      documentType,
      operationDirection,
      companyRole: outbound
        ? "ISSUER"
        : documentType === "CTE"
          ? "TRANSPORT_TAKER"
          : "RECIPIENT",
      invoiceNumber,
      series: "1",
      model,
      accessKey,
      nsu,
      schemaName: documentType === "CTE" ? "procCTe_v4.00.xsd" : "procNFe_v4.00.xsd",
      status: "AUTHORIZED",
      protocol: `MOCK${Date.now()}${index}`,
      issuerCnpj,
      issuerName,
      recipientCnpj,
      recipientName,
      uf,
      cfop: outbound ? "5102" : "1102",
      emissionDate: new Date(Date.now() - index * 3_600_000),
      authorizationDate: new Date(Date.now() - index * 3_500_000),
      totalAmount: amount,
      productsAmount: documentType === "NFE" ? amount : 0,
      freightAmount: documentType === "CTE" ? amount : 0,
      icmsAmount: documentType === "CTE" ? amount * 0.12 : amount * 0.18,
      pisAmount: documentType === "NFE" ? amount * 0.0165 : 0,
      cofinsAmount: documentType === "NFE" ? amount * 0.076 : 0,
      taxAmount,
      xmlStorageKey: `mock/${documentType.toLowerCase()}/${accessKey}.xml`,
      xmlHashSha256: createHash("sha256").update(xml).digest("hex"),
      rawXmlHash: createHash("sha256").update(xml).digest("hex"),
      source: "MOCK",
      rawXml: xml,
      products: [{ code: `MOCK-${index}`, description: "Produto fiscal simulado", quantity: index, unitValue: amount / index }],
      taxes: { icms: amount * 0.18, pis: amount * 0.0165, cofins: amount * 0.076 },
      isSummary: index === 5,
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
        nfeNextAllowedSyncAt: new Date(Date.now() + env.NSU_WAIT_137_MS),
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
        documentsReceived: count,
        documentsSaved: count,
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
      if (item.documentType === "NFE") {
        await reconcileNfeLinks(companyId, document.id, document.accessKey);
      }
    }
  }
  const linkedNfe = documents[4];
  const linkedCte = documents[2];
  const nfe = await prisma.fiscalDocument.findUnique({
    where: { companyId_nsu: { companyId, nsu: linkedNfe.nsu } },
  });
  const transport = await prisma.transportDocument.upsert({
    where: {
      companyId_accessKey: { companyId, accessKey: linkedCte.accessKey },
    },
    create: {
      companyId,
      accessKey: linkedCte.accessKey,
      number: linkedCte.invoiceNumber,
      series: linkedCte.series,
      emissionDate: linkedCte.emissionDate,
      issuerCnpj: linkedCte.issuerCnpj,
      issuerName: linkedCte.issuerName,
      recipientCnpj: linkedCte.recipientCnpj,
      recipientName: linkedCte.recipientName,
      totalAmount: linkedCte.totalAmount,
      status: linkedCte.status,
      xmlStorageKey: linkedCte.xmlStorageKey,
      rawXmlHash: linkedCte.rawXmlHash,
      rawXml: linkedCte.rawXml,
    },
    update: {},
  });
  if (nfe) {
    await prisma.fiscalDocumentLink.upsert({
      where: {
        companyId_nfeAccessKey_cteAccessKey_linkType: {
          companyId,
          nfeAccessKey: nfe.accessKey,
          cteAccessKey: transport.accessKey,
          linkType: "NFE_CTE",
        },
      },
      create: {
        companyId,
        nfeDocumentId: nfe.id,
        cteDocumentId: transport.id,
        nfeAccessKey: nfe.accessKey,
        cteAccessKey: transport.accessKey,
        linkType: "NFE_CTE",
        source: "CTE_XML",
      },
      update: { nfeDocumentId: nfe.id },
    });
  }
  return {
    syncLogId,
    documentsCount: count,
    lastNsu,
    mode: "mock",
    environment: company.environment,
  };
}
