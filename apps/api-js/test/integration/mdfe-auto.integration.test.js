import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import {
  evaluateNfeEligibility,
  listEligibleNfes,
  prepareMdfesFromNfes,
  saveAndAuthorizeAutomaticMdfe,
} from "../../src/modules/mdfe/mdfe-auto.service.js";

after(disconnectDatabase);

const request = { id: "mdfe-auto-integration", ip: "127.0.0.1", get: () => "node:test" };

function digits(length) {
  return `${Date.now()}${Math.floor(Math.random() * 1_000_000_000)}`
    .replace(/\D/g, "")
    .padEnd(length, "7")
    .slice(0, length);
}

async function createAuthorizedNfe({ company, user, client, number, cityCode, amount }) {
  const accessKey = `${digits(35)}${String(number).padStart(9, "0")}`.slice(0, 44);
  const xmlProtocolo = [
    "<nfeProc><NFe><infNFe><emit><enderEmit>",
    "<cMun>5208707</cMun>",
    "</enderEmit></emit></infNFe></NFe></nfeProc>",
  ].join("");
  return prisma.nfeDocument.create({
    data: {
      companyId: company.id,
      userId: user.id,
      status: "AUTORIZADA",
      numero: number,
      serie: 1,
      modelo: "55",
      ambiente: "2",
      chaveAcesso: accessKey,
      protocolo: `13526${digits(10)}`,
      xmlProtocolo,
      cStat: "100",
      xMotivo: "Autorizado o uso da NF-e",
      destinatarioId: client.id,
      destinatarioNome: client.razaoSocial,
      destinatarioCnpj: client.cnpj,
      destinatarioUf: client.uf,
      dataEmissao: new Date(),
      authorization: {
        create: {
          companyId: company.id,
          cStat: "100",
          xMotivo: "Autorizado o uso da NF-e",
          protocolo: `13526${digits(10)}`,
          ambiente: "2",
          dataAutorizacao: new Date(),
          xmlProtocolo,
        },
      },
      totals: {
        create: {
          companyId: company.id,
          valorProdutos: amount,
          valorTotal: amount,
        },
      },
      transport: {
        create: {
          companyId: company.id,
          modalidadeFrete: "0",
          placaVeiculo: "ABC1D23",
          ufPlaca: "GO",
          rntc: "12345678",
          volumes: [{ pesoBruto: 15, pesoLiquido: 12, quantidade: 2 }],
        },
      },
      items: {
        create: [{
          companyId: company.id,
          itemNumber: 1,
          description: `Produto fiscal ${cityCode}`,
          ncm: "01012100",
          unidade: "UN",
          quantidade: 1,
          valorUnitario: amount,
          valorTotal: amount,
        }],
      },
    },
  });
}

