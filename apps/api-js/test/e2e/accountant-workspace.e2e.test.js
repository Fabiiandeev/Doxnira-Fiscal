import { createServer } from "node:http";
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import bcrypt from "bcryptjs";

import { app } from "../../src/app.js";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";

const OFFICE_CNPJ = "12345678000199";
const COMPANY_CNPJ = "12345678000195";

let server;
let baseUrl;
let company;
let user;
let office;
let membership;
let access;
let fiscalDoc;
let transportDoc;
let tag;
let token;

async function cleanupTestDatabase() {
  const [database] = await prisma.$queryRawUnsafe("SELECT current_database() AS database");
  if (!/(test|testing|ci)/i.test(database.database)) throw new Error(`Recusada limpeza fora de banco isolado: ${database.database}`);
  // Limpa tabelas de accountant e dependencias na ordem correta
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_document_requests" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_document_tag_links" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_document_tags" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_document_notes" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_document_reviews" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_user_company_access" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_company_links" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_memberships" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "accountant_offices" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "fiscal_document_links" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "transport_documents" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "fiscal_documents" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "companies" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
}

function serialized(body) {
  return typeof body.data !== "undefined" ? body.data : body;
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("connection", "close");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = response.headers.get("content-type")?.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text();
  return { response, body };
}

before(async () => {
  if (!process.env.DATABASE_URL_TEST?.includes("ns_fiscal_cloud_test")) throw new Error("DATABASE_URL_TEST isolada é obrigatória.");
  try { await cleanupTestDatabase(); } catch (error) { throw new Error(`Falha na limpeza inicial: ${error.message}`); }

  const passwordHash = await bcrypt.hash("TestPassword#2026", 10);
  user = await prisma.user.create({ data: { name: "Contador E2E", email: "contador@e2e.test", passwordHash } });

  company = await prisma.company.create({
    data: { ownerId: user.id, legalName: "EMPRESA TESTE LTDA", cnpj: COMPANY_CNPJ, uf: "SP", city: "São Paulo", environment: "homologation" },
  });

  office = await prisma.accountantOffice.create({ data: { name: "Escritório E2E", cnpj: OFFICE_CNPJ } });

  membership = await prisma.accountantMembership.create({
    data: { officeId: office.id, userId: user.id, role: "ADMIN", status: "ACTIVE" },
  });

  await prisma.accountantCompanyLink.create({
    data: { officeId: office.id, companyId: company.id, status: "ACTIVE" },
  });

  access = await prisma.accountantUserCompanyAccess.create({
    data: { membershipId: membership.id, companyId: company.id, accessLevel: "FULL", permissions: ["fiscal.documents.read", "fiscal.documents.review", "fiscal.documents.manage_notes", "fiscal.documents.manage_tags", "fiscal.documents.create_request", "fiscal.documents.download_xml", "fiscal.transport_documents.download_xml", "accountant.requests.read", "fiscal.documents.respond_request"] },
  });

  fiscalDoc = await prisma.fiscalDocument.create({
    data: {
      companyId: company.id, documentType: "NFE", operationDirection: "INBOUND", invoiceNumber: "123",
      issuerName: "FORNECEDOR TESTE", issuerCnpj: "11222333000144",
      recipientName: "EMPRESA TESTE LTDA", recipientCnpj: COMPANY_CNPJ,
      model: "55", series: "1", accessKey: "35260711222333000144550010000001231234567890",
      emissionDate: new Date("2026-07-11"), totalAmount: 1000,
      xmlStorageKey: "test/123", xmlHashSha256: "a".repeat(64),
      rawXml: "<nfeProc><NFe><infNFe Id='NFe35260711222333000144550010000001231234567890' versao='4.00'><ide><nNF>123</nNF></ide></infNFe></NFe></nfeProc>",
    },
  });

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  token = null;
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "contador@e2e.test", password: "TestPassword#2026" }) });
  assert.equal(login.response.status, 200);
  token = login.body.token;

  tag = await prisma.accountantDocumentTag.create({
    data: { officeId: office.id, name: "E2E Tag", normalizedName: "e2e tag", color: "#ff0000", createdByUserId: user.id },
  });

  transportDoc = await prisma.transportDocument.create({
    data: {
      companyId: company.id, accessKey: "35260711222333000144550020000001231234567890",
      number: "CTE001", series: "1", issuerName: "TRANSPORTADORA E2E", issuerCnpj: "99888777000122",
      recipientName: "EMPRESA TESTE LTDA", recipientCnpj: COMPANY_CNPJ,
      emissionDate: new Date("2026-07-12"), totalAmount: 500,
      xmlStorageKey: "cte/test/456", rawXmlHash: "b".repeat(64),
      rawXml: "<cteProc><CTe><infCte Id='CTe35260711222333000144550020000001231234567890'><ide><nCT>CTE001</nCT></ide></infCte></CTe></cteProc>",
    },
  });

});

