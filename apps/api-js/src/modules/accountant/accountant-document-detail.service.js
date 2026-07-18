import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

const decimal = (value) => value == null ? null : value.toString();
const date = (value) => value ? value.toISOString() : null;

export function canDownloadAccountantXml(xmlAvailability, hasDownloadGrant) {
  return xmlAvailability === "FULL" && hasDownloadGrant;
}

export async function getAccountantFiscalDocumentDetail({ companyId, documentId, officeId, canDownload }) {
  const document = await prisma.fiscalDocument.findFirst({
    where: { id: documentId, companyId },
    select: {
      id: true, companyId: true, documentType: true, operationDirection: true, model: true, invoiceNumber: true, series: true,
      accessKey: true, emissionDate: true, authorizationDate: true, protocol: true, status: true, source: true, isCancelled: true,
      isSummary: true, rawXml: true, productsAmount: true, freightAmount: true, discountAmount: true, otherAmount: true,
      totalAmount: true, icmsBase: true, icmsAmount: true, icmsStAmount: true, fcpAmount: true, ipiAmount: true, pisAmount: true, cofinsAmount: true,
      issuerName: true, issuerCnpj: true, recipientName: true, recipientCnpj: true, uf: true,
      items: { orderBy: { itemNumber: "asc" } },
      events: { orderBy: { eventDate: "asc" }, select: { id: true, eventType: true, eventSequence: true, eventDate: true, protocol: true, schemaName: true } },
      alerts: { where: { status: "open" }, orderBy: { createdAt: "desc" }, select: { id: true, type: true, severity: true, title: true, message: true, status: true, createdAt: true } },
      transportLinks: { select: { id: true, linkType: true, source: true, cteDocument: { select: { id: true, accessKey: true, number: true, series: true, issuerName: true, recipientName: true, emissionDate: true, totalAmount: true, status: true } } } },
    },
  });
  if (!document) throw new AppError("Documento fiscal não encontrado.", "DOCUMENT_NOT_FOUND", 404);
  const review = await prisma.accountantDocumentReview.findUnique({
    where: { officeId_fiscalDocumentId: { officeId, fiscalDocumentId: document.id } },
    select: { status: true, note: true, reviewedAt: true, reopenedAt: true, reopenReason: true, updatedAt: true, user: { select: { id: true, name: true } } },
  });
  const availability = document.rawXml ? (document.isSummary ? "SUMMARY" : "FULL") : "MISSING";
  return {
    id: document.id, companyId: document.companyId, documentType: document.documentType, operationDirection: document.operationDirection,
    identification: { model: document.model, number: document.invoiceNumber, series: document.series, accessKey: document.accessKey, issueDate: date(document.emissionDate), authorizationDate: date(document.authorizationDate), protocol: document.protocol, environment: null, status: document.status || "UNKNOWN", origin: document.source, isCancelled: document.isCancelled, cancellationDate: null },
    issuer: document.issuerName || document.issuerCnpj ? { name: document.issuerName, document: document.issuerCnpj, stateRegistration: null, city: null, uf: document.uf, address: null } : null,
    recipient: document.recipientName || document.recipientCnpj ? { name: document.recipientName, document: document.recipientCnpj, stateRegistration: null, city: null, uf: null, address: null } : null,
    totals: { products: decimal(document.productsAmount), freight: decimal(document.freightAmount), insurance: null, discount: decimal(document.discountAmount), otherExpenses: decimal(document.otherAmount), total: decimal(document.totalAmount), icmsBase: decimal(document.icmsBase), icms: decimal(document.icmsAmount), icmsStBase: null, icmsSt: decimal(document.icmsStAmount), fcp: decimal(document.fcpAmount), ipi: decimal(document.ipiAmount), pis: decimal(document.pisAmount), cofins: decimal(document.cofinsAmount) },
    items: document.items.map((item) => ({ number: item.itemNumber, code: item.productCode, description: item.description, ean: item.ean, ncm: item.ncm, cest: null, cfop: item.cfop, cst: item.cst, csosn: item.csosn, unit: item.unit, quantity: decimal(item.quantity), unitValue: decimal(item.unitValue), totalValue: decimal(item.totalValue), icmsBase: decimal(item.icmsBase), icmsRate: decimal(item.icmsRate), icmsAmount: decimal(item.icmsAmount), ipiAmount: decimal(item.ipiAmount), pisAmount: decimal(item.pisAmount), cofinsAmount: decimal(item.cofinsAmount) })),
    transport: null, billing: null,
    events: document.events.map((event) => ({ id: event.id, type: event.eventType, sequence: event.eventSequence, date: date(event.eventDate), protocol: event.protocol, schema: event.schemaName })),
    alerts: document.alerts.map((alert) => ({ id: alert.id, code: alert.type, severity: alert.severity, title: alert.title, message: alert.message, status: alert.status, createdAt: date(alert.createdAt) })),
    review: review ? { ...review, reviewedAt: date(review.reviewedAt), reopenedAt: date(review.reopenedAt), updatedAt: date(review.updatedAt) } : null,
    xml: { availability, canView: availability !== "MISSING", canDownload: canDownloadAccountantXml(availability, canDownload) },
    relatedTransportDocuments: document.transportLinks.map((link) => ({ id: link.cteDocument.id, linkType: link.linkType, source: link.source, accessKey: link.cteDocument.accessKey, number: link.cteDocument.number, series: link.cteDocument.series, issuerName: link.cteDocument.issuerName, recipientName: link.cteDocument.recipientName, issueDate: date(link.cteDocument.emissionDate), total: decimal(link.cteDocument.totalAmount), status: link.cteDocument.status })),
  };
}

