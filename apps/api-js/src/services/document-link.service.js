import { prisma } from "../config/prisma.js";
import { hashXml } from "./xml.service.js";
import { buildStorageKey } from "./storage.service.js";
import { parseCteXml } from "./cte-parser.service.js";

export async function importCteXml(companyId, xml) {
  const metadata = parseCteXml(xml);
  const cte = await prisma.transportDocument.upsert({
    where: {
      companyId_accessKey: { companyId, accessKey: metadata.accessKey },
    },
    create: {
      companyId,
      accessKey: metadata.accessKey,
      number: metadata.number,
      series: metadata.series,
      emissionDate: metadata.emissionDate ? new Date(metadata.emissionDate) : null,
      issuerCnpj: metadata.issuerCnpj,
      issuerName: metadata.issuerName,
      recipientCnpj: metadata.recipientCnpj,
      recipientName: metadata.recipientName,
      totalAmount: metadata.totalAmount,
      status: metadata.status,
      xmlStorageKey: buildStorageKey("cte", metadata.accessKey),
      rawXmlHash: hashXml(xml),
      rawXml: xml,
    },
    update: {
      status: metadata.status,
      rawXmlHash: hashXml(xml),
      rawXml: xml,
    },
  });
  for (const nfeAccessKey of metadata.referencedNfeKeys) {
    const nfe = await prisma.fiscalDocument.findFirst({
      where: { companyId, accessKey: nfeAccessKey },
      select: { id: true },
    });
    await prisma.fiscalDocumentLink.upsert({
      where: {
        companyId_nfeAccessKey_cteAccessKey_linkType: {
          companyId,
          nfeAccessKey,
          cteAccessKey: metadata.accessKey,
          linkType: "NFE_CTE",
        },
      },
      create: {
        companyId,
        nfeDocumentId: nfe?.id || null,
        cteDocumentId: cte.id,
        nfeAccessKey,
        cteAccessKey: metadata.accessKey,
        linkType: "NFE_CTE",
        source: "CTE_XML",
      },
      update: { nfeDocumentId: nfe?.id || undefined },
    });
  }
  return { cte, linkedNfeCount: metadata.referencedNfeKeys.length };
}

export async function reconcileNfeLinks(companyId, nfeDocumentId, accessKey) {
  if (!accessKey) return 0;
  const result = await prisma.fiscalDocumentLink.updateMany({
    where: { companyId, nfeAccessKey: accessKey, nfeDocumentId: null },
    data: { nfeDocumentId },
  });
  return result.count;
}

export async function reconcileTransportDocumentLinks({ companyId, transportDocumentId }) {
  const cte = await prisma.transportDocument.findFirst({ where: { id: transportDocumentId, companyId }, select: { id: true, accessKey: true, rawXml: true } });
  if (!cte) return null;
  if (!cte.rawXml) return { created: 0, alreadyExisting: 0, pending: 0, xmlAvailability: "MISSING" };
  const keys = [...new Set(parseCteXml(cte.rawXml).referencedNfeKeys.filter((key) => /^\d{44}$/.test(key)))];
  let created = 0; let alreadyExisting = 0; let pending = 0;
  for (const nfeAccessKey of keys) {
    const nfe = await prisma.fiscalDocument.findFirst({ where: { companyId, accessKey: nfeAccessKey }, select: { id: true } });
    const existing = await prisma.fiscalDocumentLink.findUnique({ where: { companyId_nfeAccessKey_cteAccessKey_linkType: { companyId, nfeAccessKey, cteAccessKey: cte.accessKey, linkType: "NFE_CTE" } } });
    if (existing) { alreadyExisting += 1; if (!existing.nfeDocumentId && nfe) await prisma.fiscalDocumentLink.update({ where: { id: existing.id }, data: { nfeDocumentId: nfe.id } }); }
    else { await prisma.fiscalDocumentLink.create({ data: { companyId, nfeDocumentId: nfe?.id || null, cteDocumentId: cte.id, nfeAccessKey, cteAccessKey: cte.accessKey, linkType: "NFE_CTE", source: "CTE_XML" } }); created += 1; }
    if (!nfe) pending += 1;
  }
  return { created, alreadyExisting, pending, xmlAvailability: "FULL" };
}