after(async () => {
  try {
    await cleanupTestDatabase();
    if (server) {
      server.close();
      server.closeAllConnections?.();
    }
  } finally {
    await disconnectDatabase();
  }
});

const headers = { authorization: `Bearer ${token}`, "x-accountant-office-id": () => office.id };
const h = () => ({ authorization: `Bearer ${token}`, "x-accountant-office-id": office.id, "content-type": "application/json" });

test("accountant E2E: sumario NF-e retorna contagem real", async () => {
  const res = await request(`/api/accountant/companies/${company.id}/fiscal-documents/summary?${new URLSearchParams()}`, { headers: h() });
  assert.equal(res.response.status, 200);
  assert.equal(res.body.totalDocuments, 1);
});

test("accountant E2E: notas (CRUD) funcionam para NF-e", async () => {
  const createRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/notes`, { method: "POST", headers: h(), body: JSON.stringify({ content: "Observação E2E NF-e" }) });
  assert.equal(createRes.response.status, 201);
  const listRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/notes`, { headers: h() });
  assert.equal(listRes.response.status, 200);
  assert.ok(listRes.body.length >= 1);
  const noteId = listRes.body[0].id;
  const delRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/notes/${noteId}`, { method: "DELETE", headers: h() });
  assert.equal(delRes.response.status, 200);
});

test("accountant E2E: notas funcionam para CT-e", async () => {
  const createRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/notes`, { method: "POST", headers: h(), body: JSON.stringify({ content: "Observação E2E CT-e" }) });
  assert.equal(createRes.response.status, 201);
  const listRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/notes`, { headers: h() });
  assert.equal(listRes.response.status, 200);
  assert.ok(listRes.body.length >= 1);
});

test("accountant E2E: etiquetas - associar e remover em NF-e", async () => {
  const assignRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/tags/${tag.id}`, { method: "POST", headers: h() });
  assert.equal(assignRes.response.status, 201);
  const listRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/tags`, { headers: h() });
  assert.equal(listRes.response.status, 200);
  assert.ok(listRes.body.some((t) => t.id === tag.id));
  const removeRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/tags/${tag.id}`, { method: "DELETE", headers: h() });
  assert.equal(removeRes.response.status, 200);
});

test("accountant E2E: etiquetas funcionam para CT-e", async () => {
  const assignRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/tags/${tag.id}`, { method: "POST", headers: h() });
  assert.equal(assignRes.response.status, 201);
  const listRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/tags`, { headers: h() });
  assert.equal(listRes.response.status, 200);
  const removeRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/tags/${tag.id}`, { method: "DELETE", headers: h() });
  assert.equal(removeRes.response.status, 200);
});

test("accountant E2E: conferencia e reabertura", async () => {
  const reviewRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/review`, { method: "POST", headers: h(), body: JSON.stringify({ status: "REVIEWED", note: "Conferido E2E" }) });
  assert.equal(reviewRes.response.status, 201);
  assert.equal(reviewRes.body.status, "REVIEWED");
  const reopenRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/review`, { method: "PATCH", headers: h(), body: JSON.stringify({ status: "REOPENED", reopenReason: "Reaberto para correção E2E" }) });
  assert.equal(reopenRes.response.status, 200);
  assert.equal(reopenRes.body.status, "REOPENED");
});

test("accountant E2E: conferencia no CT-e", async () => {
  const reviewRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/review`, { method: "POST", headers: h(), body: JSON.stringify({ status: "REVIEWED", note: "CT-e conferido" }) });
  assert.equal(reviewRes.response.status, 201);
  assert.equal(reviewRes.body.status, "REVIEWED");
});

test("accountant E2E: historico de conferencia existe para NF-e", async () => {
  const historyRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/review-history`, { headers: h() });
  assert.equal(historyRes.response.status, 200);
  assert.ok(historyRes.body.length >= 1);
});

test("accountant E2E: historico de conferencia existe para CT-e", async () => {
  const historyRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/review-history`, { headers: h() });
  assert.equal(historyRes.response.status, 200);
});

