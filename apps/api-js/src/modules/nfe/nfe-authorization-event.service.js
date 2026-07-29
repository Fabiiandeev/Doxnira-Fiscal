import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { evaluateNfeEligibility } from "../mdfe/mdfe-auto.service.js";

function eventIdentifier({ accessKey, protocol }) {
  return `NFE_AUTHORIZED:${accessKey}:${protocol}`;
}

export async function recordNfeAuthorizedEvent(tx, {
  companyId,
  establishmentId = null,
  nfeDocumentId,
  accessKey,
  protocol,
  environment,
  authorizedAt,
  xmlArtifactId = null,
  source = "SEFAZ",
}) {
  if (!accessKey || !protocol) {
    throw new AppError(
      "Chave e protocolo são obrigatórios para registrar a autorização.",
      "NFE_AUTHORIZED_EVENT_INVALID",
      500,
    );
  }
  const eventId = eventIdentifier({ accessKey, protocol });
  return tx.nfeAuthorizedEvent.upsert({
    where: { eventId },
    create: {
      eventId,
      companyId,
      establishmentId,
      nfeDocumentId,
      accessKey,
      protocol,
      environment,
      authorizedAt,
      xmlArtifactId,
      source,
    },
    update: {
      establishmentId,
      xmlArtifactId,
      authorizedAt,
      source,
    },
  });
}

export async function processNfeAuthorizedEvent(eventId) {
  const event = await prisma.nfeAuthorizedEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Evento de autorização não encontrado.", "NFE_AUTHORIZED_EVENT_NOT_FOUND", 404);
  if (event.status === "PROCESSED") {
    return { event, idempotent: true };
  }
  const claimed = await prisma.nfeAuthorizedEvent.updateMany({
    where: {
      id: event.id,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });
  if (!claimed.count) {
    return {
      event: await prisma.nfeAuthorizedEvent.findUnique({ where: { id: event.id } }),
      idempotent: true,
    };
  }
  try {
    const eligibility = await evaluateNfeEligibility({
      companyId: event.companyId,
      nfeDocumentId: event.nfeDocumentId,
    });
    const processed = await prisma.nfeAuthorizedEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
    });
    return { event: processed, eligibility, idempotent: false };
  } catch (error) {
    await prisma.nfeAuthorizedEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lastError: String(error?.message || error).slice(0, 5_000),
      },
    });
    throw error;
  }
}

export function scheduleNfeAuthorizedEvent(eventId) {
  const task = setImmediate(() => {
    void processNfeAuthorizedEvent(eventId).catch((error) => {
      console.error({
        code: error.code || "NFE_AUTHORIZED_EVENT_PROCESSING_FAILED",
        eventId,
      }, "NF-e authorized event processing failed");
    });
  });
  task.unref?.();
}

export async function reprocessNfeAuthorizedEvents({
  companyId,
  nfeDocumentId,
  establishmentId,
  status,
  authorizedFrom,
  authorizedTo,
  limit = 100,
}) {
  const where = {
    companyId,
    ...(nfeDocumentId ? { id: nfeDocumentId } : {}),
    ...(establishmentId ? { establishmentId } : {}),
    status: "AUTORIZADA",
    cStat: "100",
    deletedAt: null,
    authorization: {
      is: {
        ...(authorizedFrom || authorizedTo ? {
          dataAutorizacao: {
            ...(authorizedFrom ? { gte: authorizedFrom } : {}),
            ...(authorizedTo ? { lte: authorizedTo } : {}),
          },
        } : {}),
      },
    },
  };
  const notes = await prisma.nfeDocument.findMany({
    where,
    include: {
      authorization: true,
      files: { where: { tipo: "XML_AUTORIZADO" }, orderBy: { createdAt: "desc" }, take: 1 },
      authorizedEvents: true,
    },
    orderBy: { updatedAt: "asc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  const events = [];
  for (const note of notes) {
    let event = note.authorizedEvents.find((item) => item.protocol === note.authorization?.protocolo);
    if (!event) {
      event = await prisma.$transaction((tx) => recordNfeAuthorizedEvent(tx, {
        companyId,
        establishmentId: note.establishmentId,
        nfeDocumentId: note.id,
        accessKey: note.chaveAcesso,
        protocol: note.authorization.protocolo,
        environment: note.ambiente,
        authorizedAt: note.authorization.dataAutorizacao,
        xmlArtifactId: note.files[0]?.id || null,
        source: "BACKFILL",
      }));
    }
    if (!status || event.status === status) events.push(event);
  }

  const results = [];
  for (const event of events) {
    results.push(await processNfeAuthorizedEvent(event.id));
  }
  return {
    scanned: notes.length,
    processed: results.length,
    idempotent: results.filter((item) => item.idempotent).length,
    events: results.map((item) => ({
      id: item.event.id,
      nfeDocumentId: item.event.nfeDocumentId,
      status: item.event.status,
      idempotent: item.idempotent,
    })),
  };
}
