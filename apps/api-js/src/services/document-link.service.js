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