test("accountant E2E: solicitações - criar e lifecycle", async () => {
  const createRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/requests`, { method: "POST", headers: h(), body: JSON.stringify({ type: "XML_MISSING", priority: "HIGH", description: "XML necessário" }) });
  assert.equal(createRes.response.status, 201);
  const reqId = createRes.body.id;
  let listRes = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/requests`, { headers: h() });
  assert.equal(listRes.response.status, 200);
  assert.ok(listRes.body.some((r) => r.id === reqId));
  // Transicao: assign/take
  const inProgressRes = await request(`/api/accountant/companies/${company.id}/requests/${reqId}`, { method: "PATCH", headers: h(), body: JSON.stringify({ status: "IN_PROGRESS" }) });
  assert.equal(inProgressRes.response.status, 200);
  assert.equal(inProgressRes.body.status, "IN_PROGRESS");
  // Responder
  const answeredRes = await request(`/api/accountant/companies/${company.id}/requests/${reqId}`, { method: "PATCH", headers: h(), body: JSON.stringify({ status: "ANSWERED", responseMessage: "XML enviado via sistema." }) });
  assert.equal(answeredRes.response.status, 200);
  assert.equal(answeredRes.body.status, "ANSWERED");
  // Resolver
  const resolvedRes = await request(`/api/accountant/companies/${company.id}/requests/${reqId}`, { method: "PATCH", headers: h(), body: JSON.stringify({ status: "RESOLVED", responseMessage: "Resolvido." }) });
  assert.equal(resolvedRes.response.status, 200);
  assert.equal(resolvedRes.body.status, "RESOLVED");
});

test("accountant E2E: empresa assume, responde e timeline registra lifecycle CT-e", async () => {
  const createRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/requests`, { method: "POST", headers: h(), body: JSON.stringify({ type: "COMPANY_CONFIRMATION", priority: "NORMAL", description: "Confirme o conhecimento do frete" }) });
  assert.equal(createRes.response.status, 201);
  const requestId = createRes.body.id;
  const companyHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const accept = await request(`/api/companies/${company.id}/document-requests/${requestId}/accept`, { method: "POST", headers: companyHeaders });
  assert.equal(accept.response.status, 200);
  assert.equal(accept.body.status, "IN_PROGRESS");
  const answer = await request(`/api/companies/${company.id}/document-requests/${requestId}/respond`, { method: "POST", headers: companyHeaders, body: JSON.stringify({ message: "Frete confirmado pela empresa." }) });
  assert.equal(answer.response.status, 200);
  assert.equal(answer.body.status, "ANSWERED");
  const resolve = await request(`/api/accountant/companies/${company.id}/requests/${requestId}`, { method: "PATCH", headers: h(), body: JSON.stringify({ status: "RESOLVED", responseMessage: "Conferência encerrada." }) });
  assert.equal(resolve.response.status, 200);
  const detail = await request(`/api/companies/${company.id}/document-requests/${requestId}`, { headers: companyHeaders });
  assert.equal(detail.response.status, 200);
  assert.deepEqual(detail.body.events.map((event) => event.eventType), ["REQUEST_CREATED", "REQUEST_ACCEPTED", "REQUEST_ANSWERED", "REQUEST_RESOLVED"]);
  assert.ok(detail.body.events.every((event) => event.actorRole && event.toStatus));
});

test("accountant E2E: cancelamento e reabertura exigem justificativa", async () => {
  const created = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/requests`, { method: "POST", headers: h(), body: JSON.stringify({ type: "REOPEN_TEST", priority: "NORMAL", description: "Teste de justificativa" }) });
  assert.equal(created.response.status, 201);
  const invalidCancel = await request(`/api/accountant/companies/${company.id}/requests/${created.body.id}`, { method: "PATCH", headers: h(), body: JSON.stringify({ status: "CANCELLED" }) });
  assert.equal(invalidCancel.response.status, 422);
  const cancelled = await request(`/api/accountant/companies/${company.id}/requests/${created.body.id}`, { method: "PATCH", headers: h(), body: JSON.stringify({ status: "CANCELLED", reason: "Documento substituído" }) });
  assert.equal(cancelled.response.status, 200);
});

