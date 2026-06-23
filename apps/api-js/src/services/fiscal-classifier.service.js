import { normalizeCnpj } from "../utils/cnpj.js";

export function classifyFiscalDocument(company, parsedXml) {
  const companyCnpj = normalizeCnpj(company.cnpj);
  const issuerCnpj = normalizeCnpj(parsedXml.issuerCnpj || "");
  const recipientCnpj = normalizeCnpj(parsedXml.recipientCnpj || "");
  if (parsedXml.documentType === "CTE") {
    if (issuerCnpj === companyCnpj) {
      return { operationDirection: "TRANSPORT_OUTBOUND", companyRole: "ISSUER" };
    }
    const participants = [
      recipientCnpj,
      normalizeCnpj(parsedXml.takerCnpj || ""),
      normalizeCnpj(parsedXml.senderCnpj || ""),
    ];
    if (participants.includes(companyCnpj)) {
      return { operationDirection: "TRANSPORT_INBOUND", companyRole: "TRANSPORT_TAKER" };
    }
  } else {
    if (issuerCnpj === companyCnpj) {
      return { operationDirection: "OUTBOUND", companyRole: "ISSUER" };
    }
    if (recipientCnpj === companyCnpj) {
      return { operationDirection: "INBOUND", companyRole: "RECIPIENT" };
    }
  }
  return { operationDirection: "UNKNOWN", companyRole: "OTHER" };
}
