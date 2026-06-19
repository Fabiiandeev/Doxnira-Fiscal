import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { addHours } from "../utils/date.js";
import { loadCertificateSecret } from "./certificate-vault.service.js";
import { extractDocZips } from "./doczip.service.js";
import { reconcileNfeLinks } from "./document-link.service.js";
import { hashXml } from "./xml.service.js";
import { postSoap } from "./soap-client.service.js";
import { buildStorageKey } from "./storage.service.js";
import {
  parseDistributionResponse,
  parseFiscalXml,
} from "./xml-parser.service.js";

function buildDistributionEnvelope(company) {
  const tpAmb = env.SEFAZ_ENVIRONMENT === "production" ? "1" : "2";
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>91</cUFAutor>
          <CNPJ>${company.cnpj}</CNPJ>
          <distNSU><ultNSU>${company.nfeLastNsu}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

async function persistDistribution(company, documents) {
  let savedDocuments = 0;
  for (const item of documents) {
    const metadata = parseFiscalXml(item.xml, item.schema, item.nsu);
    if (metadata.kind === "event") {
      await prisma.fiscalEvent.create({
        data: {
          companyId: company.id,
          accessKey: metadata.accessKey,
          eventType: metadata.eventType,
          eventDate: metadata.eventDate ? new Date(metadata.eventDate) : null,
          nsu: item.nsu,
          schemaName: item.schema,
          protocol: metadata.protocol,
          xmlStorageKey: buildStorageKey("sefaz/events", `${item.nsu}-${metadata.accessKey || "event"}`),
          xmlHashSha256: hashXml(item.xml),
        },
      });
      continue;
    }
    const document = await prisma.fiscalDocument.upsert({
      where: { companyId_nsu: { companyId: company.id, nsu: item.nsu } },
      create: {
        companyId: company.id,
        documentType: "NFE",
        invoiceNumber: metadata.invoiceNumber,
        series: metadata.series,
        model: metadata.model,
        accessKey: metadata.accessKey,
        nsu: item.nsu,
        schemaName: item.schema,
        status: metadata.isCancelled ? "CANCELLED" : "AUTHORIZED",
        protocol: metadata.protocol,
        issuerCnpj: metadata.issuerCnpj,
        issuerName: metadata.issuerName,
        recipientCnpj: metadata.recipientCnpj || company.cnpj,
        recipientName: metadata.recipientName || company.legalName,
        emissionDate: metadata.emissionDate ? new Date(metadata.emissionDate) : null,
        totalAmount: metadata.totalAmount,
        xmlStorageKey: buildStorageKey("sefaz/nfe", metadata.accessKey || item.nsu),
        xmlHashSha256: hashXml(item.xml),
        rawXml: item.xml,
        isSummary: metadata.isSummary,
        isCancelled: metadata.isCancelled,
      },
      update: {
        accessKey: metadata.accessKey,
        schemaName: item.schema,
        rawXml: item.xml,
        xmlHashSha256: hashXml(item.xml),
        isSummary: metadata.isSummary,
      },
    });
    await reconcileNfeLinks(company.id, document.id, metadata.accessKey);
    savedDocuments += 1;
  }
  return savedDocuments;
}

export async function executeRealSefazSync({ companyId, syncLogId }) {
  if (!env.SEFAZ_INTEGRATION_ENABLED) {
    throw new AppError(
      "Integração real com a SEFAZ está desativada.",
      "SEFAZ_INTEGRATION_DISABLED",
      409,
    );
  }
  if (
    env.SEFAZ_ENVIRONMENT === "production" &&
    !env.ALLOW_PRODUCTION_SEFAZ
  ) {
    throw new AppError(
      "Ambiente de produção SEFAZ bloqueado por configuração.",
      "PRODUCTION_SEFAZ_BLOCKED",
      409,
    );
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("Empresa não encontrada.", "COMPANY_NOT_FOUND", 404);
  const secret = await loadCertificateSecret(companyId);
  if (!secret.certificate.valid) {
    throw new AppError("Certificado A1 inválido.", "CERTIFICATE_INVALID", 409);
  }
  const endpoint =
    env.SEFAZ_ENVIRONMENT === "production"
      ? env.SEFAZ_DIST_DFE_PROD_URL
      : env.SEFAZ_DIST_DFE_HOM_URL;
  const responseXml = await postSoap({
    url: endpoint,
    action:
      "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse",
    body: buildDistributionEnvelope(company),
    pfx: secret.pfx,
    passphrase: secret.passphrase,
  });
  const result = parseDistributionResponse(responseXml);
  if (!["137", "138", "656"].includes(result.cstat)) {
    throw new AppError(
      result.xmotivo || "Resposta fiscal não reconhecida.",
      "SEFAZ_UNKNOWN_RESPONSE",
      502,
      [{ cstat: result.cstat }],
    );
  }

  const documents = result.cstat === "138" ? extractDocZips(responseXml) : [];
  const documentsCount = await persistDistribution(company, documents);
  const nextAllowedSyncAt =
    result.cstat === "137" || result.cstat === "656"
      ? addHours(new Date(), 1)
      : result.ultNsu === result.maxNsu
        ? addHours(new Date(), 1)
        : null;
  const status =
    result.cstat === "138"
      ? "SUCCESS"
      : result.cstat === "137"
        ? "WAITING"
        : "WARNING";

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: {
        nfeLastNsu: result.ultNsu || company.nfeLastNsu,
        nfeMaxNsu: result.maxNsu || company.nfeMaxNsu,
        nfeNextAllowedSyncAt: nextAllowedSyncAt,
        lastSyncAt: new Date(),
      },
    }),
    prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        responseUltNsu: result.ultNsu,
        responseMaxNsu: result.maxNsu,
        cstat: result.cstat,
        xmotivo: result.xmotivo,
        documentsCount,
        status,
        finishedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        action: "sync.completed",
        entityType: "SyncLog",
        entityId: syncLogId,
        metadata: {
          mode: "real",
          environment: env.SEFAZ_ENVIRONMENT,
          cstat: result.cstat,
          previousUltNsu: company.nfeLastNsu,
          returnedUltNsu: result.ultNsu,
          returnedMaxNsu: result.maxNsu,
          documentsCount,
        },
      },
    }),
  ]);
  return {
    syncLogId,
    cstat: result.cstat,
    documentsCount,
    lastNsu: result.ultNsu,
    maxNsu: result.maxNsu,
    hasMore:
      result.cstat === "138" &&
      result.ultNsu &&
      result.maxNsu &&
      BigInt(result.ultNsu) < BigInt(result.maxNsu),
  };
}
