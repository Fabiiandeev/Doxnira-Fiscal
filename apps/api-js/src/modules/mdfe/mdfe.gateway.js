import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { postSoap } from "../../services/soap-client.service.js";
import { parseMdfeResponse } from "./mdfe.domain.js";

export const MDFE_ENDPOINTS = Object.freeze({
  HOMOLOGATION: {
    reception:
      "https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx",
    event:
      "https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx",
    consultation:
      "https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx",
    status:
      "https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeStatusServico/MDFeStatusServico.asmx",
    open:
      "https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsNaoEnc/MDFeConsNaoEnc.asmx",
    distribution:
      "https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeDistribuicaoDFe/MDFeDistribuicaoDFe.asmx",
  },
  PRODUCTION: {
    reception:
      "https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx",
    event:
      "https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx",
    consultation:
      "https://mdfe.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx",
    status:
      "https://mdfe.svrs.rs.gov.br/ws/MDFeStatusServico/MDFeStatusServico.asmx",
    open:
      "https://mdfe.svrs.rs.gov.br/ws/MDFeConsNaoEnc/MDFeConsNaoEnc.asmx",
    distribution:
      "https://mdfe.svrs.rs.gov.br/ws/MDFeDistribuicaoDFe/MDFeDistribuicaoDFe.asmx",
  },
});

const SERVICES = Object.freeze({
  reception: {
    namespace: "MDFeRecepcaoSinc",
    action:
      "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc/mdfeRecepcao",
  },
  event: {
    namespace: "MDFeRecepcaoEvento",
    action:
      "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento",
  },
  consultation: {
    namespace: "MDFeConsulta",
    action:
      "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta/mdfeConsultaMDF",
  },
  status: {
    namespace: "MDFeStatusServico",
    action:
      "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico/mdfeStatusServicoMDF",
  },
  open: {
    namespace: "MDFeConsNaoEnc",
    action:
      "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsNaoEnc/mdfeConsNaoEnc",
  },
  distribution: {
    namespace: "MDFeDistribuicaoDFe",
    action:
      "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe/mdfeDistDFeInteresse",
  },
});

function soapEnvelope(namespace, xml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <mdfeDadosMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/${namespace}">${xml}</mdfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function environmentKey(value) {
  return String(value || "").toLowerCase() === "production"
    ? "PRODUCTION"
    : "HOMOLOGATION";
}

export class SvrsMdfeGateway {
  constructor({ transport = postSoap, configuration = env } = {}) {
    this.transport = transport;
    this.configuration = configuration;
  }

  async request(serviceName, input) {
    const environment = environmentKey(input.environment);
    if (!this.configuration.MDFE_INTEGRATION_ENABLED) {
      throw new AppError(
        "A transmissão real do MDF-e está desabilitada neste ambiente.",
        "MDFE_INTEGRATION_DISABLED",
        409,
      );
    }
    if (environment === "PRODUCTION" && !this.configuration.ALLOW_PRODUCTION_SEFAZ) {
      throw new AppError(
        "Transmissão MDF-e em produção bloqueada pela configuração de segurança.",
        "MDFE_PRODUCTION_BLOCKED",
        409,
      );
    }
    const service = SERVICES[serviceName];
    const responseXml = await this.transport({
      url: MDFE_ENDPOINTS[environment][serviceName],
      action: service.action,
      body: soapEnvelope(service.namespace, input.xml),
      pfx: input.pfx,
      passphrase: input.passphrase,
      timeoutMs: this.configuration.MDFE_TIMEOUT_MS,
    });
    return {
      ...parseMdfeResponse(responseXml),
      responseXml: this.configuration.MDFE_STORE_RAW_SOAP ? responseXml : undefined,
    };
  }

  authorize(input) {
    return this.request("reception", input);
  }

  consult(input) {
    return this.request("consultation", input);
  }

  statusService(input) {
    return this.request("status", input);
  }

  sendEvent(input) {
    return this.request("event", input);
  }

  consultOpen(input) {
    return this.request("open", input);
  }

  distribute(input) {
    return this.request("distribution", input);
  }
}

export const svrsMdfeGateway = new SvrsMdfeGateway();
