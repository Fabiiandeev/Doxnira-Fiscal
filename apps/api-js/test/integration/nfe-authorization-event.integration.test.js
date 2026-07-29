import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../../src/config/prisma.js";
import {
  processNfeAuthorizedEvent,
  recordNfeAuthorizedEvent,
} from "../../src/modules/nfe/nfe-authorization-event.service.js";

test("evento NF-e autorizada é persistido e processado com idempotência", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const user = await prisma.user.create({
    data: {
      name: "NF-e Event Test",
      email: `nfe-event-${suffix}@example.test`,
      passwordHash: "test",
    },
  });
  let company;
  let note;
  try {
    company = await prisma.company.create({
      data: {
        ownerId: user.id,
        legalName: "NF-e Event Company",
        cnpj: `99${suffix.replace(/\D/g, "").padEnd(12, "9")}`.slice(0, 14),
        stateRegistration: "123",
        city: "Goiânia",
        uf: "GO",
        environment: "homologation",
      },
      include: { establishments: true },
    });
    const establishment = await prisma.fiscalEstablishment.findFirstOrThrow({
      where: { companyId: company.id, isHeadquarters: true },
    });
    const accessKey = "52260712345678000195550010000000011234567890";
    const protocol = `15226${suffix}`.slice(0, 20);
    note = await prisma.nfeDocument.create({
      data: {
        companyId: company.id,
        establishmentId: establishment.id,
        userId: user.id,
        status: "AUTORIZADA",
        numero: 1,
        serie: 1,
        modelo: "55",
        ambiente: "2",
        chaveAcesso: accessKey,
        protocolo: protocol,
        cStat: "100",
        xmlProtocolo: "<nfeProc><cMun>5208707</cMun></nfeProc>",
        authorization: {
          create: {
            companyId: company.id,
            cStat: "100",
            xMotivo: "Autorizado o uso da NF-e",
            protocolo: protocol,
            ambiente: "2",
            dataAutorizacao: new Date(),
            xmlProtocolo: "<nfeProc><cMun>5208707</cMun></nfeProc>",
          },
        },
      },
    });
    const event = await prisma.$transaction((tx) => recordNfeAuthorizedEvent(tx, {
      companyId: company.id,
      establishmentId: establishment.id,
      nfeDocumentId: note.id,
      accessKey,
      protocol,
      environment: "2",
      authorizedAt: new Date(),
      source: "TEST",
    }));
    const first = await processNfeAuthorizedEvent(event.id);
    const second = await processNfeAuthorizedEvent(event.id);
    assert.equal(first.event.status, "PROCESSED");
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.equal(second.event.attemptCount, 1);
    const eligibility = await prisma.mdfeNfeEligibility.findUnique({
      where: { nfeDocumentId: note.id },
    });
    assert.equal(eligibility.establishmentId, establishment.id);
    assert.equal(eligibility.status, "INELIGIBLE");
    assert.equal(eligibility.reasonCode, "RECIPIENT_REQUIRED");
  } finally {
    if (note) await prisma.nfeDocument.delete({ where: { id: note.id } }).catch(() => {});
    if (company) await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});
