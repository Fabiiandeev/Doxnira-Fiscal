import { XMLParser } from "fast-xml-parser";

import { AppError } from "../utils/app-error.js";
import { parseItemTaxes, parseTaxTotals } from "./tax-parser.service.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function findAll(node, key, results = []) {
  if (!node || typeof node !== "object") return results;
  if (Object.prototype.hasOwnProperty.call(node, key)) {
    results.push(...(Array.isArray(node[key]) ? node[key] : [node[key]]));
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => findAll(item, key, results));
    else findAll(value, key, results);
  }
  return results;
}

function first(node, key) {
  return findAll(node, key)[0];
}

function text(value) {
  if (value == null) return null;
  if (typeof value === "object") return value["#text"] ?? null;
  return String(value);
}

function number(value) {
  const parsed = Number(text(value) ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNfe(parsed) {
  const infNfe = first(parsed, "infNFe") || {};
  const ide = first(infNfe, "ide") || {};
  const issuer = first(infNfe, "emit") || {};
  const recipient = first(infNfe, "dest") || {};
  const total = first(infNfe, "ICMSTot") || {};
  const accessKey =
    text(first(parsed, "chNFe")) ||
    text(infNfe["@_Id"])?.replace(/^NFe/, "") ||
    null;
  const items = findAll(infNfe, "det").map((item, index) => {
    const product = item.prod || {};
    return {
      itemNumber: Number(item["@_nItem"] || index + 1),
      productCode: text(product.cProd),
      ean: text(product.cEAN),
      description: text(product.xProd),
      ncm: text(product.NCM),
      cfop: text(product.CFOP),
      quantity: number(product.qCom),
      unit: text(product.uCom),
      unitValue: number(product.vUnCom),
      totalValue: number(product.vProd),
      discountValue: number(product.vDesc),
      ...parseItemTaxes(item.imposto || {}),
    };
  });
  const taxes = parseTaxTotals(total);
  return {
    documentType: "NFE",
    accessKey,
    model: text(ide.mod) || "55",
    number: text(ide.nNF),
    series: text(ide.serie),
    emissionDate: text(ide.dhEmi || ide.dEmi),
    issuerCnpj: text(issuer.CNPJ || issuer.CPF),
    issuerName: text(issuer.xNome),
    recipientCnpj: text(recipient.CNPJ || recipient.CPF),
    recipientName: text(recipient.xNome),
    issuerUf: text(issuer.enderEmit?.UF),
    cfop: items[0]?.cfop || null,
    totalAmount: number(total.vNF),
    protocol: text(first(parsed, "nProt")),
    status: text(first(parsed, "cStat")) === "101" ? "CANCELLED" : "AUTHORIZED",
    isCancelled: text(first(parsed, "cStat")) === "101",
    isSummary: !findAll(infNfe, "det").length,
    items,
    ...taxes,
  };
}

function parseCte(parsed) {
  const infCte = first(parsed, "infCte") || {};
  const ide = first(infCte, "ide") || {};
  const issuer = first(infCte, "emit") || {};
  const recipient = first(infCte, "dest") || {};
  const sender = first(infCte, "rem") || {};
  const taker = first(infCte, "toma4") || first(infCte, "toma3") || {};
  const icms = first(infCte, "ICMS") || {};
  const accessKey =
    text(first(parsed, "chCTe")) ||
    text(infCte["@_Id"])?.replace(/^CTe/, "") ||
    null;
  const icmsAmount = number(first(icms, "vICMS"));
  const freightAmount = number(first(infCte, "vTPrest"));
  return {
    documentType: "CTE",
    accessKey,
    model: text(ide.mod) || "57",
    number: text(ide.nCT),
    series: text(ide.serie),
    emissionDate: text(ide.dhEmi),
    issuerCnpj: text(issuer.CNPJ || issuer.CPF),
    issuerName: text(issuer.xNome),
    recipientCnpj: text(recipient.CNPJ || recipient.CPF),
    recipientName: text(recipient.xNome),
    senderCnpj: text(sender.CNPJ || sender.CPF),
    takerCnpj: text(taker.CNPJ || taker.CPF),
    issuerUf: text(issuer.enderEmit?.UF),
    cfop: text(ide.CFOP),
    totalAmount: freightAmount,
    freightAmount,
    productsAmount: 0,
    discountAmount: 0,
    icmsBase: number(first(icms, "vBC")),
    icmsAmount,
    icmsStAmount: 0,
    fcpAmount: 0,
    ipiAmount: 0,
    pisAmount: 0,
    cofinsAmount: 0,
    otherAmount: 0,
    taxAmount: icmsAmount,
    protocol: text(first(parsed, "nProt")),
    status: text(first(parsed, "cStat")) === "101" ? "CANCELLED" : "AUTHORIZED",
    isCancelled: text(first(parsed, "cStat")) === "101",
    isSummary: false,
    items: [],
    referencedNfeKeys: [
      ...new Set(
        [...findAll(infCte, "chave"), ...findAll(infCte, "chNFe")]
          .map(text)
          .filter((key) => /^\d{44}$/.test(key || "")),
      ),
    ],
  };
}

export function parseFiscalDocumentXml(xml) {
  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new AppError("XML fiscal inválido.", "FISCAL_XML_INVALID", 422);
  }
  const model = text(first(parsed, "mod"));
  const result = model === "57" || first(parsed, "infCte") ? parseCte(parsed) : parseNfe(parsed);
  if (!result.accessKey || !/^\d{44}$/.test(result.accessKey)) {
    throw new AppError("Chave de acesso do documento inválida.", "FISCAL_ACCESS_KEY_INVALID", 422);
  }
  if (!["55", "57"].includes(result.model)) {
    throw new AppError("Somente XML NF-e modelo 55 ou CT-e modelo 57 é aceito.", "FISCAL_MODEL_UNSUPPORTED", 422);
  }
  return result;
}
