import { Router } from "express";
import multer from "multer";

import { prisma } from "../../config/prisma.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { sanitizeXml } from "../../utils/sanitize-xml.js";
import { AppError } from "../../utils/app-error.js";
import { importFiscalXml } from "../../services/fiscal-import.service.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { findDocument, searchDocuments } from "./documents.service.js";

export const documentsRouter = Router({ mergeParams: true });
const xmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

documentsRouter.get(
  "/search",
  rateLimit({ key: "document-search", max: 120 }),
  asyncHandler(async (request, response) => {
    sendSuccess(response, await searchDocuments(request.company.id, request.query));
  }),
);

documentsRouter.post(
  "/import-xml",
  rateLimit({ key: "fiscal-xml-import", max: 30 }),
  xmlUpload.single("xml"),
  asyncHandler(async (request, response) => {
    const xml = request.file?.buffer?.toString("utf8") || request.body?.xml;
    if (!xml) {
      throw new AppError(
        "Envie um arquivo XML de NF-e ou CT-e.",
        "FISCAL_XML_REQUIRED",
        422,
      );
    }
    const result = await importFiscalXml(request.company.id, xml);
    await writeAudit({
      request,
      action: "fiscal_document.imported",
      companyId: request.company.id,
      entityType: "FiscalDocument",
      entityId: result.document.id,
      metadata: {
        documentType: result.document.documentType,
        source: result.document.source,
      },
    });
    sendSuccess(response, result, 201);
  }),
);

documentsRouter.post(
  "/import-erp",
  rateLimit({ key: "erp-import", max: 60 }),
  xmlUpload.single("xml"),
  asyncHandler(async (request, response) => {
    const xml = request.file?.buffer?.toString("utf8") || request.body?.xml;
    if (!xml) {
      throw new AppError(
        "Envie um arquivo XML de NF-e ou CT-e.",
        "FISCAL_XML_REQUIRED",
        422,
      );
    }
    const result = await importFiscalXml(request.company.id, xml, "ERP_IMPORT");
    await writeAudit({
      request,
      action: "fiscal_document.imported",
      companyId: request.company.id,
      entityType: "FiscalDocument",
      entityId: result.document.id,
      metadata: {
        documentType: result.document.documentType,
        source: result.document.source,
      },
    });
    sendSuccess(response, result, 201);
  }),
);

documentsRouter.get(
  "/:documentId/linked-cte",
  asyncHandler(async (request, response) => {
    const document = await findDocument(request.company.id, request.params.documentId);
    const data = await prisma.fiscalDocumentLink.findMany({
      where: {
        companyId: request.company.id,
        OR: [
          { nfeDocumentId: document.id },
          ...(document.accessKey ? [{ nfeAccessKey: document.accessKey }] : []),
        ],
      },
      select: {
        id: true,
        linkType: true,
        source: true,
        createdAt: true,
        cteDocument: { select: {
          id: true, accessKey: true, number: true, series: true,
          issuerName: true, emissionDate: true, totalAmount: true, status: true,
        } },
      },
      orderBy: { createdAt: "desc" },
    });
    sendSuccess(response, {
      data: data.map((item) => ({
        ...item,
        cteDocument: {
          ...item.cteDocument,
          totalAmount: Number(item.cteDocument.totalAmount || 0),
        },
      })),
    });
  }),
);

documentsRouter.get(
  "/:documentId",
  asyncHandler(async (request, response) => {
    sendSuccess(response, await findDocument(request.company.id, request.params.documentId));
  }),
);

documentsRouter.get(
  "/:documentId/xml",
  rateLimit({ key: "xml-download", max: 30 }),
  asyncHandler(async (request, response) => {
    const document = await findDocument(
      request.company.id,
      request.params.documentId,
      true,
    );
    const isDownload = request.query.download === "true";
    if (isDownload) {
      await prisma.xmlDownloadLog.create({
        data: {
          companyId: request.company.id,
          fiscalDocumentId: document.id,
          userId: request.user.id,
          ipAddress: request.ip,
        },
      });
    }
    await writeAudit({
      request,
      action: isDownload ? "document.xml_downloaded" : "document.xml_viewed",
      companyId: request.company.id,
      entityType: "FiscalDocument",
      entityId: document.id,
    });
    sendSuccess(response, {
      id: document.id,
      accessKey: document.accessKey,
      xml: sanitizeXml(document.rawXml || ""),
      hash: document.xmlHashSha256,
    });
  }),
);

documentsRouter.get(
  "/:documentId/events",
  asyncHandler(async (request, response) => {
    await findDocument(request.company.id, request.params.documentId);
    const data = await prisma.fiscalEvent.findMany({
      where: { companyId: request.company.id, fiscalDocumentId: request.params.documentId },
      select: {
        id: true,
        eventType: true,
        eventSequence: true,
        protocol: true,
        eventDate: true,
        nsu: true,
        schemaName: true,
        createdAt: true,
      },
      orderBy: { eventDate: "desc" },
    });
    sendSuccess(response, { data });
  }),
);

documentsRouter.get(
  "/:documentId/audit",
  asyncHandler(async (request, response) => {
    await findDocument(request.company.id, request.params.documentId);
    const data = await prisma.auditLog.findMany({
      where: {
        companyId: request.company.id,
        entityType: "FiscalDocument",
        entityId: request.params.documentId,
      },
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    sendSuccess(response, { data });
  }),
);
