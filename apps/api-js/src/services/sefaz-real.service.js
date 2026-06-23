import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import { isValidNfeAccessKey } from "../utils/nfe-access-key.js";
import { normalizeCnpj } from "../utils/cnpj.js";
import { loadCertificateSecret } from "./certificate-vault.service.js";
import { extractDocZips } from "./doczip.service.js";
import { classifyFiscalDocument } from "./fiscal-classifier.service.js";
import { reconcileNfeLinks } from "./document-link.service.js";
import { hashXml } from "./xml.service.js";
import { postSoap } from "./soap-client.service.js";
import { buildStorageKey } from "./storage.service.js";
import {
  parseDistributionResponse,
  parseFiscalXml,
} from "./xml-parser.service.js";

function buildDistributionEnvelope(company, lastNsu) {
  const tpAmb = company.environment === "production" ? "1" : "2";
  const ufToCode = {
    AC: "12",
    AL: "27",
    AM: "13",
    AP: "16",
    BA: "29",
    CE: "23",
    DF: "53",
    ES: "32",
    GO: "52",
    MA: "21",
    MG: "31",
    MS: "50",
    MT: "51",
    PA: "15",
    PB: "25",
    PE: "26",
    PI: "22",
    PR: "41",
    RJ: "33",
    RN: "24",
    RO: "11",
    RR: "14",
    RS: "43",
    SC: "42",
    SE: "28",
    SP: "35",
    TO: "17",
  };
  const cUFAutor = ufToCode[String(company.uf || "").toUpperCase()] || "91";
  const cnpj = normalizeCnpj(company.cnpj) || company.cnpj;
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUFAutor}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${lastNsu}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

