import forge from "node-forge";

import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
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

function extractCnpj(attributes, extensions = []) {
  const values = attributes.map((attribute) => String(attribute.value));
  for (const extension of extensions) {
    if (extension.value) {
      values.push(Buffer.from(extension.value, "binary").toString("latin1"));
    }
  }
  for (const value of values) {
    const matches = value.match(/\d{14}/g);
    if (matches?.length) return matches.at(-1);
  }
  return null;
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
      holderCnpj: extractCnpj(certificate.subject.attributes, certificate.extensions),
    };
  } catch {
    throw new AppError(
      "Arquivo A1 ou senha inválidos.",
      "CERTIFICATE_INVALID",
      422,
    );
  }
}

export async function storeValidatedCertificate({ company, file, password }) {
  const metadata = inspectPkcs12(file, password);
  if (!metadata.holderCnpj || metadata.holderCnpj !== company.cnpj) {
    throw new AppError(
      "O CNPJ do certificado não corresponde ao CNPJ da empresa.",
      "CERTIFICATE_CNPJ_MISMATCH",
      422,
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
