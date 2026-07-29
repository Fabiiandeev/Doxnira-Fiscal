import assert from "node:assert/strict";
import test from "node:test";

import forge from "node-forge";

import {
  assertMdfeTransition,
  buildMdfeAccessKey,
  buildMdfeXml,
  calculateModulo11CheckDigit,
  isValidCpf,
  isValidFiscalAccessKey,
  parseMdfeResponse,
  validateMdfe,
} from "../../src/modules/mdfe/mdfe.domain.js";
import {
  MDFE_ENDPOINTS,
  SvrsMdfeGateway,
} from "../../src/modules/mdfe/mdfe.gateway.js";
import { validateMdfeXmlWithXsd } from "../../src/modules/mdfe/mdfe.xsd.js";
import { signMdfeXml } from "../../src/services/xml-signature.service.js";

function fixture() {
  const company = {
    cnpj: "13219857000149",
    stateRegistration: "110944020",
    legalName: "EMPRESA TESTE",
    tradeName: "TESTE",
    city: "Goiania",
    uf: "GO",
    address: {
      street: "Rua Teste",
      number: "100",
      district: "Centro",
      cityCode: "5208707",
      city: "Goiania",
      uf: "GO",
      cep: "74000000",
    },
  };
  const emissionDate = new Date("2026-07-29T12:00:00-03:00");
  const accessKey = buildMdfeAccessKey({
    uf: "GO",
    emissionDate,
    cnpj: company.cnpj,
    series: "1",
    number: "1",
    emissionType: "1",
    numericCode: "12345678",
  });
  return {
    company,
    mdfe: {
      id: "00000000-0000-0000-0000-000000000001",
      model: "58",
      series: "1",
      number: "1",
      accessKey,
      numericCode: "12345678",
      checkDigit: accessKey.at(-1),
      environment: "homologation",
      emissionType: "NORMAL",
      issuerType: "PRESTADOR_SERVICO_TRANSPORTE",
      carrierType: "ETC",
      modal: "RODOVIARIO",
      emissionDate,
      tripStartAt: emissionDate,
      loadingAfter: false,
      processVersion: "DoxniraFiscal-1.0",
      loadingState: "GO",
      unloadingState: "SP",
      createdAt: emissionDate,
      totalCargoCents: "10000",
      totalWeightKg: "100",
      cargoUnit: "01",
      cargoQuantity: "100",
      additionalInfo: null,
      fiscalInfo: null,
      predominantProduct: "CARGA TESTE",
      predominantCargoType: "05",
      predominantNcm: "12345678",
      loadingCep: "74000000",
      unloadingCep: "01001000",
      loadingMunicipalities: [{ cityCode: "5208707", cityName: "Goiania" }],
      routeStates: [{ stateCode: "MG" }],
      unloadingCities: [{ cityCode: "3550308", cityName: "Sao Paulo" }],
      vehicle: {
        id: "00000000-0000-0000-0000-000000000002",
        plate: "ABC1D23",
        plateState: "GO",
        renavam: "12345678901",
        rntrc: "12345678",
        tareWeight: "5000",
        capacityKg: "10000",
        capacityM3: "50",
        wheelType: "01",
        bodyType: "00",
        ownerType: "0",
        ownerName: null,
        ownerCpfCnpj: null,
      },
      trailers: [],
      drivers: [{ name: "Joao da Silva", cpf: "52998224725", isPrimary: true }],
      fiscalDocuments: [{
        documentType: "NFE",
        accessKey: "35251057497647000198550253110100013619258940",
        unloadingCityCode: "3550308",
        documentValue: "100",
        grossWeight: "100",
      }],
      ciots: [{ number: "123456789012", responsibleTaxId: company.cnpj }],
      contractors: [{ taxId: company.cnpj }],
      tollVouchers: [],
      payments: [],
      insurances: [{
        responsibleType: "EMITENTE",
        responsibleCpfCnpj: company.cnpj,
        insurerName: "Seguradora Teste",
        insurerCnpj: company.cnpj,
        policyNumber: "AP123",
        endorsements: [{ endorsementNumber: "AV123" }],
      }],
      seals: [],
    },
  };
}