async function persistDistribution(company, documents) {
  const parsedDocuments = [];
  for (const item of documents) {
    try {
      const metadata = parseFiscalXml(item.xml, item.schema, item.nsu);
      if (!isValidNfeAccessKey(metadata.accessKey)) {
        // record and skip invalid access key
        await prisma.auditLog.create({
          data: {
            companyId: company.id,
            action: "sync.warning",
            entityType: "FiscalDocument",
            entityId: null,
            metadata: {
              code: "INVALID_NFE_ACCESS_KEY",
              message: "Chave de acesso NF-e inválida no documento recebido.",
              nsu: item.nsu,
              accessKey: metadata.accessKey || null,
            },
          },
        });
        continue;
      }
      parsedDocuments.push({ item, metadata });
    } catch (err) {
      await prisma.auditLog.create({
        data: {
          companyId: company.id,
          action: "sync.warning",
          entityType: "FiscalDocument",
          entityId: null,
          metadata: {
            code: "XML_PARSE_FAILED",
            message: "Não foi possível parsear o XML recebido (possível CT-e/Resumo inválido).",
            nsu: item.nsu,
            error: err?.message || String(err),
          },
        },
      });
      continue;
    }
  }
  let savedDocuments = 0;
  let eventsSaved = 0;
  for (const { item, metadata } of parsedDocuments) {
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
      eventsSaved += 1;
      continue;
    }
    const normalizedMetadata = {
      ...metadata,
      documentType: metadata.documentType || "NFE",
      recipientCnpj: metadata.recipientCnpj || company.cnpj,
      recipientName: metadata.recipientName || company.legalName,
    };
    const classification = classifyFiscalDocument(company, normalizedMetadata);
    if (classification.operationDirection === "UNKNOWN" && !metadata.isSummary) {
      // Do not throw in real sync; register a structured warning and skip creating a fake document
      await prisma.auditLog.create({
        data: {
          companyId: company.id,
          action: "sync.warning",
          entityType: "FiscalDocument",
          entityId: null,
          metadata: {
            code: "DOCUMENT_UNKNOWN_DIRECTION",
            message: "Documento sem classificação de entrada/saída durante a importação SEFAZ.",
            field: "operationDirection",
            cause: "O CNPJ da empresa não foi identificado como emitente, destinatário ou tomador no XML.",
            suggestion: "Revise o XML ou cadastre o vínculo correto da empresa.",
            nsu: item.nsu,
            accessKey: metadata.accessKey || null,
          },
        },
      });
      // skip saving this document as a fiscal document
      continue;
    }
    const direction = classification.operationDirection;
    const companyRole =
      classification.companyRole === "OTHER" ? "RECIPIENT" : classification.companyRole;
    const xmlHash = hashXml(item.xml);
    const document = await prisma.fiscalDocument.upsert({
      where: { companyId_nsu: { companyId: company.id, nsu: item.nsu } },
      create: {
        companyId: company.id,
        documentType: normalizedMetadata.documentType,
        operationDirection: direction,
        companyRole,
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
        recipientCnpj: normalizedMetadata.recipientCnpj,
        recipientName: normalizedMetadata.recipientName,
        emissionDate: metadata.emissionDate ? new Date(metadata.emissionDate) : null,
        totalAmount: metadata.totalAmount,
        productsAmount: metadata.productsAmount || 0,
        freightAmount: metadata.freightAmount || 0,
        discountAmount: metadata.discountAmount || 0,
        icmsAmount: metadata.icmsAmount || 0,
        ipiAmount: metadata.ipiAmount || 0,
        pisAmount: metadata.pisAmount || 0,
        cofinsAmount: metadata.cofinsAmount || 0,
        icmsBase: metadata.icmsBase || 0,
        icmsStAmount: metadata.icmsStAmount || 0,
        fcpAmount: metadata.fcpAmount || 0,
        otherAmount: metadata.otherAmount || 0,
        taxAmount: metadata.taxAmount || 0,
        xmlStorageKey: buildStorageKey("sefaz/nfe", metadata.accessKey || item.nsu),
        xmlHashSha256: xmlHash,
        rawXmlHash: xmlHash,
        source: "REAL_SEFAZ",
        rawXml: item.xml,
        isSummary: metadata.isSummary,
        isCancelled: metadata.isCancelled,
        products: metadata.items || [],
        taxes: {
          icms: metadata.icmsAmount || 0,
          ipi: metadata.ipiAmount || 0,
          pis: metadata.pisAmount || 0,
          cofins: metadata.cofinsAmount || 0,
        },
        items: {
          create: (metadata.items || []).map((taxItem) => ({
            companyId: company.id,
            ...taxItem,
          })),
        },
      },
      update: {
        accessKey: metadata.accessKey,
        schemaName: item.schema,
        rawXml: item.xml,
        xmlHashSha256: xmlHash,
        rawXmlHash: xmlHash,
        source: "REAL_SEFAZ",
        isSummary: metadata.isSummary,
        isCancelled: metadata.isCancelled,
        operationDirection: direction,
        companyRole,
        totalAmount: metadata.totalAmount,
        productsAmount: metadata.productsAmount || 0,
        freightAmount: metadata.freightAmount || 0,
        discountAmount: metadata.discountAmount || 0,
        icmsAmount: metadata.icmsAmount || 0,
        ipiAmount: metadata.ipiAmount || 0,
        pisAmount: metadata.pisAmount || 0,
        cofinsAmount: metadata.cofinsAmount || 0,
        icmsBase: metadata.icmsBase || 0,
        icmsStAmount: metadata.icmsStAmount || 0,
        fcpAmount: metadata.fcpAmount || 0,
        otherAmount: metadata.otherAmount || 0,
        taxAmount: metadata.taxAmount || 0,
        products: metadata.items || [],
        taxes: {
          icms: metadata.icmsAmount || 0,
          ipi: metadata.ipiAmount || 0,
          pis: metadata.pisAmount || 0,
          cofins: metadata.cofinsAmount || 0,
        },
      },
    });
    if (metadata.items?.length) {
      await prisma.fiscalDocumentItem.deleteMany({ where: { documentId: document.id } });
      await prisma.fiscalDocumentItem.createMany({
        data: metadata.items.map((taxItem) => ({
          documentId: document.id,
          companyId: company.id,
          ...taxItem,
        })),
      });
    }
    await reconcileNfeLinks(company.id, document.id, metadata.accessKey);
    savedDocuments += 1;
  }
  return { documentsSaved: savedDocuments, eventsSaved };
}

