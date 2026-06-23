import forge from "node-forge";

import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { isValidCnpj, normalizeCnpj } from "../utils/cnpj.js";
import { daysRemaining } from "../utils/date.js";
import {
  decryptBuffer,
  decryptText,
  encryptBuffer,
  encryptText,
} from "../utils/crypto.js";

export const certificatePublicSelect = {
  id: true,
  serialNumber: true,
  subject: true,
  issuer: true,
  validFrom: true,
  validUntil: true,
  holderCnpj: true,
  validatedAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export function serializeCertificate(certificate) {
  if (!certificate) return null;
  const remaining = daysRemaining(certificate.validUntil);
  return {
    ...certificate,
    daysRemaining: remaining,
    expired: remaining != null && remaining < 0,
    valid:
      certificate.status === "active" &&
      certificate.validatedAt != null &&
      remaining != null &&
      remaining >= 0,
  };
}

export async function getCurrentCertificate(companyId) {
  return prisma.digitalCertificate.findFirst({
    where: { companyId, status: "active" },
    select: certificatePublicSelect,
    orderBy: { createdAt: "desc" },
  });
}

function formatDistinguishedName(attributes) {
  return attributes
    .map((attribute) => `${attribute.shortName || attribute.name}=${attribute.value}`)
    .join(", ");
}

function cnpjCandidates(value, allowTrailingDigits = false) {
  const text = String(value || "");
  const matches = [
    ...(text.match(/\d{2}[.\s]?\d{3}[.\s]?\d{3}[/-]?\d{4}-?\d{2}/g) || []),
  ].map(normalizeCnpj);
  if (allowTrailingDigits) {
    const digits = normalizeCnpj(text);
    if (digits.length >= 14) matches.push(digits.slice(-14));
  }
  return matches.filter((candidate) => candidate.length === 14 && isValidCnpj(candidate));
}

function primitiveText(node) {
  if (!node) return "";
  if (Array.isArray(node.value)) return node.value.map(primitiveText).join(" ");
  return typeof node.value === "string" ? node.value : "";
}

function extractIcpBrasilCnpj(node) {
  if (!node || !Array.isArray(node.value)) return null;
  const hasCnpjOid = node.value.some(
    (child) =>
      child.type === forge.asn1.Type.OID &&
      forge.asn1.derToOid(child.value) === "2.16.76.1.3.3",
  );
  if (hasCnpjOid) {
    const candidates = cnpjCandidates(primitiveText(node), true);
    if (candidates.length) return candidates[0];
  }
  for (const child of node.value) {
    const candidate = extractIcpBrasilCnpj(child);
    if (candidate) return candidate;
  }
  return null;
}

export function extractHolderCnpjFromCertificate(certificate) {
  const attributes = certificate.subject?.attributes || [];
  for (const attribute of attributes) {
    const name = String(attribute.name || "").toLowerCase();
    const shortName = String(attribute.shortName || "").toLowerCase();
    const type = String(attribute.type || "");
    if (name.includes("cnpj") || shortName.includes("cnpj") || type === "2.16.76.1.3.3") {
      const candidates = cnpjCandidates(attribute.value, true);
      if (candidates.length) return candidates[0];
    }
  }

  const commonName = attributes.find((attribute) => {
    const name = String(attribute.name || "").toLowerCase();
    const shortName = String(attribute.shortName || "").toLowerCase();
    return shortName === "cn" || name === "commonname";
  });
  const commonNameCandidates = cnpjCandidates(commonName?.value);
  if (commonNameCandidates.length) return commonNameCandidates[0];

  const subjectAltName = (certificate.extensions || []).find(
    (extension) =>
      extension.name === "subjectAltName" || extension.id === "2.5.29.17",
  );
  if (subjectAltName?.value) {
    try {
      return extractIcpBrasilCnpj(forge.asn1.fromDer(subjectAltName.value));
    } catch {
      return null;
    }
  }
  return null;
}

function maskCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14) return "CNPJ inválido";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function inspectPkcs12(file, password) {
  try {
    const binary = forge.util.createBuffer(file.toString("binary"));
    const asn1 = forge.asn1.fromDer(binary);
    const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    const certificateBags = pkcs12.getBags({
      bagType: forge.pki.oids.certBag,
    })[forge.pki.oids.certBag] || [];
    const keyBags = [
      ...(pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ] || []),
      ...(pkcs12.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ] || []),
    ];
    const certificate = certificateBags.find((bag) => bag.cert)?.cert;
    if (!certificate || !keyBags.some((bag) => bag.key)) {
      throw new Error("Certificado ou chave privada ausente.");
    }
    return {
      serialNumber: certificate.serialNumber.toUpperCase(),
      subject: formatDistinguishedName(certificate.subject.attributes),
      issuer: formatDistinguishedName(certificate.issuer.attributes),
      validFrom: certificate.validity.notBefore,
      validUntil: certificate.validity.notAfter,
      holderCnpj: extractHolderCnpjFromCertificate(certificate),
    };
  } catch (error) {
    if (/password|mac could not be verified/i.test(String(error?.message || ""))) {
      throw new AppError(
        "Senha do certificado inválida.",
        "CERTIFICATE_INVALID_PASSWORD",
        422,
      );
    }
    throw new AppError(
      "O arquivo do certificado digital é inválido.",
      "CERTIFICATE_INVALID",
      422,
    );
  }
}

