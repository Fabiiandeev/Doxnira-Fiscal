import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { classifyFiscalDocument } from "./fiscal-classifier.service.js";
import { parseFiscalDocumentXml } from "./fiscal-xml-parser.service.js";
import { importCteXml, reconcileNfeLinks } from "./document-link.service.js";
import { buildStorageKey } from "./storage.service.js";
import { hashXml } from "./xml.service.js";

export async function importFiscalXml(companyId, xml, source = "MANUAL_IMPORT") {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("Empresa não encontrada.", "COMPANY_NOT_FOUND", 404);
  const parsed = parseFiscalDocumentXml(xml);
  const classification = classifyFiscalDocument(company, parsed);
  if (classification.operationDirection === "UNKNOWN") {
    if (source === "ERP_IMPORT") {
      // register a warning but continue saving the document with UNKNOWN direction
      await prisma.auditLog.create({
        data: {
          companyId,
          action: "import.warning",
          entityType: "FiscalDocument",
          entityId: null,
          metadata: {
            code: "DOCUMENT_UNKNOWN_DIRECTION",
            message: "Documento importado pelo ERP sem classificação de entrada/saída.",
            field: "operationDirection",
            cause: "O CNPJ da empresa não foi identificado como emitente, destinatário ou tomador no XML.",
            suggestion: "Revise o XML ou cadastre o vínculo correto da empresa.",
            accessKey: parsed.accessKey || null,
          },
        },
      });
    } else {
      throw new AppError(
        "O CNPJ da empresa não participa do documento fiscal.",
        "COMPANY_NOT_IN_DOCUMENT",
        422,
      );
    }
  }
  const duplicate = await prisma.fiscalDocument.findFirst({
    where: { companyId, accessKey: parsed.accessKey },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError("Documento fiscal já importado.", "FISCAL_DOCUMENT_DUPLICATE", 409);
  }

  let transport = null;
  if (parsed.documentType === "CTE") {
    transport = await importCteXml(companyId, xml);
  }
  const xmlHash = hashXml(xml);
  const document = await prisma.fiscalDocument.create({
    data: {
      companyId,
      documentType: parsed.documentType,
      operationDirection: classification.operationDirection,
      companyRole: classification.companyRole,
      invoiceNumber: parsed.number,
      series: parsed.series,
      model: parsed.model,
      accessKey: parsed.accessKey,
      schemaName: `${source.toLowerCase()}-${parsed.documentType.toLowerCase()}`,
      status: parsed.status,
      protocol: parsed.protocol,
      issuerCnpj: parsed.issuerCnpj,
      issuerName: parsed.issuerName,
      recipientCnpj: parsed.recipientCnpj,
      recipientName: parsed.recipientName,
      uf: parsed.issuerUf,
      cfop: parsed.cfop,
      emissionDate: parsed.emissionDate ? new Date(parsed.emissionDate) : null,
      totalAmount: parsed.totalAmount,
      productsAmount: parsed.productsAmount,
      freightAmount: parsed.freightAmount,
      discountAmount: parsed.discountAmount,
      icmsAmount: parsed.icmsAmount,
      ipiAmount: parsed.ipiAmount,
      pisAmount: parsed.pisAmount,
      cofinsAmount: parsed.cofinsAmount,
      icmsBase: parsed.icmsBase,
      icmsStAmount: parsed.icmsStAmount,
      fcpAmount: parsed.fcpAmount,
      otherAmount: parsed.otherAmount,
      taxAmount: parsed.taxAmount,
      xmlStorageKey: buildStorageKey(
        `imports/${source.toLowerCase()}/${parsed.documentType.toLowerCase()}`,
        parsed.accessKey,
      ),
      xmlHashSha256: xmlHash,
      rawXmlHash: xmlHash,
      source,
      rawXml: xml,
      isSummary: parsed.isSummary,
      isCancelled: parsed.isCancelled,
      products: parsed.items,
      taxes: {
        icms: parsed.icmsAmount,
        ipi: parsed.ipiAmount,
        pis: parsed.pisAmount,
        cofins: parsed.cofinsAmount,
      },
      items: {
        create: parsed.items.map((item) => ({ companyId, ...item })),
      },
    },
  });
  if (parsed.documentType === "NFE") {
    await reconcileNfeLinks(companyId, document.id, parsed.accessKey);
  }
  return {
    document: {
      ...document,
      rawXml: undefined,
      totalAmount: Number(document.totalAmount || 0),
    },
    linkedNfeCount: transport?.linkedNfeCount || 0,
  };
}
