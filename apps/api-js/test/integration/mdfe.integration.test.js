import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import {
  createMdfe,
  deleteMdfeDraft,
  duplicateMdfe,
  generateDamdfe,
  getMdfe,
  listMdfe,
  updateMdfe,
  validateMdfeDraft,
} from "../../src/modules/mdfe/mdfe.service.js";

after(disconnectDatabase);

const request = { id: "mdfe-integration", ip: "127.0.0.1", get: () => "node:test" };

test("MDF-e persiste agregados, isola empresas, duplica e valida sem efeito fiscal", async () => {
  const marker = randomUUID();
  const numeric = `${Date.now()}${Math.floor(Math.random() * 10_000_000)}`.padEnd(28, "7");
  const owner = await prisma.user.create({
    data: { name: "MDF-e Owner", email: `mdfe-${marker}@test.invalid`, passwordHash: "test" },
  });
  const otherOwner = await prisma.user.create({
    data: { name: "Other MDF-e", email: `mdfe-other-${marker}@test.invalid`, passwordHash: "test" },
  });
  const company = await prisma.company.create({
    data: {
      ownerId: owner.id,
      legalName: "Transportadora MDF-e Teste",
      cnpj: numeric.slice(0, 14),
      environment: "homologation",
      uf: "SP",
      city: "São Paulo",
    },
  });
  const otherCompany = await prisma.company.create({
    data: {
      ownerId: otherOwner.id,
      legalName: "Empresa Isolada MDF-e",
      cnpj: numeric.slice(14, 28),
      environment: "homologation",
    },
  });

  try {
    const created = await createMdfe({
      companyId: company.id,
      userId: owner.id,
      payload: {
        series: "1",
        issuerType: "TRANSPORTADOR_CARGA_PROPRIA",
        carrierType: "PROPRIO",
        modal: "RODOVIARIO",
        emissionType: "NORMAL",
        currentStep: 1,
      },
      request,
    });
    assert.equal(created.status, "DRAFT");
    assert.equal(created.environment, "homologation");

    const updated = await updateMdfe({
      companyId: company.id,
      mdfeId: created.id,
      userId: owner.id,
      request,
      payload: {
        loadingState: "SP",
        unloadingState: "RJ",
        loadingMunicipalities: [
          { stateCode: "SP", cityCode: "3550308", cityName: "São Paulo" },
        ],
        unloadingCities: [
          { stateCode: "RJ", cityCode: "3304557", cityName: "Rio de Janeiro" },
        ],
        routeStates: ["SP", "RJ"],
        vehicle: { plate: "ABC1D23", plateState: "SP", rntrc: "12345678" },
        drivers: [{ cpf: "52998224725", name: "Condutor Teste", isPrimary: true }],
        currentStep: 8,
      },
    });
    assert.equal(updated.loadingMunicipalities.length, 1);
    assert.equal(updated.routeStates.length, 2);
    assert.equal(updated.vehicle.plate, "ABC1D23");
    assert.equal(updated.drivers[0].cpf, "52998224725");

    await assert.rejects(
      getMdfe(otherCompany.id, created.id),
      (error) => error.code === "MDFE_NOT_FOUND",
    );
    const foreignList = await listMdfe(otherCompany.id, { page: 1, pageSize: 20 });
    assert.equal(foreignList.data.length, 0);

    const validation = await validateMdfeDraft({
      companyId: company.id,
      mdfeId: created.id,
      userId: owner.id,
      request,
    });
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((issue) => issue.code === "MDFE_CERTIFICATE_INVALID"));

    const duplicate = await duplicateMdfe({
      companyId: company.id,
      mdfeId: created.id,
      userId: owner.id,
      request,
    });
    assert.equal(duplicate.status, "DRAFT");
    assert.notEqual(duplicate.id, created.id);
    assert.notEqual(duplicate.number, created.number);
    assert.equal(duplicate.vehicle.plate, "ABC1D23");

    await deleteMdfeDraft({
      companyId: company.id,
      mdfeId: duplicate.id,
      userId: owner.id,
      request,
    });
    await assert.rejects(
      getMdfe(company.id, duplicate.id),
      (error) => error.code === "MDFE_NOT_FOUND",
    );

    await prisma.mdfeDraft.update({
      where: { id: created.id },
      data: {
        status: "AUTHORIZED",
        accessKey: "35260713219857000149580010000000011000000017",
        protocol: "135260000000001",
      },
    });
    const damdfe = await generateDamdfe(company.id, created.id);
    assert.equal(damdfe.contentType, "application/pdf");
    assert.equal(damdfe.preview, false);
    assert.equal(damdfe.buffer.subarray(0, 8).toString(), "%PDF-1.4");
    assert.ok(damdfe.buffer.length > 10_000);
  } finally {
    await prisma.mdfeDraft.deleteMany({ where: { companyId: { in: [company.id, otherCompany.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, otherCompany.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherOwner.id] } } });
  }
});
