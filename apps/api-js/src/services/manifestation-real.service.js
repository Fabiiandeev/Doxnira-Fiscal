import { randomUUID } from "node:crypto";

import { XMLParser } from "fast-xml-parser";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { sanitizeXml } from "../utils/sanitize-xml.js";
import { loadCertificateSigningMaterial } from "./certificate-vault.service.js";
import { postSoap } from "./soap-client.service.js";
import { buildStorageKey } from "./storage.service.js";
import { hashXml } from "./xml.service.js";
import { signEventXml } from "./xml-signature.service.js";

const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false });
const eventMap = {
  CIENCIA: { code: "210210", description: "Ciencia da Operacao" },
  CONFIRMACAO: { code: "210200", description: "Confirmacao da Operacao" },
  DESCONHECIMENTO: { code: "210220", description: "Desconhecimento da Operacao" },
  OPERACAO_NAO_REALIZADA: { code: "210240", description: "Operacao nao Realizada" },
};

function findFirst(node, key) {
  if (!node || typeof node !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
  for (const value of Object.values(node)) {
    const found = findFirst(value, key);
    if (found !== undefined) return found;
  }
}

function text(value) {
  return typeof value === "object" ? value?.["#text"] : value;
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildEventXml({ company, accessKey, type, justification, sequence }) {
  const event = eventMap[type];
  const tpAmb = env.SEFAZ_ENVIRONMENT === "production" ? "1" : "2";
  const id = `ID${event.code}${accessKey}${String(sequence).padStart(2, "0")}`;
  return `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote><evento versao="1.00"><infEvento Id="${id}"><cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${company.cnpj}</CNPJ><chNFe>${accessKey}</chNFe><dhEvento>${new Date().toISOString()}</dhEvento><tpEvento>${event.code}</tpEvento><nSeqEvento>${sequence}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>${event.description}</descEvento>${event.code === "210240" ? `<xJust>${escapeXml(justification)}</xJust>` : ""}</detEvento></infEvento></evento></envEvento>`;
}

function wrapSoap(signedXml) {
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><nfeDadosMsg>${signedXml}</nfeDadosMsg></nfeRecepcaoEvento></soap12:Body></soap12:Envelope>`;
}

export async function registerRealManifestation({
  company,
  document,
  userId,
  type,
  justification,
}) {
  if (!env.SEFAZ_MANIFESTATION_ENABLED) {
    throw new AppError(
      "Manifestação real desativada por configuração.",
      "SEFAZ_MANIFESTATION_DISABLED",
      409,
    );
  }
  if (env.SEFAZ_ENVIRONMENT === "production" && !env.ALLOW_PRODUCTION_SEFAZ) {
    throw new AppError(
      "Ambiente de produção SEFAZ bloqueado. Ative ALLOW_PRODUCTION_SEFAZ=true apenas após homologação validada.",
      "PRODUCTION_SEFAZ_BLOCKED",
      409,
    );
  }
  const event = eventMap[type];
  if (!event) throw new AppError("Tipo de manifestação inválido.", "MANIFESTATION_TYPE_INVALID", 422);
  if (!document.accessKey || !/^\d{44}$/.test(document.accessKey)) {
    throw new AppError("Chave NF-e inválida.", "NFE_ACCESS_KEY_INVALID", 422);
  }
  if (event.code === "210240" && (!justification || justification.trim().length < 15)) {
    throw new AppError("Justificativa obrigatória.", "JUSTIFICATION_REQUIRED", 422);
  }
  const duplicate = await prisma.manifestation.findFirst({
    where: {
      companyId: company.id,
      accessKey: document.accessKey,
      eventType: event.code,
      status: "REGISTERED_REAL",
    },
  });
  if (duplicate) {
    throw new AppError("Manifestação já registrada.", "MANIFESTATION_DUPLICATE", 409);
  }
  const sequence =
    (await prisma.manifestation.count({
      where: { companyId: company.id, accessKey: document.accessKey, eventType: event.code },
    })) + 1;
  const material = await loadCertificateSigningMaterial(company.id);
  const eventXml = buildEventXml({
    company,
    accessKey: document.accessKey,
    type,
    justification,
    sequence,
  });
  const signedXml = signEventXml(eventXml, material.privateKeyPem, material.certificatePem);
  const endpoint =
    env.SEFAZ_ENVIRONMENT === "production"
      ? env.SEFAZ_EVENT_PROD_URL
      : env.SEFAZ_EVENT_HOM_URL;
  const responseXml = await postSoap({
    url: endpoint,
    action:
      "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",
    body: wrapSoap(signedXml),
    pfx: material.pfx,
    passphrase: material.passphrase,
  });
  const parsed = parser.parse(responseXml);
  const cstat = String(text(findFirst(parsed, "cStat")) || "");
  const xmotivo = String(text(findFirst(parsed, "xMotivo")) || "");
  const protocol = String(text(findFirst(parsed, "nProt")) || "");
  if (!["128", "135", "136", "573"].includes(cstat)) {
    throw new AppError(xmotivo || "Evento rejeitado pela SEFAZ.", "SEFAZ_EVENT_REJECTED", 422, [{ cstat }]);
  }
  const manifestation = await prisma.$transaction(async (transaction) => {
    const created = await transaction.manifestation.create({
      data: {
        companyId: company.id,
        fiscalDocumentId: document.id,
        accessKey: document.accessKey,
        eventType: event.code,
        justification: justification?.trim() || null,
        protocol,
        status: "REGISTERED_REAL",
        responseStorageKey: buildStorageKey("sefaz/manifestations", randomUUID()),
        requestXmlSanitized: sanitizeXml(eventXml),
        responseXmlSanitized: sanitizeXml(responseXml),
      },
    });
    await transaction.fiscalEvent.create({
      data: {
        companyId: company.id,
        fiscalDocumentId: document.id,
        accessKey: document.accessKey,
        eventType: event.code,
        eventSequence: sequence,
        protocol,
        eventDate: new Date(),
        schemaName: "procEventoNFe_v1.00.xsd",
        xmlStorageKey: buildStorageKey("sefaz/events", created.id),
        xmlHashSha256: hashXml(signedXml),
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: company.id,
        userId,
        action: "manifestation.registered_real",
        entityType: "FiscalDocument",
        entityId: document.id,
        metadata: { type, eventCode: event.code, cstat, protocol },
      },
    });
    return created;
  });
  return { manifestation, cstat, xmotivo, protocol };
}
