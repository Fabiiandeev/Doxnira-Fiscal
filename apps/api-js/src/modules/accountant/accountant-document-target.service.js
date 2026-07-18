import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

/**
 * Resolve o alvo (NF-e ou CT-e) enviado pelo cliente.
 * Garante: exatamente um alvo, o documento existe, pertence à empresa, e o escritório possui vínculo ativo.
 * Retorna um objeto normalizado usado pelos services e rotas dos quatro recursos.
 *
 * @param {{
 *   companyId: string,
 *   officeId: string,
 *   fiscalDocumentId?: string | null,
 *   transportDocumentId?: string | null,
 * }} input
 * @returns {Promise<{
 *   kind: "FISCAL" | "TRANSPORT",
 *   documentId: string,
 *   where: { fiscalDocumentId: string } | { transportDocumentId: string },
 *   uniqueKey: { officeId_fiscalDocumentId?: { officeId: string; fiscalDocumentId: string } } |
 *              { officeId_transportDocumentId?: { officeId: string; transportDocumentId: string } },
 *   targetDocument: object,
 * }>}
 */
export async function resolveAccountantDocumentTarget({ companyId, officeId, fiscalDocumentId, transportDocumentId }) {
  if (!companyId) throw new AppError("Empresa é obrigatória.", "ACCOUNTANT_COMPANY_REQUIRED", 422);
  if (!officeId) throw new AppError("Escritório contábil é obrigatório.", "ACCOUNTANT_OFFICE_REQUIRED", 422);

  const hasNfe = Boolean(fiscalDocumentId);
  const hasCte = Boolean(transportDocumentId);

  if (hasNfe && hasCte) {
    throw new AppError("Apenas um alvo (NF-e ou CT-e) deve ser informado.", "ACCOUNTANT_MULTIPLE_TARGETS", 422);
  }
  if (!hasNfe && !hasCte) {
    throw new AppError("Alvo do documento (NF-e ou CT-e) é obrigatório.", "ACCOUNTANT_TARGET_REQUIRED", 422);
  }

  // Valida vínculo ativo do escritório com a empresa. Mesmo que a middleware já valide,
  // refazemos aqui porque o serviço pode ser chamado diretamente por jobs ou testes.
  const link = await prisma.accountantCompanyLink.findFirst({
    where: {
      officeId,
      companyId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!link) {
    throw new AppError("Escritório não possui vínculo ativo com esta empresa.", "ACCOUNTANT_LINK_INACTIVE", 403);
  }

  if (hasNfe) {
    const document = await prisma.fiscalDocument.findFirst({
      where: { id: fiscalDocumentId, companyId },
      select: { id: true, companyId: true, accessKey: true, isSummary: true, rawXml: true, status: true },
    });
    if (!document) {
      // 404 sem revelar a existência em outra empresa
      throw new AppError("Documento não disponível neste contexto.", "ACCOUNTANT_TARGET_NOT_FOUND", 404);
    }
    return {
      kind: "FISCAL",
      documentId: document.id,
      where: { fiscalDocumentId: document.id },
      uniqueKey: { officeId_fiscalDocumentId: { officeId, fiscalDocumentId: document.id } },
      targetDocument: document,
    };
  }

  const document = await prisma.transportDocument.findFirst({
    where: { id: transportDocumentId, companyId },
    select: { id: true, companyId: true, accessKey: true, rawXml: true, status: true, number: true, series: true },
  });
  if (!document) {
    throw new AppError("Documento não disponível neste contexto.", "ACCOUNTANT_TARGET_NOT_FOUND", 404);
  }
  return {
    kind: "TRANSPORT",
    documentId: document.id,
    where: { transportDocumentId: document.id },
    uniqueKey: { officeId_transportDocumentId: { officeId, transportDocumentId: document.id } },
    targetDocument: document,
  };
}

/**
 * Resolve o alvo a partir de parâmetros de URL, preservando compatibilidade com a API atual
 * que roteia por /fiscal-documents/:documentId e novos endpoints /transport-documents/:documentId.
 */
export function resolveTargetFromRequestParams(request, { documentIdParamName = "documentId", kind }) {
  if (kind === "FISCAL") {
    return { fiscalDocumentId: request.params[documentIdParamName], transportDocumentId: null };
  }
  if (kind === "TRANSPORT") {
    return { fiscalDocumentId: null, transportDocumentId: request.params[documentIdParamName] };
  }
  throw new AppError("Tipo de documento não suportado.", "ACCOUNTANT_UNSUPPORTED_KIND", 422);
}

export function auditEntityFromTarget(target) {
  return target.kind === "FISCAL" ? { entityType: "FiscalDocument", entityId: target.documentId } : { entityType: "TransportDocument", entityId: target.documentId };
}
