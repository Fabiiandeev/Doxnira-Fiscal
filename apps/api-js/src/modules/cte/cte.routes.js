import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { sanitizeXml } from "../../utils/sanitize-xml.js";
import { importCteXml } from "../../services/document-link.service.js";
import { writeAudit } from "../audit/audit.service.js";

const importSchema = z.object({ xml: z.string().min(50).max(5_000_000) });
const cteSelect = {
  id: true,
  accessKey: true,
  number: true,
  series: true,
  emissionDate: true,
  issuerCnpj: true,
  issuerName: true,
  recipientCnpj: true,
  recipientName: true,
  totalAmount: true,
  status: true,
  createdAt: true,
  _count: { select: { nfeLinks: true } },
};

async function findCte(companyId, cteId, includeXml = false) {
  const cte = await prisma.transportDocument.findFirst({
    where: { id: cteId, companyId },
    select: { ...cteSelect, ...(includeXml ? { rawXml: true, rawXmlHash: true } : {}) },
  });
  if (!cte) throw new AppError("CT-e não encontrado.", "CTE_NOT_FOUND", 404);
  return { ...cte, totalAmount: Number(cte.totalAmount || 0) };
}

export const cteRouter = Router({ mergeParams: true });

cteRouter.get("/search", asyncHandler(async (request, response) => {
  const { page, pageSize, skip, take } = getPagination(request.query, 10);
  const term = request.query.query?.trim();
  const where = {
    companyId: request.company.id,
    ...(term
      ? {
          OR: [
            { accessKey: { contains: term } },
            { number: { contains: term, mode: "insensitive" } },
            { issuerName: { contains: term, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.transportDocument.findMany({
      where,
      select: cteSelect,
      orderBy: { emissionDate: "desc" },
      skip,
      take,
    }),
    prisma.transportDocument.count({ where }),
  ]);
  sendSuccess(response, {
    data: data.map((item) => ({ ...item, totalAmount: Number(item.totalAmount || 0) })),
    pagination: paginationMeta(page, pageSize, total),
  });
}));

cteRouter.post(
  "/import-xml",
  rateLimit({ key: "cte-import", max: 20 }),
  validate(importSchema),
  asyncHandler(async (request, response) => {
    const result = await importCteXml(request.company.id, request.body.xml);
    await writeAudit({
      request,
      action: "cte.imported",
      companyId: request.company.id,
      entityType: "TransportDocument",
      entityId: result.cte.id,
      metadata: {
        cteAccessKey: result.cte.accessKey,
        linkedNfeCount: result.linkedNfeCount,
      },
    });
    sendSuccess(response, {
      cte: { ...result.cte, rawXml: undefined },
      linkedNfeCount: result.linkedNfeCount,
    }, 201);
  }),
);

cteRouter.get("/:cteId", asyncHandler(async (request, response) => {
  sendSuccess(response, await findCte(request.company.id, request.params.cteId));
}));

cteRouter.get("/:cteId/xml", asyncHandler(async (request, response) => {
  const cte = await findCte(request.company.id, request.params.cteId, true);
  sendSuccess(response, {
    id: cte.id,
    accessKey: cte.accessKey,
    xml: sanitizeXml(cte.rawXml || ""),
    hash: cte.rawXmlHash,
  });
}));

cteRouter.get("/:cteId/linked-nfe", asyncHandler(async (request, response) => {
  await findCte(request.company.id, request.params.cteId);
  const data = await prisma.fiscalDocumentLink.findMany({
    where: { companyId: request.company.id, cteDocumentId: request.params.cteId },
    select: {
      id: true,
      nfeAccessKey: true,
      linkType: true,
      source: true,
      createdAt: true,
      nfeDocument: {
        select: {
          id: true,
          invoiceNumber: true,
          issuerName: true,
          emissionDate: true,
          totalAmount: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(response, {
    data: data.map((item) => ({
      ...item,
      nfeDocument: item.nfeDocument
        ? { ...item.nfeDocument, totalAmount: Number(item.nfeDocument.totalAmount || 0) }
        : null,
    })),
  });
}));
