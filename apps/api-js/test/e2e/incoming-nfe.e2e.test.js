import { createServer } from "node:http";
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import bcrypt from "bcryptjs";

import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";

const companyCnpj = "12345678000195";
const supplierCnpj = "11222333000144";
const accessKey = "35260711222333000144550010000001231234567890";
let server;
let baseUrl;
let company;
let token;

async function cleanupTestDatabase() {
  const [database] = await prisma.$queryRawUnsafe("SELECT current_database() AS database");
  if (!/(test|testing|ci)/i.test(database.database)) {
    throw new Error(`Recusada limpeza fora de banco isolado de teste: ${database.database}`);
  }
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
}

function xmlFixture() {
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00"><NFe><infNFe Id="NFe${accessKey}" versao="4.00"><ide><cUF>35</cUF><cNF>12345678</cNF><natOp>COMPRA PARA COMERCIALIZACAO</natOp><mod>55</mod><serie>1</serie><nNF>123</nNF><dhEmi>2026-07-11T10:00:00-03:00</dhEmi><tpNF>1</tpNF></ide><emit><CNPJ>${supplierCnpj}</CNPJ><xNome>FORNECEDOR TESTE LTDA</xNome><enderEmit><UF>SP</UF></enderEmit></emit><dest><CNPJ>${companyCnpj}</CNPJ><xNome>EMPRESA TESTE LTDA</xNome></dest><det nItem="1"><prod><cProd>SUP-001</cProd><cEAN>7891234567895</cEAN><xProd>PRODUTO TESTE ENTRADA</xProd><NCM>84713012</NCM><CFOP>1102</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>100.0000</vUnCom><vProd>200.00</vProd></prod><imposto><ICMS><ICMS00><CST>00</CST><vBC>200.00</vBC><vICMS>36.00</vICMS></ICMS00></ICMS></imposto></det><total><ICMSTot><vBC>200.00</vBC><vICMS>36.00</vICMS><vProd>200.00</vProd><vFrete>20.00</vFrete><vDesc>10.00</vDesc><vIPI>0.00</vIPI><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vNF>210.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${accessKey}</chNFe><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><nProt>135260000000001</nProt></infProt></protNFe></nfeProc>`;
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

before(async () => {
  if (!process.env.DATABASE_URL_TEST?.includes("ns_fiscal_cloud_test")) throw new Error("DATABASE_URL_TEST isolada é obrigatória.");
  try {
    await cleanupTestDatabase();
  } catch (error) {
    throw new Error(`Falha na limpeza inicial do banco E2E: ${error.message}`, { cause: error });
  }
  const passwordHash = await bcrypt.hash("TestPassword#2026", 10);
  const user = await prisma.user.create({ data: { name: "Usuário E2E", email: "e2e@nfe.test", passwordHash } });
  company = await prisma.company.create({ data: { ownerId: user.id, legalName: "EMPRESA TESTE LTDA", cnpj: companyCnpj, uf: "SP", city: "São Paulo", environment: "homologation" } });
  await prisma.fornecedor.create({ data: { companyId: company.id, tipoPessoa: "PJ", razaoSocial: "FORNECEDOR TESTE LTDA", cnpj: supplierCnpj } });
  await prisma.product.create({ data: { companyId: company.id, name: "PRODUTO TESTE ENTRADA", code: "SUP-001", barcode: "7891234567895", unit: "UN", ncm: "84713012", price: 100, costPrice: 0 } });
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "e2e@nfe.test", password: "TestPassword#2026" }) });
  assert.equal(login.response.status, 200);
  token = login.body.token;
});

after(async () => {
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await cleanupTestDatabase();
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
});

test("fluxo HTTP E2E da NF-e de entrada persiste XML, estoque, financeiro e auditoria", async () => {
  const unauthorized = await request(`/api/companies/${company.id}/nfe-entry`);
  assert.equal(unauthorized.response.status, 401);

  const form = new FormData();
  form.set("xml", new Blob([xmlFixture()], { type: "application/xml" }), "incoming-nfe-valid.xml");
  const imported = await request(`/api/companies/${company.id}/nfe-entry/import-xml`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  assert.equal(imported.response.status, 201);
  const entryId = imported.body.data.id;
  assert.equal(imported.body.data.supplierId !== null, true);
  assert.equal(imported.body.data.items.length, 1);

  const duplicateForm = new FormData();
  duplicateForm.set("xml", new Blob([xmlFixture()], { type: "application/xml" }), "incoming-nfe-duplicate.xml");
  const duplicate = await request(`/api/companies/${company.id}/nfe-entry/import-xml`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: duplicateForm });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.code, "NFE_ENTRY_DUPLICATE");

  const validated = await request(`/api/companies/${company.id}/nfe-entry/${entryId}/validate`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(validated.response.status, 200);
  const prepared = await request(`/api/companies/${company.id}/nfe-entry/${entryId}/prepare-inventory`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(prepared.response.status, 200);
  assert.equal(prepared.body.inventory.canPost, true);
  assert.equal((await prisma.product.findFirst({ where: { companyId: company.id, code: "SUP-001" } })).stock, 0);

  const posted = await request(`/api/companies/${company.id}/nfe-entry/${entryId}/post-inventory`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(posted.response.status, 200);
  const replay = await request(`/api/companies/${company.id}/nfe-entry/${entryId}/post-inventory`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(replay.response.status, 409);
  assert.equal(replay.body.code, "NFE_ENTRY_ALREADY_CONFIRMED");

  const financial = await request(`/api/companies/${company.id}/nfe-entry/${entryId}/generate-payables`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(financial.response.status, 200);
  const bookkeeping = await request(`/api/companies/${company.id}/nfe-entry/${entryId}/prepare-bookkeeping`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(bookkeeping.response.status, 200);

  const detail = await request(`/api/companies/${company.id}/nfe-entry/${entryId}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.data.stockMovements.length, 1);
  assert.equal(detail.body.data.payables.length, 1);
  assert.equal(detail.body.data.events.some((event) => event.eventType === "BOOKKEEPING_PREPARED"), true);
});
