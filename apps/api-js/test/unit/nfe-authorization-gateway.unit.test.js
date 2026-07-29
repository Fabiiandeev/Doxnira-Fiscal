import assert from "node:assert/strict";
import test from "node:test";

import {
  NFE_AUTHORIZATION_ENDPOINTS,
  SvrsNfeAuthorizationGateway,
} from "../../src/modules/nfe/nfe-authorization.gateway.js";

const authorizedResponse = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body><nfeResultMsg>
    <retEnviNFe versao="4.00">
      <tpAmb>2</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo>
      <protNFe versao="4.00"><infProt>
        <tpAmb>2</tpAmb><chNFe>52260712345678000195550010000000011234567890</chNFe>
        <dhRecbto>2026-07-29T16:00:00-03:00</dhRecbto>
        <nProt>152260000000001</nProt><cStat>100</cStat>
        <xMotivo>Autorizado o uso da NF-e</xMotivo>
      </infProt></protNFe>
    </retEnviNFe>
  </nfeResultMsg></soap:Body>
</soap:Envelope>`;

test("gateway NF-e envia lote síncrono ao endpoint SVRS de homologação", async () => {
  let request;
  const gateway = new SvrsNfeAuthorizationGateway({
    configuration: {
      NFE_AUTHORIZATION_ENABLED: true,
      ALLOW_PRODUCTION_SEFAZ: false,
      NFE_AUTHORIZATION_HOM_URL: NFE_AUTHORIZATION_ENDPOINTS.HOMOLOGATION,
      NFE_AUTHORIZATION_PROD_URL: NFE_AUTHORIZATION_ENDPOINTS.PRODUCTION,
      NFE_AUTHORIZATION_TIMEOUT_MS: 30_000,
    },
    transport: async (input) => {
      request = input;
      return authorizedResponse;
    },
  });
  const result = await gateway.authorize({
    signedXml: "<NFe><infNFe Id=\"NFe1\"/></NFe>",
    environment: "2",
    pfx: Buffer.from("test"),
    passphrase: "test",
    lotId: "123",
  });
  assert.equal(request.url, NFE_AUTHORIZATION_ENDPOINTS.HOMOLOGATION);
  assert.match(request.body, /<indSinc>1<\/indSinc>/);
  assert.equal(result.authorized, true);
  assert.equal(result.authorizationStatus, "100");
  assert.equal(result.protocol, "152260000000001");
  assert.match(result.authorizedXml, /<nfeProc/);
});

test("gateway NF-e bloqueia integração desabilitada", async () => {
  const gateway = new SvrsNfeAuthorizationGateway({
    configuration: { NFE_AUTHORIZATION_ENABLED: false },
  });
  await assert.rejects(
    gateway.authorize({ signedXml: "<NFe/>", environment: "2" }),
    (error) => error.code === "NFE_AUTHORIZATION_DISABLED",
  );
});

test("gateway NF-e bloqueia produção sem autorização explícita", async () => {
  const gateway = new SvrsNfeAuthorizationGateway({
    configuration: {
      NFE_AUTHORIZATION_ENABLED: true,
      ALLOW_PRODUCTION_SEFAZ: false,
    },
  });
  await assert.rejects(
    gateway.authorize({ signedXml: "<NFe/>", environment: "1" }),
    (error) => error.code === "NFE_PRODUCTION_BLOCKED",
  );
});