export async function storeValidatedCertificate({ company, file, password }) {
  const metadata = inspectPkcs12(file, password);
  const companyCnpj = normalizeCnpj(company.cnpj);
  const certificateCnpj = normalizeCnpj(metadata.holderCnpj);
  if (!certificateCnpj) {
    throw new AppError(
      "Não foi possível identificar o CNPJ do titular no certificado. Verifique se o arquivo é um e-CNPJ A1 válido.",
      "CERTIFICATE_CNPJ_NOT_FOUND",
      422,
    );
  }
  if (certificateCnpj !== companyCnpj) {
    throw new AppError(
      "O CNPJ do certificado não corresponde ao CNPJ da empresa.",
      "CERTIFICATE_CNPJ_MISMATCH",
      422,
      {
        companyCnpjMasked: maskCnpj(companyCnpj),
        certificateCnpjMasked: maskCnpj(certificateCnpj),
      },
    );
  }
  if (metadata.validUntil.getTime() < Date.now()) {
    throw new AppError("O certificado está vencido.", "CERTIFICATE_EXPIRED", 422);
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.digitalCertificate.updateMany({
      where: { companyId: company.id, status: "active" },
      data: { status: "replaced" },
    });
    return transaction.digitalCertificate.create({
      data: {
        companyId: company.id,
        ...metadata,
        validatedAt: new Date(),
        encryptedFile: encryptBuffer(file),
        encryptedPassword: encryptText(password),
        status: "active",
      },
      select: certificatePublicSelect,
    });
  });
}

export async function loadCertificateSecret(companyId) {
  const certificate = await prisma.digitalCertificate.findFirst({
    where: { companyId, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (!certificate) {
    throw new AppError("Certificado A1 não cadastrado.", "NO_CERTIFICATE", 409);
  }
  return {
    certificate: serializeCertificate(certificate),
    pfx: decryptBuffer(certificate.encryptedFile),
    passphrase: decryptText(certificate.encryptedPassword),
  };
}

export async function loadCertificateSigningMaterial(companyId) {
  const secret = await loadCertificateSecret(companyId);
  try {
    const binary = forge.util.createBuffer(secret.pfx.toString("binary"));
    const asn1 = forge.asn1.fromDer(binary);
    const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, secret.passphrase);
    const certificateBag = (pkcs12.getBags({
      bagType: forge.pki.oids.certBag,
    })[forge.pki.oids.certBag] || []).find((bag) => bag.cert);
    const keyBag = [
      ...(pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ] || []),
      ...(pkcs12.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ] || []),
    ].find((bag) => bag.key);
    if (!certificateBag?.cert || !keyBag?.key) throw new Error("missing material");
    return {
      ...secret,
      certificatePem: forge.pki.certificateToPem(certificateBag.cert),
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    };
  } catch {
    throw new AppError(
      "Não foi possível carregar o material de assinatura do A1.",
      "CERTIFICATE_INVALID",
      409,
    );
  }
}
