import { extname } from "node:path";

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
  upload.single("certificate"),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new AppError("Selecione um certificado A1.", "CERTIFICATE_FILE_REQUIRED", 422);
    }
    const extension = extname(request.file.originalname).toLowerCase();
    if (![".pfx", ".p12"].includes(extension)) {
      throw new AppError("Use um arquivo PFX ou P12.", "INVALID_CERTIFICATE_TYPE", 422);
    }
    if (!request.body.password || String(request.body.password).length < 3) {
      throw new AppError("Informe a senha do certificado.", "CERTIFICATE_PASSWORD_REQUIRED", 422);
    }
    const certificate = await storeValidatedCertificate({
      company: request.company,
      file: request.file.buffer,
      password: request.body.password,
    });
    await writeAudit({
      request,
      action: "certificate.uploaded",
      companyId: request.company.id,
      entityType: "DigitalCertificate",
      entityId: certificate.id,
      metadata: { issuer: certificate.issuer, validUntil: certificate.validUntil },
    });
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