test("accountant E2E: READ_ONLY e RESTRICTED respeitam grants de solicitações", async () => {
  const requestCreated = await request(`/api/accountant/companies/${company.id}/fiscal-documents/${fiscalDoc.id}/requests`, { method: "POST", headers: h(), body: JSON.stringify({ type: "AUTHORIZATION_TEST", priority: "NORMAL", description: "Teste de autorização" }) });
  assert.equal(requestCreated.response.status, 201);
  const passwordHash = await bcrypt.hash("TestPassword#2026", 10);
  const makeToken = async (email, accessLevel, permissions) => {
    const actor = await prisma.user.create({ data: { name: email, email, passwordHash } });
    const actorMembership = await prisma.accountantMembership.create({ data: { officeId: office.id, userId: actor.id, role: "OPERATOR", status: "ACTIVE" } });
    await prisma.accountantUserCompanyAccess.create({ data: { membershipId: actorMembership.id, companyId: company.id, accessLevel, permissions } });
    const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "TestPassword#2026" }) });
    return { authorization: `Bearer ${login.body.token}`, "x-accountant-office-id": office.id, "content-type": "application/json" };
  };
  const readOnly = await makeToken("readonly@e2e.test", "READ_ONLY", ["accountant.requests.read"]);
  const restrictedNone = await makeToken("restricted-none@e2e.test", "RESTRICTED", ["accountant.requests.read"]);
  const restrictedManage = await makeToken("restricted-manage@e2e.test", "RESTRICTED", ["fiscal.documents.respond_request"]);
  for (const headers of [readOnly, restrictedNone]) {
    const denied = await request(`/api/accountant/companies/${company.id}/requests/${requestCreated.body.id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "CANCELLED", reason: "Sem acesso" }) });
    assert.equal(denied.response.status, 403);
  }
  const allowed = await request(`/api/accountant/companies/${company.id}/requests/${requestCreated.body.id}`, { method: "PATCH", headers: restrictedManage, body: JSON.stringify({ status: "CANCELLED", reason: "Grant explícito" }) });
  assert.equal(allowed.response.status, 200);
});

test("accountant E2E: prevencao duplicidade de solicitacao ativa", async () => {
  // Criar solicitação do tipo único
  const createRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/requests`, { method: "POST", headers: h(), body: JSON.stringify({ type: "CFOP_INCORRECT", priority: "NORMAL", description: "CFOP errado" }) });
  assert.equal(createRes.response.status, 201);
  // Tentar criar novamente o mesmo tipo aberto -> deve rejeitar
  const dupRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/requests`, { method: "POST", headers: h(), body: JSON.stringify({ type: "CFOP_INCORRECT", priority: "NORMAL", description: "CFOP errado novamente" }) });
  assert.equal(dupRes.response.status, 409);
  assert.equal(dupRes.body.code, "ACCOUNTANT_REQUEST_DUPLICATE");
});

test("accountant E2E: XML de CT-e retorna XML real", async () => {
  const xmlRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/xml`, { headers: h() });
  assert.equal(xmlRes.response.status, 200);
  assert.ok(xmlRes.body.xml.includes("cteProc"), "XML deve conter tag cteProc");
  assert.equal(xmlRes.body.availability, "FULL");
});