export async function getAccountantTransportDocumentDetail({ companyId, documentId, officeId, canDownload, canDownloadNfe }) {
  const cte = await prisma.transportDocument.findFirst({
    where: { id: documentId, companyId },
    include: {
      nfeLinks: {
        include: { nfeDocument: { select: { id: true, invoiceNumber: true, series: true, accessKey: true, issuerName: true, recipientName: true, emissionDate: true, totalAmount: true, status: true, rawXml: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!cte) throw new AppError("CT-e não encontrado.", "CTE_NOT_FOUND", 404);
  const review = await prisma.accountantDocumentReview.findUnique({
    where: { officeId_transportDocumentId: { officeId, transportDocumentId: cte.id } },
    select: { status: true, note: true, reviewedAt: true, reopenedAt: true, reopenReason: true, updatedAt: true, user: { select: { id: true, name: true } } },
  });
  const availability = cte.rawXml ? "FULL" : "MISSING";
  const linked = cte.nfeLinks.filter((link) => link.nfeDocumentId);
  const pending = cte.nfeLinks.filter((link) => !link.nfeDocumentId);
  return {
    id: cte.id, companyId: cte.companyId, documentType: "CTE", operationDirection: null,
    identification: { model: "57", number: cte.number, series: cte.series, accessKey: cte.accessKey, issueDate: date(cte.emissionDate), authorizationDate: null, protocol: null, environment: null, status: cte.status || "UNKNOWN", origin: null, isCancelled: /CANCEL/i.test(cte.status || ""), cancellationDate: null },
    issuer: cte.issuerName || cte.issuerCnpj ? { name: cte.issuerName, document: cte.issuerCnpj, stateRegistration: null, city: null, uf: null, address: null } : null,
    recipient: cte.recipientName || cte.recipientCnpj ? { name: cte.recipientName, document: cte.recipientCnpj, stateRegistration: null, city: null, uf: null, address: null } : null,
    totals: { serviceValue: decimal(cte.totalAmount), amountReceivable: null, icmsBase: null, icmsRate: null, icms: null, taxReduction: null, otherTaxes: null, total: decimal(cte.totalAmount) },
    items: [], events: [], alerts: [],
    review: review ? { ...review, reviewedAt: date(review.reviewedAt), reopenedAt: date(review.reopenedAt), updatedAt: date(review.updatedAt) } : null,
    xml: { availability, canView: availability !== "MISSING", canDownload: canDownloadAccountantXml(availability, canDownload) },
    nfeLinks: linked.map((link) => ({
      id: link.id,
      accessKey: link.nfeAccessKey,
      source: link.source,
      createdAt: link.createdAt.toISOString(),
      xml: { availability: link.nfeDocument?.rawXml ? "FULL" : "MISSING", canDownload: canDownloadAccountantXml(link.nfeDocument?.rawXml ? "FULL" : "MISSING", Boolean(canDownloadNfe)) },
      document: { ...link.nfeDocument, totalAmount: link.nfeDocument?.totalAmount?.toString() || null },
    })),
    pendingReferences: pending.map((link) => ({ id: link.id, accessKey: link.nfeAccessKey, source: link.source, createdAt: link.createdAt.toISOString(), status: "PENDING_DOCUMENT" })),
  };
}
