import assert from "node:assert/strict";
import test from "node:test";
import { serviceSchema } from "../../src/modules/services/services.schemas.js";
import { protectCatalogWrites } from "../../src/middlewares/catalog-write.middleware.js";

const validService = {
  code: "CONS-01", description: "Consultoria fiscal", municipalCode: "0101",
  nationalCode: "01.01", municipality: "São Paulo", municipalityIbgeCode: "3550308",
  issRate: 5, issWithheld: true, defaultValue: 500,
};

test("serviço válido aceita ISS e retenções para NFS-e", () => {
  const parsed = serviceSchema.parse({ ...validService, inssRate: 11, irRate: 1.5, csllRate: 1, pisRate: 0.65, cofinsRate: 3 });
  assert.equal(parsed.issRate, 5);
  assert.equal(parsed.issWithheld, true);
  assert.equal(parsed.inssRate, 11);
});

test("serviço rejeita código IBGE e alíquota inválidos", () => {
  assert.equal(serviceSchema.safeParse({ ...validService, municipalityIbgeCode: "123" }).success, false);
  assert.equal(serviceSchema.safeParse({ ...validService, issRate: 101 }).success, false);
});

test("VIEWER consulta mas não altera cadastros", () => {
  const middleware = protectCatalogWrites("SERVICE_CATALOG");
  let error;
  middleware({ method: "POST", user: { role: "VIEWER" } }, {}, (value) => { error = value; });
  assert.equal(error?.code, "FORBIDDEN");
  let allowed = false;
  middleware({ method: "GET", user: { role: "VIEWER" } }, {}, () => { allowed = true; });
  assert.equal(allowed, true);
});