test("accountant E2E: download XML CT-e autenticado", async () => {
  const downloadRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/download-xml`, { headers: h() });
  assert.equal(downloadRes.response.status, 200);
  assert.ok(typeof downloadRes.body === "string" || downloadRes.body instanceof ArrayBuffer);
});

test("accountant E2E: sumario CT-e retorna contagem real", async () => {
  const summaryRes = await request(`/api/accountant/companies/${company.id}/transport-documents/summary`, { headers: h() });
  assert.equal(summaryRes.response.status, 200);
  assert.equal(summaryRes.body.total, 1);
});

test("accountant E2E: busca CT-e por chave", async () => {
  const searchRes = await request(`/api/accountant/companies/${company.id}/transport-documents?query=${transportDoc.accessKey}`, { headers: h() });
  assert.equal(searchRes.response.status, 200);
  assert.ok(searchRes.body.data.length >= 1);
  assert.equal(serialized(searchRes.body.data[0]).id, transportDoc.id);
});

test("accountant E2E: busca CT-e por emitente", async () => {
  const searchRes = await request(`/api/accountant/companies/${company.id}/transport-documents?query=TRANSPORTADORA`, { headers: h() });
  assert.equal(searchRes.response.status, 200);
  assert.ok(searchRes.body.data.length >= 1);
});

test("accountant E2E: acesso cruzado entre empresas retorna 403/404", async () => {
  const otherCompany = await prisma.company.create({
    data: { ownerId: user.id, legalName: "OUTRA EMPRESA", cnpj: "99999999000199", uf: "RJ", city: "Rio", environment: "homologation" },
  });
  const res = await request(`/api/accountant/companies/${otherCompany.id}/fiscal-documents/${fiscalDoc.id}`, { headers: h() });
  assert.ok(res.response.status === 403 || res.response.status === 404);
  // Limpar
  await prisma.company.delete({ where: { id: otherCompany.id } });
});

test("accountant E2E: paginacao de CT-e funciona", async () => {
  const res = await request(`/api/accountant/companies/${company.id}/transport-documents?page=1&pageSize=10`, { headers: h() });
  assert.equal(res.response.status, 200);
  assert.ok(res.body.pagination);
  assert.equal(res.body.pagination.total >= 1, true);
});

test("accountant E2E: reprocessamento de vinculos CT-e", async () => {
  // Criar uma NF-e que corresponde a uma chave referenciada no CT-e
  await prisma.fiscalDocument.create({
    data: {
      companyId: company.id, documentType: "NFE", invoiceNumber: "999",
      issuerName: "FORNECEDOR", issuerCnpj: "11222333000144",
      recipientName: "EMPRESA TESTE LTDA", recipientCnpj: COMPANY_CNPJ,
      accessKey: "35260711222333000144550020000001234567891", // Ira gerar link pendente
      xmlStorageKey: "test/999", xmlHashSha256: "c".repeat(64),
      rawXml: "<?xml version='1.0'?><nfeProc><NFe><infNFe Id='NFe35260711222333000144550020000001234567891'></infNFe></NFe></nfeProc>",
    },
  });

  await prisma.transportDocument.update({
    where: { id: transportDoc.id },
    data: { rawXml: `<cteProc><CTe><infCte Id="CTe${transportDoc.accessKey}"><ide><nCT>CTE001</nCT></ide><infDoc><infNFe><chNFe>35260711222333000144550020000001234567891</chNFe></infNFe></infDoc></infCte></CTe></cteProc>` },
  });
  const reprocessRes = await request(`/api/accountant/companies/${company.id}/transport-documents/${transportDoc.id}/reprocess-links`, { method: "POST", headers: h() });
  // Pode ser 200 mesmo sem vinculos novos, ja existentes
  assert.equal(reprocessRes.response.status, 200);
});

test("accountant E2E: fechamento fiscal aplica elegibilidade, lifecycle, grants e isolamento", async () => {
  await prisma.accountantDocumentRequest.deleteMany({ where: { companyId: company.id } });
  const closingPath = `/api/accountant/companies/${company.id}/monthly-tax-closings`;

  // Sem configuração fiscal o snapshot é visível, mas a aprovação permanece bloqueada.
  const missingSettings = await request(closingPath, { method: "POST", headers: h(), body: JSON.stringify({ periodYear: 2026, periodMonth: 7 }) });
  assert.equal(missingSettings.response.status, 201);
  assert.equal(missingSettings.body.status, "TAX_SETTINGS_REQUIRED");
  assert.ok(missingSettings.body.warnings.some((warning) => warning.code === "TAX_SETTINGS_REQUIRED"));
  const blockedApproval = await request(`${closingPath}/${missingSettings.body.id}/approve`, { method: "POST", headers: h(), body: JSON.stringify({ note: "não deve aprovar" }) });
  assert.equal(blockedApproval.response.status, 422);

  await prisma.companyTaxSetting.create({ data: { companyId: company.id, taxRegime: "SIMPLES_NACIONAL", calculationRegime: "COMPETENCIA", uf: "SP", pisCofinsRegime: "CUMULATIVO", fiscalConfigComplete: false } });
  const incompleteSettings = await request(`${closingPath}/${missingSettings.body.id}/recalculate`, { method: "POST", headers: h() });
  assert.equal(incompleteSettings.response.status, 200);
  assert.equal(incompleteSettings.body.status, "TAX_SETTINGS_REQUIRED");
  await prisma.companyTaxSetting.update({ where: { companyId: company.id }, data: { fiscalConfigComplete: true } });
  const document = async (suffix, input) => prisma.fiscalDocument.create({ data: { companyId: company.id, documentType: "NFE", operationDirection: "INBOUND", invoiceNumber: suffix, accessKey: `3526071122233300014455001000000${suffix}1234567890`.slice(0, 44), emissionDate: new Date("2026-07-15"), totalAmount: 100, source: "REAL_SEFAZ", xmlStorageKey: `test/closing/${suffix}`, xmlHashSha256: "d".repeat(64), ...input } });
  await document("200", { operationDirection: "OUTBOUND", source: "ERP_IMPORT" });
  await document("201", { documentType: "CTE", operationDirection: "TRANSPORT_INBOUND", source: "MANUAL_IMPORT" });
  await document("202", { source: "MOCK" });
  await document("203", { source: "SEED" });
  await document("204", { isCancelled: true });
  await document("205", { status: "INUTILIZADA" });

  const recalculated = await request(`${closingPath}/${missingSettings.body.id}/recalculate`, { method: "POST", headers: h() });
  assert.equal(recalculated.response.status, 200);
  assert.equal(recalculated.body.status, "READY_FOR_APPROVAL");
  assert.deepEqual(new Set(recalculated.body.items.map((item) => item.category)), new Set(["NF_E_ENTRADA", "NF_E_SAIDA", "CT_E_ENTRADA"]));
  assert.ok(recalculated.body.items.every((item) => ["REAL_SEFAZ", "MANUAL_IMPORT", "ERP_IMPORT"].includes(item.source)));
  assert.equal(recalculated.body.items.some((item) => item.source === "MOCK" || item.source === "SEED"), false);

  const approved = await request(`${closingPath}/${missingSettings.body.id}/approve`, { method: "POST", headers: h(), body: JSON.stringify({ note: "Conferido E2E" }) });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.status, "APPROVED");
  const invalidReopen = await request(`${closingPath}/${missingSettings.body.id}/reopen`, { method: "POST", headers: h(), body: JSON.stringify({}) });
  assert.equal(invalidReopen.response.status, 422);
  const reopened = await request(`${closingPath}/${missingSettings.body.id}/reopen`, { method: "POST", headers: h(), body: JSON.stringify({ reason: "Documento corrigido" }) });
  assert.equal(reopened.response.status, 200);
  assert.ok(reopened.body.events.some((event) => event.action === "REOPENED" && event.note === "Documento corrigido"));

  const passwordHash = await bcrypt.hash("TestPassword#2026", 10);
  const actorHeaders = async (email, accessLevel, permissions, actorOffice = office) => {
    const actor = await prisma.user.create({ data: { name: email, email, passwordHash } });
    const actorMembership = await prisma.accountantMembership.create({ data: { officeId: actorOffice.id, userId: actor.id, role: "OPERATOR", status: "ACTIVE" } });
    await prisma.accountantUserCompanyAccess.create({ data: { membershipId: actorMembership.id, companyId: company.id, accessLevel, permissions } });
    const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "TestPassword#2026" }) });
    return { authorization: `Bearer ${login.body.token}`, "x-accountant-office-id": actorOffice.id, "content-type": "application/json" };
  };
  const readOnly = await actorHeaders("closing-readonly@e2e.test", "READ_ONLY", ["fiscal.closing.read"]);
  const restricted = await actorHeaders("closing-restricted@e2e.test", "RESTRICTED", ["fiscal.closing.read"]);
  const createOnly = await actorHeaders("closing-create@e2e.test", "RESTRICTED", ["fiscal.closing.create"]);
  for (const actor of [readOnly, restricted]) {
    const denied = await request(closingPath, { method: "POST", headers: actor, body: JSON.stringify({ periodYear: 2026, periodMonth: 6 }) });
    assert.equal(denied.response.status, 403);
  }
  const createAllowed = await request(closingPath, { method: "POST", headers: createOnly, body: JSON.stringify({ periodYear: 2026, periodMonth: 6 }) });
  assert.equal(createAllowed.response.status, 201);
  const approveDenied = await request(`${closingPath}/${createAllowed.body.id}/approve`, { method: "POST", headers: createOnly, body: JSON.stringify({}) });
  assert.equal(approveDenied.response.status, 403);

  const otherCompany = await prisma.company.create({ data: { ownerId: user.id, legalName: "EMPRESA FECHAMENTO ISOLADA", cnpj: "88888888000199", uf: "RJ", city: "Rio", environment: "homologation" } });
  const crossCompany = await request(`/api/accountant/companies/${otherCompany.id}/monthly-tax-closings/${missingSettings.body.id}`, { headers: h() });
  assert.ok([403, 404].includes(crossCompany.response.status));
  const officeB = await prisma.accountantOffice.create({ data: { name: "Escritório B", cnpj: "77777777000199" } });
  const officeBHeaders = await actorHeaders("closing-office-b@e2e.test", "FULL", [], officeB);
  const crossOffice = await request(`${closingPath}/${missingSettings.body.id}`, { headers: officeBHeaders });
  assert.ok([403, 404].includes(crossOffice.response.status));
});