test("MDF-e automático persiste elegibilidade, agrupamento, reserva, totais e idempotência", async () => {
  const marker = randomUUID();
  const owner = await prisma.user.create({
    data: { name: "MDF-e Auto Owner", email: `mdfe-auto-${marker}@test.invalid`, passwordHash: "test" },
  });
  const otherOwner = await prisma.user.create({
    data: { name: "MDF-e Auto Other", email: `mdfe-auto-other-${marker}@test.invalid`, passwordHash: "test" },
  });
  const company = await prisma.company.create({
    data: {
      ownerId: owner.id,
      legalName: "Emitente MDF-e Automático",
      cnpj: digits(14),
      environment: "homologation",
      uf: "GO",
      city: "Goiânia",
    },
  });
  const otherCompany = await prisma.company.create({
    data: {
      ownerId: otherOwner.id,
      legalName: "Empresa isolada MDF-e",
      cnpj: digits(14),
      environment: "homologation",
      uf: "MG",
      city: "Belo Horizonte",
    },
  });
  const firstClient = await prisma.client.create({
    data: {
      ownerId: owner.id,
      companyId: company.id,
      tipoPessoa: "PJ",
      razaoSocial: "Destinatário Campinas",
      cnpj: digits(14),
      logradouro: "Rua Um",
      bairro: "Centro",
      municipio: "Campinas",
      uf: "SP",
      codigoIbge: "3509502",
    },
  });
  const secondClient = await prisma.client.create({
    data: {
      ownerId: owner.id,
      companyId: company.id,
      tipoPessoa: "PJ",
      razaoSocial: "Destinatário São Paulo",
      cnpj: digits(14),
      logradouro: "Rua Dois",
      bairro: "Centro",
      municipio: "São Paulo",
      uf: "SP",
      codigoIbge: "3550308",
    },
  });

  try {
    const baseNumber = Number(digits(6));
    const first = await createAuthorizedNfe({
      company, user: owner, client: firstClient, number: baseNumber + 1, cityCode: "3509502", amount: 100,
    });
    const second = await createAuthorizedNfe({
      company, user: owner, client: secondClient, number: baseNumber + 2, cityCode: "3550308", amount: 200,
    });

    assert.equal((await evaluateNfeEligibility({
      companyId: company.id, nfeDocumentId: first.id,
    })).status, "ELIGIBLE");
    assert.equal((await evaluateNfeEligibility({
      companyId: company.id, nfeDocumentId: second.id,
    })).status, "ELIGIBLE");

    const queue = await listEligibleNfes(company.id, { page: 1, pageSize: 20 });
    assert.equal(queue.pagination.total, 2);
    assert.deepEqual(queue.summary.map((item) => item.state), ["SP"]);
    assert.equal(queue.summary[0].municipalityCount, 2);

    const idempotencyKey = randomUUID();
    const prepared = await prepareMdfesFromNfes({
      companyId: company.id,
      userId: owner.id,
      nfeIds: [first.id, second.id],
      idempotencyKey,
      request,
    });
    assert.equal(prepared.groupCount, 1);
    assert.ok(prepared.groups[0].blockingIssues.includes("DRIVER_REQUIRED"));
    assert.ok(prepared.groups[0].blockingIssues.includes("ROUTE_CONFIRMATION_REQUIRED"));

    const mdfe = await prisma.mdfeDraft.findUnique({
      where: { id: prepared.groups[0].mdfeId },
      include: {
        fiscalDocuments: true,
        unloadingCities: true,
        routeStates: true,
        nfeReservations: true,
      },
    });
    assert.equal(mdfe.fiscalDocuments.length, 2);
    assert.equal(mdfe.unloadingCities.length, 2);
    assert.deepEqual(mdfe.routeStates.map((item) => item.stateCode), ["MG"]);
    assert.equal(Number(mdfe.totalCargoCents), 30_000);
    assert.equal(Number(mdfe.totalWeightKg), 30);
    assert.equal(Number(mdfe.totalNetWeightKg), 24);
    assert.equal(Number(mdfe.totalPackageQuantity), 4);
    assert.equal(mdfe.nfeReservations.length, 2);
    assert.ok(mdfe.fiscalDocuments.every((link) => link.unloadingCityId));

    const retry = await prepareMdfesFromNfes({
      companyId: company.id,
      userId: owner.id,
      nfeIds: [second.id, first.id],
      idempotencyKey,
      request,
    });
    assert.equal(retry.groups[0].mdfeId, mdfe.id);
    assert.equal(retry.groups[0].idempotent, true);

    await assert.rejects(
      evaluateNfeEligibility({ companyId: otherCompany.id, nfeDocumentId: first.id }),
      (error) => error.code === "NFE_NOT_FOUND",
    );

    const concurrentNote = await createAuthorizedNfe({
      company,
      user: owner,
      client: firstClient,
      number: baseNumber + 3,
      cityCode: "3509502",
      amount: 50,
    });
    await evaluateNfeEligibility({ companyId: company.id, nfeDocumentId: concurrentNote.id });
    const concurrentResults = await Promise.allSettled([
      prepareMdfesFromNfes({
        companyId: company.id,
        userId: owner.id,
        nfeIds: [concurrentNote.id],
        idempotencyKey: randomUUID(),
        request,
      }),
      prepareMdfesFromNfes({
        companyId: company.id,
        userId: owner.id,
        nfeIds: [concurrentNote.id],
        idempotencyKey: randomUUID(),
        request,
      }),
    ]);
    assert.equal(concurrentResults.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await prisma.mdfeNfeReservation.count({
      where: { nfeDocumentId: concurrentNote.id, status: "LINKED_TO_DRAFT" },
    }), 1);

    await prisma.nfeTotal.update({
      where: { nfeDocumentId: second.id },
      data: { valorProdutos: 250, valorTotal: 250 },
    });
    const validationResult = await saveAndAuthorizeAutomaticMdfe({
      companyId: company.id,
      mdfeId: mdfe.id,
      userId: owner.id,
      idempotencyKey: randomUUID(),
      confirmRoute: true,
      confirmPredominantProduct: true,
      request,
    });
    assert.equal(validationResult.authorized, false);
    assert.equal(Number((await prisma.mdfeDraft.findUnique({
      where: { id: mdfe.id },
      select: { totalCargoCents: true },
    })).totalCargoCents), 35_000);
    assert.equal((await prisma.mdfeNfeEligibility.findUnique({
      where: { nfeDocumentId: first.id },
      select: { status: true },
    })).status, "ELIGIBLE");
    await prisma.mdfeDraft.update({ where: { id: mdfe.id }, data: { status: "READY_TO_AUTHORIZE" } });
    assert.equal((await prepareMdfesFromNfes({
      companyId: company.id,
      userId: owner.id,
      nfeIds: [first.id, second.id],
      idempotencyKey,
      request,
    })).groups[0].mdfeId, mdfe.id);

    await prisma.nfeDocument.update({ where: { id: first.id }, data: { status: "CANCELADA" } });
    await assert.rejects(
      saveAndAuthorizeAutomaticMdfe({
        companyId: company.id,
        mdfeId: mdfe.id,
        userId: owner.id,
        idempotencyKey: randomUUID(),
        confirmRoute: true,
        confirmPredominantProduct: true,
        request,
      }),
      (error) => error.code === "NFE_NOT_AUTHORIZED",
    );
  } finally {
    await prisma.mdfeDraft.deleteMany({ where: { companyId: company.id } });
    await prisma.nfeDocument.deleteMany({ where: { companyId: company.id } });
    await prisma.client.deleteMany({ where: { companyId: company.id } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, otherCompany.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherOwner.id] } } });
  }
});
