import { XMLParser } from "fast-xml-parser";

import { env } from "../../config/env.js";
import { postSoap } from "../../services/soap-client.service.js";
import { AppError } from "../../utils/app-error.js";

const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false });

export const NFE_AUTHORIZATION_ENDPOINTS = Object.freeze({
  HOMOLOGATION:
    "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
  PRODUCTION:
    "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
});

const ACTION =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote";

function findFirst(value, key) {
  if (!value || typeof value !== "object") return undefined;
  if (Object.hasOwn(value, key)) return value[key];
  for (const nested of Object.values(value)) {
    const found = findFirst(nested, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function text(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return value["#text"] ?? "";
  return value;
}

function soapEnvelope(xml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${xml}</nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function stripDeclaration(xml) {
  return String(xml).replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
}

function extractProtocolXml(responseXml) {
  return String(responseXml).match(/<(?:\w+:)?protNFe\b[\s\S]*?<\/(?:\w+:)?protNFe>/i)?.[0] || "";
}

function environmentKey(value) {
  return String(value) === "1" || String(value).toLowerCase() === "production"
    ? "PRODUCTION"
    : "HOMOLOGATION";
}

export class SvrsNfeAuthorizationGateway {
  constructor({ transport = postSoap, configuration = env } = {}) {
    this.transport = transport;
    this.configuration = configuration;
  }

  async authorize({ signedXml, environment, pfx, passphrase, lotId }) {
    const target = environmentKey(environment);
    if (!this.configuration.NFE_AUTHORIZATION_ENABLED) {
      throw new AppError(
        "A autorização real de NF-e está desabilitada neste ambiente.",
        "NFE_AUTHORIZATION_DISABLED",
        409,
      );
    }
    if (target === "PRODUCTION" && !this.configuration.ALLOW_PRODUCTION_SEFAZ) {
      throw new AppError(
        "Autorização de NF-e em produção bloqueada pela configuração de segurança.",
        "NFE_PRODUCTION_BLOCKED",
        409,
      );
    }
    const payload = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${lotId}</idLote><indSinc>1</indSinc>${stripDeclaration(signedXml)}</enviNFe>`;
    const configuredUrl = target === "PRODUCTION"
      ? this.configuration.NFE_AUTHORIZATION_PROD_URL
      : this.configuration.NFE_AUTHORIZATION_HOM_URL;
    const responseXml = await this.transport({
      url: configuredUrl || NFE_AUTHORIZATION_ENDPOINTS[target],
      action: ACTION,
      body: soapEnvelope(payload),
      pfx,
      passphrase,
      timeoutMs: this.configuration.NFE_AUTHORIZATION_TIMEOUT_MS,
    });
    const parsed = parser.parse(responseXml);
    const outerStatus = String(text(findFirst(parsed, "cStat")) || "");
    const outerReason = String(text(findFirst(parsed, "xMotivo")) || "");
    const protocolNode = findFirst(parsed, "protNFe");
    const authorizationStatus = String(text(findFirst(protocolNode, "cStat")) || "");
    const authorizationReason = String(text(findFirst(protocolNode, "xMotivo")) || "");
    const protocol = String(text(findFirst(protocolNode, "nProt")) || "");
    const receivedAt = String(text(findFirst(protocolNode, "dhRecbto")) || "");
    const receipt = String(text(findFirst(parsed, "nRec")) || "");
    const protocolXml = extractProtocolXml(responseXml);
    const authorizedXml = authorizationStatus === "100" && protocolXml
      ? `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${stripDeclaration(signedXml)}${protocolXml}</nfeProc>`
      : null;
    return {
      outerStatus,
      outerReason,
      authorizationStatus,
      authorizationReason,
      protocol,
      receipt,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      authorized: outerStatus === "104" && authorizationStatus === "100" && Boolean(protocol),
      responseXml,
      authorizedXml,
    };
  }
}

export const svrsNfeAuthorizationGateway = new SvrsNfeAuthorizationGateway();
