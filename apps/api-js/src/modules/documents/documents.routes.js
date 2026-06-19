import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { sanitizeXml } from "../../utils/sanitize-xml.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { findDocument, searchDocuments } from "./documents.service.js";

export const documentsRouter = Router({ mergeParams: true });

documentsRouter.get(
  "/search",
  rateLimit({ key: "document-search", max: 120 }),
  asyncHandler(async (request, response) => {
    sendSuccess(response, await searchDocuments(request.company.id, request.query));
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