function signingMaterial() {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date("2025-01-01");
  certificate.validity.notAfter = new Date("2030-01-01");
  const attributes = [{ name: "commonName", value: "MDFE TEST" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certificatePem: forge.pki.certificateToPem(certificate),
  };
}

test("calcula módulo 11 da chave MDF-e", () => {
  const key = fixture().mdfe.accessKey;
  assert.equal(calculateModulo11CheckDigit(key.slice(0, 43)), key.at(-1));
});

test("gera chave de acesso modelo 58 com 44 dígitos", () => {
  const key = fixture().mdfe.accessKey;
  assert.equal(key, "52260713219857000149580010000000011123456787");
  assert.equal(isValidFiscalAccessKey(key), true);
});

test("forma e valida chave preparada para CNPJ alfanumérico", () => {
  const key = buildMdfeAccessKey({
    uf: "SP",
    emissionDate: new Date("2026-07-29T12:00:00-03:00"),
    cnpj: "12ABC34501DE35",
    series: "1",
    number: "1",
    emissionType: "1",
    numericCode: "12345678",
  });
  assert.match(key, /^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/);
  assert.equal(key.slice(6, 20), "12ABC34501DE35");
  assert.equal(isValidFiscalAccessKey(key), true);
});

test("valida CPF de condutor", () => {
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("11111111111"), false);
});

test("bloqueia transição inválida de estado", () => {
  assert.throws(
    () => assertMdfeTransition("DRAFT", "AUTHORIZED"),
    (error) => error.code === "MDFE_INVALID_STATUS_TRANSITION",
  );
  assert.doesNotThrow(() => assertMdfeTransition("DRAFT", "VALIDATING"));
});

test("motor de validação libera fixture completa", () => {
  const { mdfe } = fixture();
  const result = validateMdfe(mdfe, { certificate: { valid: true } });
  assert.equal(result.valid, true);
  assert.equal(result.blockingIssuesCount, 0);
});

test("motor de validação exige CIOT na operação remunerada", () => {
  const { mdfe } = fixture();
  mdfe.ciots = [];
  const result = validateMdfe(mdfe, { certificate: { valid: true } });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((item) => item.code === "MDFE_CIOT_REQUIRED"));
});

test("XML assinado passa no XSD oficial 3.00", async () => {
  const { mdfe, company } = fixture();
  const xml = buildMdfeXml(mdfe, company);
  const material = signingMaterial();
  const signedXml = signMdfeXml(xml, material.privateKeyPem, material.certificatePem);
  const result = await validateMdfeXmlWithXsd(signedXml);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("gateway SVRS usa endpoint de homologação e interpreta autorização", async () => {
  let request;
  const gateway = new SvrsMdfeGateway({
    configuration: {
      MDFE_INTEGRATION_ENABLED: true,
      ALLOW_PRODUCTION_SEFAZ: false,
      MDFE_TIMEOUT_MS: 30_000,
      MDFE_STORE_RAW_SOAP: false,
    },
    transport: async (input) => {
      request = input;
      return `<?xml version="1.0"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body>
            <retMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
              <cStat>100</cStat><xMotivo>Autorizado</xMotivo><nProt>123</nProt>
            </retMDFe>
          </soap:Body>
        </soap:Envelope>`;
    },
  });
  const result = await gateway.authorize({
    environment: "homologation",
    xml: "<MDFe/>",
    pfx: Buffer.from("test"),
    passphrase: "test",
  });
  assert.equal(request.url, MDFE_ENDPOINTS.HOMOLOGATION.reception);
  assert.match(request.action, /MDFeRecepcaoSinc/);
  assert.equal(result.success, true);
  assert.equal(result.protocol, "123");
  const operationalStatus = parseMdfeResponse(
    "<retConsStatServMDFe><cStat>107</cStat><xMotivo>Servico em Operacao</xMotivo></retConsStatServMDFe>",
  );
  assert.equal(operationalStatus.success, true);
  assert.equal(operationalStatus.statusCode, "107");
  assert.equal(parseMdfeResponse("<retMDFe><cStat>999</cStat></retMDFe>").success, false);
});