export async function executeRealSefazSync({ companyId, syncLogId }) {
  if (!env.SEFAZ_INTEGRATION_ENABLED) {
    throw new AppError(
      "Integração real com a SEFAZ está desativada.",
      "SEFAZ_INTEGRATION_DISABLED",
      409,
    );
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("Empresa não encontrada.", "COMPANY_NOT_FOUND", 404);
  if (company.environment === "production" && !env.ALLOW_PRODUCTION_SEFAZ) {
    throw new AppError(
      "Empresa configurada para produção, mas ALLOW_PRODUCTION_SEFAZ está desativado.",
      "PRODUCTION_SEFAZ_BLOCKED",
      409,
    );
  }
  const secret = await loadCertificateSecret(companyId);
  if (!secret.certificate.valid) {
    throw new AppError("Certificado A1 inválido.", "CERTIFICATE_INVALID", 409);
  }
  const endpoint =
    company.environment === "production"
      ? env.SEFAZ_DIST_DFE_PROD_URL
      : env.SEFAZ_DIST_DFE_HOM_URL;
  let currentNsu = company.nfeLastNsu;
  let result = null;
  let documentsReceived = 0;
  let documentsSaved = 0;
  let eventsSaved = 0;
  let batchesProcessed = 0;

  while (batchesProcessed < env.NSU_MAX_BATCHES_PER_RUN) {
    let responseXml;
    try {
      responseXml = await postSoap({
        url: endpoint,
        action:
          "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse",
        body: buildDistributionEnvelope(company, currentNsu),
        pfx: secret.pfx,
        passphrase: secret.passphrase,
      });
    } catch (err) {
      logger.error({ companyId, syncLogId, err, endpoint }, "SEFAZ SOAP request failed");
      throw err;
    }
    try {
      result = parseDistributionResponse(responseXml);
    } catch (err) {
      logger.error(
        { companyId, syncLogId, err, endpoint, responseXmlSnippet: String(responseXml).slice(0, 4000) },
        "Failed to parse SEFAZ distribution response",
      );
      throw new AppError("Falha ao parsear resposta da SEFAZ.", "SEFAZ_PARSE_ERROR", 502);
    }
    if (!["137", "138", "656"].includes(result.cstat)) {
      logger.warn({ companyId, syncLogId, cstat: result.cstat, xmotivo: result.xmotivo, responseXmlSnippet: String(responseXml).slice(0, 4000) }, "Unknown SEFAZ response code");
      throw new AppError(
        result.xmotivo || "Resposta fiscal não reconhecida.",
        "SEFAZ_UNKNOWN_RESPONSE",
        502,
        [{ cstat: result.cstat }],
      );
    }

    const documents = result.cstat === "138" ? extractDocZips(responseXml) : [];
    documentsReceived += documents.length;
    const persistResult = await persistDistribution(company, documents);
    if (persistResult) {
      documentsSaved += persistResult.documentsSaved || 0;
      eventsSaved += persistResult.eventsSaved || 0;
    }
    batchesProcessed += 1;
    currentNsu = result.ultNsu || currentNsu;

    await prisma.company.update({
      where: { id: companyId },
      data: {
        nfeLastNsu: currentNsu,
        nfeMaxNsu: result.maxNsu || company.nfeMaxNsu,
        nfeNextAllowedSyncAt: null,
        lastSyncAt: new Date(),
      },
    });

    const hasMore =
      result.cstat === "138" &&
      result.ultNsu &&
      result.maxNsu &&
      BigInt(result.ultNsu) < BigInt(result.maxNsu);
    if (!hasMore) break;
    if (env.NSU_BATCH_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, env.NSU_BATCH_DELAY_MS));
    }
  }

  if (!result) {
    throw new AppError("Resposta fiscal ausente.", "SEFAZ_EMPTY_RESPONSE", 502);
  }
  const reachedEnd =
    result.ultNsu &&
    result.maxNsu &&
    BigInt(result.ultNsu) >= BigInt(result.maxNsu);
  const waitMs =
    result.cstat === "656"
      ? env.NSU_WAIT_656_MS
      : result.cstat === "137" || reachedEnd
        ? env.NSU_WAIT_137_MS
        : 0;
  const nextAllowedSyncAt = waitMs ? new Date(Date.now() + waitMs) : null;
  const status =
    result.cstat === "138"
      ? "SUCCESS"
      : result.cstat === "137"
        ? "NO_DOCUMENTS"
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
          // documentsCount = total received in distribution; documentsSaved = persisted fiscal documents
          documentsCount: documentsReceived,
          documentsReceived,
          documentsSaved,
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
          environment: company.environment,
          cstat: result.cstat,
          previousUltNsu: company.nfeLastNsu,
          returnedUltNsu: result.ultNsu,
          returnedMaxNsu: result.maxNsu,
            documentsReceived,
            documentsSaved,
            eventsSaved,
          batchesProcessed,
        },
      },
    }),
  ]);
  return {
    syncLogId,
    cstat: result.cstat,
    documentsCount: documentsSaved,
    documentsReceived,
    documentsSaved,
    batchesProcessed,
    mode: "real",
    environment: company.environment,
    lastNsu: result.ultNsu,
    maxNsu: result.maxNsu,
    hasMore:
      result.cstat === "138" &&
      result.ultNsu &&
      result.maxNsu &&
      BigInt(result.ultNsu) < BigInt(result.maxNsu),
  };
}
