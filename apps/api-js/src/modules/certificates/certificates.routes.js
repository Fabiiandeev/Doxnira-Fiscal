import { basename, extname } from "node:path";

import { Router } from "express";
import multer from "multer";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  getCurrentCertificate,
  serializeCertificate,
  storeValidatedCertificate,
} from "../../services/certificate-vault.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024, files: 1 },
});

function handleCertificateUpload(request, response, next) {
  upload.single("certificate")(request, response, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `O certificado excede o limite de ${env.UPLOAD_MAX_SIZE_MB} MB.`
          : "Não foi possível processar o arquivo enviado.";
      return next(new AppError(message, "VALIDATION_ERROR", 422));
    }
    return next(error);
  });
}

function sanitizeFilename(filename) {
  return basename(filename, extname(filename))
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100) || "certificate";
}

export const certificatesRouter = Router({ mergeParams: true });

certificatesRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const certificate = await getCurrentCertificate(request.company.id);
    sendSuccess(response, { certificate: serializeCertificate(certificate) });
  }),
);

certificatesRouter.post(
  "/",
  handleCertificateUpload,
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new AppError(
        "Envie um certificado digital A1 .pfx ou .p12.",
        "CERTIFICATE_FILE_REQUIRED",
        422,
      );
    }
    const extension = extname(request.file.originalname).toLowerCase();
    if (![".pfx", ".p12"].includes(extension)) {
      throw new AppError(
        "Envie um certificado digital A1 .pfx ou .p12.",
        "INVALID_CERTIFICATE_TYPE",
        422,
      );
    }
    if (typeof request.body.password !== "string" || request.body.password.length === 0) {
      throw new AppError(
        "Informe a senha do certificado digital.",
        "CERTIFICATE_PASSWORD_REQUIRED",
        422,
      );
    }
    const filename = sanitizeFilename(request.file.originalname);
    let certificate;
    try {
      certificate = await storeValidatedCertificate({
        company: request.company,
        file: request.file.buffer,
        password: request.body.password,
      });
    } catch (error) {
      request.log.warn(
        {
          companyId: request.company.id,
          filename,
          status: "rejected",
          error:
            error instanceof AppError
              ? { code: error.code, message: error.message }
              : { code: "INTERNAL_ERROR", message: "Falha interna no upload." },
        },
        "Certificate upload rejected",
      );
      throw error;
    }
    await writeAudit({
      request,
      action: "certificate.uploaded",
      companyId: request.company.id,
      entityType: "DigitalCertificate",
      entityId: certificate.id,
      metadata: { issuer: certificate.issuer, validUntil: certificate.validUntil },
    });
    request.log.info(
      { companyId: request.company.id, filename, status: certificate.status },
      "Certificate upload completed",
    );
    sendSuccess(response, { certificate: serializeCertificate(certificate) }, 201);
  }),
);

certificatesRouter.delete(
  "/",
  asyncHandler(async (request, response) => {
    const certificate = await getCurrentCertificate(request.company.id);
    if (!certificate) {
      throw new AppError("Certificado não encontrado.", "CERTIFICATE_NOT_FOUND", 404);
    }
    await prisma.digitalCertificate.update({
      where: { id: certificate.id },
      data: { status: "deleted" },
    });
    await writeAudit({
      request,
      action: "certificate.deleted",
      companyId: request.company.id,
      entityType: "DigitalCertificate",
      entityId: certificate.id,
    });
    response.status(204).end();
  }),
);
