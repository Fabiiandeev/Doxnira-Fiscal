import { XMLParser } from "fast-xml-parser";

import { AppError } from "../utils/app-error.js";

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
    const values = Array.isArray(node[key]) ? node[key] : [node[key]];
    results.push(...values);
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

function value(input) {
  if (input == null) return null;
  if (typeof input === "object") return input["#text"] ?? null;
  return String(input);
}

export function parseCteXml(xml) {
  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new AppError("XML de CT-e inválido.", "CTE_XML_INVALID", 422);
  }
  const infCte = first(parsed, "infCte");
  const accessKey =
    value(first(parsed, "chCTe")) ||
    value(infCte?.["@_Id"])?.replace(/^CTe/, "") ||
    null;
  if (!accessKey || !/^\d{44}$/.test(accessKey)) {
    throw new AppError("Chave do CT-e inválida.", "CTE_ACCESS_KEY_INVALID", 422);
  }
  const issuer = first(parsed, "emit") || {};
  const recipient = first(parsed, "dest") || {};
  const referencedNfeKeys = [
    ...new Set(
      findAll(parsed, "chave")
        .map(value)
        .filter((key) => /^\d{44}$/.test(key || "")),
    ),
  ];
  return {
    accessKey,
    number: value(first(parsed, "nCT")),
    series: value(first(parsed, "serie")),
    emissionDate: value(first(parsed, "dhEmi")),
    issuerCnpj: value(issuer.CNPJ || issuer.CPF),
    issuerName: value(issuer.xNome),
    recipientCnpj: value(recipient.CNPJ || recipient.CPF),
    recipientName: value(recipient.xNome),
    totalAmount: Number(value(first(parsed, "vTPrest")) || 0),
    status: value(first(parsed, "cStat")) === "101" ? "CANCELLED" : "AUTHORIZED",
    referencedNfeKeys,
  };
}
