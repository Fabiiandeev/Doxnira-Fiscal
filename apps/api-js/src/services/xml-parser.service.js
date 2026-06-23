import { XMLParser } from "fast-xml-parser";
import { parseFiscalDocumentXml } from "./fiscal-xml-parser.service.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function findFirst(node, key) {
  if (!node || typeof node !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFirst(item, key);
        if (found !== undefined) return found;
      }
    } else {
      const found = findFirst(value, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function text(value) {
  if (value == null) return null;
  if (typeof value === "object") return value["#text"] ?? null;
  return String(value);
}

export function parseDistributionResponse(xml) {
  const normalized = String(xml)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
  const parsed = parser.parse(normalized);
  return {
    cstat: text(findFirst(parsed, "cStat")),
    xmotivo: text(findFirst(parsed, "xMotivo")),
    ultNsu: text(findFirst(parsed, "ultNSU")),
    maxNsu: text(findFirst(parsed, "maxNSU")),
  };
}

export function parseFiscalXml(xml, schema, nsu) {
  const parsed = parser.parse(xml);
  const accessKey =
    text(findFirst(parsed, "chNFe")) ||
    text(findFirst(parsed, "infNFe")?.["@_Id"])?.replace(/^NFe/, "") ||
    null;
  const issuer = findFirst(parsed, "emit") || {};
  const recipient = findFirst(parsed, "dest") || {};
  const total = findFirst(parsed, "ICMSTot") || {};
  const isEvent = /evento/i.test(schema);
  if (!isEvent) {
    try {
      const fiscal = parseFiscalDocumentXml(xml);
      return {
        kind: "document",
        nsu,
        schema,
        ...fiscal,
        invoiceNumber: fiscal.number,
      };
    } catch {
      // Resumos da distribuição não possuem todos os grupos do XML completo.
    }
  }
  return {
    kind: isEvent ? "event" : "document",
    nsu,
    schema,
    accessKey,
    issuerCnpj: text(issuer.CNPJ || issuer.CPF),
    issuerName: text(issuer.xNome),
    recipientCnpj: text(recipient.CNPJ || recipient.CPF),
    recipientName: text(recipient.xNome),
    invoiceNumber: text(findFirst(parsed, "nNF")),
    series: text(findFirst(parsed, "serie")),
    model: text(findFirst(parsed, "mod")),
    protocol: text(findFirst(parsed, "nProt")),
    emissionDate: text(findFirst(parsed, "dhEmi") || findFirst(parsed, "dEmi")),
    totalAmount: Number(text(total.vNF || findFirst(parsed, "vNF")) || 0),
    productsAmount: 0,
    freightAmount: 0,
    discountAmount: 0,
    icmsAmount: 0,
    ipiAmount: 0,
    pisAmount: 0,
    cofinsAmount: 0,
    icmsBase: 0,
    icmsStAmount: 0,
    fcpAmount: 0,
    otherAmount: 0,
    taxAmount: 0,
    items: [],
    eventType: text(findFirst(parsed, "tpEvento")),
    eventDate: text(findFirst(parsed, "dhEvento")),
    isSummary: /^res/i.test(schema),
    isCancelled: text(findFirst(parsed, "cSitNFe")) === "3",
  };
}
