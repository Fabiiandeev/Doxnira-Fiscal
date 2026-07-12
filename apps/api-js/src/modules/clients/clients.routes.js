import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { isValidCnpj, normalizeCnpj } from "../../utils/cnpj.js";
import { normalizeCpf, isValidCpf } from "../../utils/cpf.js";
import { ensureCodigoUfIbgeColumn } from "../../services/cnpj-lookup.service.js";
import { resolveCnpjData } from "../../services/data-resolver.service.js";
import { validarClienteParaEmissao } from "../../lib/fiscal/validar-cliente-para-emissao.js";

const BOOLEAN_STRING_FIELDS = [
  "optanteSimples",
  "mei",
  "empresaPublica",
  "filial",
  "matriz",
  "contribuinteIcms",
  "contribuinteIss",
  "substituicaoTributaria",
];

const JSON_OBJECT_FIELDS = [
  "retencoes",
  "cnaeSecundarios",
  "atividadesPermitidas",
  "atividadesIncompativeis",
  "fiscalAi",
  "scoreDetalhes",
  "reformaPrep",
  "historicoJson",
];

function normalizePayload(raw) {
  const data = { ...raw };
  for (const field of BOOLEAN_STRING_FIELDS) {
    if (field in data && typeof data[field] === "string") {
      if (data[field].toLowerCase() === "true") {
        data[field] = true;
      } else if (data[field].toLowerCase() === "false") {
        data[field] = false;
      }
    }
  }
  for (const field of JSON_OBJECT_FIELDS) {
    if (field in data) {
      if (data[field] && typeof data[field] === "object" && !Array.isArray(data[field])) {
        data[field] = data[field];
      } else if (Array.isArray(data[field])) {
        data[field] = data[field];
      } else {
        data[field] = null;
      }
    }
  }
  return data;
}

function computeCrt(optanteSimples, mei) {
  if (mei === true) return "4";
  if (optanteSimples === true) return "1";
  if (optanteSimples === false && mei === false) return null;
  return null;
}

const CLIENT_PRISMA_FIELDS = new Set([
  "tipoPessoa", "ownerId", "companyId", "nome", "razaoSocial", "nomeFantasia",
  "cpf", "cnpj", "inscricaoEstadual", "inscricaoMunicipal",
  "regimeTributario", "cnae", "atividadeEconomica", "naturezaJuridica",
  "situacaoCadastral", "rg", "dataNascimento",
  "cep", "logradouro", "numero", "complemento", "bairro",
  "municipio", "uf", "codigoIbge", "codigoUfIbge",
  "email", "telefone", "whatsapp", "site",
  "contatoFinanceiro", "contatoFiscal",
  "observacoes", "fonteDados",
  "porte", "capitalSocial", "dataAbertura", "situacaoMotivo",
  "optanteSimples", "mei", "empresaPublica", "filial", "matriz",
  "crt", "indicadorIe", "ieStatus", "imStatus", "tipoContribuinte",
  "contribuinteIcms", "contribuinteIss", "substituicaoTributaria",
  "retencoes", "cnaeSecundarios", "riscoFiscalCnae",
  "atividadesPermitidas", "atividadesIncompativeis",
  "pais", "latitude", "longitude",
  "fiscalAi", "scoreCadastro", "scoreDetalhes", "reformaPrep",
  "dadosOriginaisJson", "alertasJson", "validadoPorIa",
  "historicoJson", "ultimaConsulta",
]);

function stripUnknownFields(data) {
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (CLIENT_PRISMA_FIELDS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

function computeIndicadorIe(ieNumber) {
  if (!ieNumber) return "9";
  const upper = String(ieNumber).toUpperCase().trim();
  if (upper === "ISENTO") return "2";
  if (/^\d+$/.test(upper)) return "1";
  return "9";
}

function computeTipoContribuinte(contribuinteIcms, contribuinteIss) {
  const icms = Boolean(contribuinteIcms);
  const iss = Boolean(contribuinteIss);
  if (icms && iss) return "Ambos";
  if (icms) return "Contribuinte ICMS";
  if (iss) return "Contribuinte ISS";
  return "Não contribuinte";
}

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

export const clientesPublicRouter = Router();
export const customersRouter = Router();

const customerCompanySelect = {
  id: true,
  ownerId: true,
  legalName: true,
  tradeName: true,
  cnpj: true,
  stateRegistration: true,
  stateRegistrationStatus: true,
  stateRegistrationSource: true,
  stateRegistrationFormatted: true,
  icmsContributorStatus: true,
  uf: true,
  city: true,
  taxRegime: true,
  status: true,
  environment: true,
  nfeLastNsu: true,
  nfeMaxNsu: true,
  nfeNextAllowedSyncAt: true,
  lastSyncAt: true,
};

async function resolveCustomerCompany(request, _response, next) {
  if (request.company) {
    next();
    return;
  }

  const requestedCompanyId =
    request.query.companyId ||
    request.get("x-company-id") ||
    null;

  let company = null;
  if (requestedCompanyId) {
    company = await prisma.company.findFirst({
      where: {
        id: String(requestedCompanyId),
        ownerId: request.user.id,
        status: { not: "deleted" },
      },
      select: customerCompanySelect,
    });
  }

  if (!company) {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId: request.user.id },
      select: { defaultCompanyId: true },
    });
    if (preferences?.defaultCompanyId) {
      company = await prisma.company.findFirst({
        where: {
          id: preferences.defaultCompanyId,
          ownerId: request.user.id,
          status: { not: "deleted" },
        },
        select: customerCompanySelect,
      });
    }
  }

  if (!company) {
    company = await prisma.company.findFirst({
      where: { ownerId: request.user.id, status: { not: "deleted" } },
      orderBy: { createdAt: "asc" },
      select: customerCompanySelect,
    });
  }

  if (!company) {
    throw new AppError("Nenhuma empresa ativa encontrada para clientes.", "COMPANY_NOT_FOUND", 404);
  }

  request.company = company;
  next();
}

function validateDocumentLookupPayload(raw) {
  const document = String(raw.document || raw.cpfCnpj || raw.cnpj || raw.cpf || "").replace(/\D/g, "");
  if (document.length === 14) return { kind: "PJ", document };
  if (document.length === 11) return { kind: "PF", document };
  throw new AppError("Informe um CPF ou CNPJ válido.", "INVALID_DOCUMENT", 400);
}

let ddlInitialized = false;

clientesPublicRouter.get(
  "/buscar-cnpj",
  asyncHandler(async (request, response) => {
    const raw = String(request.query.cnpj || "");
    const digits = normalizeCnpj(raw);
    if (!isValidCnpj(digits)) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
    }

    if (!ddlInitialized) {
      try { await ensureCodigoUfIbgeColumn(); } catch {}
      ddlInitialized = true;
    }

    try {
      const data = await resolveCnpjData(digits);
      const emp = data.empresa || {};
      const ie = data.inscricaoEstadual || {};
      const fiscal = data.fiscal || {};
      const enrichment = data._enrichment || {};
      const derived = enrichment.derived || {};
      const ieFound = Boolean(ie.numero);

      const codigoIbge = enrichment.codigoIbge || null;
      const ddd = enrichment.ddd || null;
      const codigoUfIbge = enrichment.codigoUfIbge || null;

      const optanteSimples = emp.optanteSimples === true ? true : emp.optanteSimples === false ? false : null;
      const mei = emp.mei === true ? true : emp.mei === false ? false : null;
      const regimeTributario = derived.regimeTributario || (mei === true ? "MEI" : optanteSimples === true ? "Simples Nacional" : "PENDENTE_CONFIRMACAO");
      const crt = derived.crt || computeCrt(optanteSimples, mei);
      const indicadorIe = derived.indicadorIe || computeIndicadorIe(ie.numero);
      const contribuinteIcms = derived.contribuinteIcms ?? (ieFound ? true : null);
      const tipoContribuinte = derived.tipoContribuinte || computeTipoContribuinte(contribuinteIcms, null);

      const retencoes = {
        irrf: false,
        csll: false,
        pis: false,
        cofins: false,
        iss: false,
      };

      const mapped = {
        success: true,
        tipoPessoa: "PJ",
        cnpj: emp.cnpj ?? digits,
        razaoSocial: emp.razaoSocial || null,
        nomeFantasia: emp.nomeFantasia || null,
        inscricaoEstadual: ie.numero || null,
        inscricaoMunicipal: emp.inscricaoMunicipal || null,
        regimeTributario,
        cnae: emp.cnaePrincipal?.codigo || null,
        atividadeEconomica: emp.cnaePrincipal?.descricao || null,
        situacaoCadastral: emp.situacaoCadastral || null,
        telefone: emp.telefone || null,
        telefone1: emp.telefone1 || null,
        telefone2: emp.telefone2 || null,
        email: emp.email || null,
        cep: emp.cep || null,
        logradouro: emp.endereco || null,
        numero: emp.numero || null,
        complemento: emp.complemento || null,
        bairro: emp.bairro || null,
        cidade: emp.cidade || null,
        uf: emp.uf || null,
        codigoIbge,
        codigoUfIbge,
        ddd,
        pais: "BRASIL",
        latitude: null,
        longitude: null,
        fonte: ie.fonte || "PROVEDOR_CNPJ",
        dadosOriginais: data,
        alertas: [],
        naturezaJuridica: emp.naturezaJuridica || null,
        porte: emp.porte || null,
        capitalSocial: emp.capitalSocial || null,
        dataAbertura: emp.dataAbertura || null,
        situacaoMotivo: null,
        situacaoData: emp.situacaoCadastralData || null,
        optanteSimples,
        mei,
        empresaPublica: null,
        filial: emp.filial != null ? emp.filial : null,
        matriz: emp.matriz != null ? emp.matriz : null,
        crt,
        descricaoCrt: derived.descricaoCrt || (crt === "4" ? "4 — MEI" : crt === "1" ? "1 — Simples Nacional" : crt === "2" ? "2 — Simples com ST" : crt === "3" ? "3 — Regime Normal" : null),
        indicadorIe,
        ieStatus: derived.ieStatus || (ieFound ? "ENCONTRADA" : "NAO_ENCONTRADA"),
        imStatus: derived.imStatus || (emp.inscricaoMunicipal ? "ATIVA" : null),
        tipoContribuinte,
        contribuinteIcms,
        contribuinteIss: null,
        substituicaoTributaria: null,
        retencoes,
        whatsapp: null,
        site: enrichment.site || null,
        contatoFinanceiro: null,
        contatoFiscal: null,
        cnaeSecundarios: emp.cnaeSecundarios || null,
        riscoFiscalCnae: null,
        atividadesPermitidas: null,
        atividadesIncompativeis: null,
        observacoes: null,
        qsa: enrichment.qsa || null,
        dataOpcaoSimples: enrichment.dataOpcaoSimples || null,
        dataExclusaoSimples: enrichment.dataExclusaoSimples || null,
        fieldSources: enrichment.fieldSources || {},
        fieldScores: enrichment.fieldScores || {},
        _enrichmentLog: enrichment.log || null,
      };

      if (!mapped.inscricaoEstadual) {
        mapped.alertas.push({ code: "IE_NOT_FOUND", message: "IE não encontrada automaticamente. Confirme manualmente antes de emitir NF-e." });
      }

      if (enrichment.log && enrichment.log.fallbackUsed) {
        mapped.alertas.push({ code: "ENRICHMENT_FALLBACK", message: "Dados complementados por fonte alternativa para maior completude." });
      }

      sendSuccess(response, mapped);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Não foi possível consultar o CNPJ agora.", "CNPJ_LOOKUP_FAILED", 503);
    }
  }),
);

clientesPublicRouter.get(
  "/buscar-cpf",
  asyncHandler(async (request, response) => {
    const raw = String(request.query.cpf || "");
    const cpf = normalizeCpf(raw);
    if (!isValidCpf(cpf)) {
      throw new AppError("CPF inválido.", "INVALID_CPF_FORMAT", 400);
    }

    const mapped = {
      success: true,
      tipoPessoa: "PF",
      cpf,
      nome: null,
      telefone: null,
      email: null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      codigoIbge: null,
      fonte: null,
      dadosOriginais: null,
      alertas: [{ code: "CPF_PROVIDER_NOT_CONFIGURED", message: "Provider de CPF não configurado." }],
      rg: null,
      dataNascimento: null,
      whatsapp: null,
      site: null,
      contatoFinanceiro: null,
      contatoFiscal: null,
    };
    sendSuccess(response, mapped);
  }),
);

clientesPublicRouter.get(
  "/validar-sintegra",
  asyncHandler(async (request, response) => {
    const cnpj = String(request.query.cnpj || "");
    const uf = String(request.query.uf || "").toUpperCase();
    const digits = normalizeCnpj(cnpj);
    if (!isValidCnpj(digits)) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
    }

    try {
      const data = await resolveCnpjData(digits);
      const ie = data.inscricaoEstadual || {};
      const emp = data.empresa || {};
      const enrichment = data._enrichment || {};
      const derived = enrichment.derived || {};
      const ieNumber = ie.numero || null;
      const ieFound = Boolean(ieNumber);

      const result = {
        success: true,
        cnpj: digits,
        uf: uf || ie.uf || emp.uf || null,
        inscricaoEstadual: ieNumber,
        inscricaoEstadualFormatada: ie.numeroFormatado || ieNumber,
        ieStatus: derived.ieStatus || (ieFound ? "ENCONTRADA" : "NAO_ENCONTRADA"),
        situacao: ie.situacao || "PENDENTE_VALIDACAO_SEFAZ",
        fonte: ie.fonte || (ieFound ? "BUSCA_AUTOMATICA" : "NAO_ENCONTRADA"),
        indicadorIe: derived.indicadorIe || (ieFound ? "1" : "9"),
        contribuinteIcms: derived.contribuinteIcms ?? (ieFound ? true : false),
        tipoContribuinte: derived.tipoContribuinte || (ieFound ? "Contribuinte ICMS" : "Não contribuinte"),
      };

      sendSuccess(response, result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao consultar Sintegra.", "SINTEGRA_ERROR", 503);
    }
  }),
);

customersRouter.use(requireAuth);
customersRouter.use(asyncHandler(resolveCustomerCompany));

customersRouter.post(
  "/lookup-document",
  asyncHandler(async (request, response) => {
    const { kind, document } = validateDocumentLookupPayload(request.body || {});
    if (kind === "PF") {
      if (!isValidCpf(document)) {
        throw new AppError("CPF inválido.", "INVALID_CPF_FORMAT", 400);
      }
      sendSuccess(response, {
        success: true,
        tipoPessoa: "PF",
        cpf: document,
        nome: null,
        telefone: null,
        email: null,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
        codigoIbge: null,
        fonte: "VALIDACAO_LOCAL",
        dadosOriginais: null,
        alertas: [
          {
            code: "CPF_PROVIDER_NOT_CONFIGURED",
            message: "Provider de CPF não configurado. CPF validado localmente.",
          },
        ],
      });
      return;
    }

    if (!isValidCnpj(document)) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
    }

    try {
      const data = await resolveCnpjData(document);
      const emp = data.empresa || {};
      const ie = data.inscricaoEstadual || {};
      const enrichment = data._enrichment || {};
      const derived = enrichment.derived || {};
      const optanteSimples = emp.optanteSimples === true ? true : emp.optanteSimples === false ? false : null;
      const mei = emp.mei === true ? true : emp.mei === false ? false : null;
      const ieFound = Boolean(ie.numero);
      const regimeTributario = derived.regimeTributario || (mei === true ? "MEI" : optanteSimples === true ? "Simples Nacional" : "PENDENTE_CONFIRMACAO");
      const indicadorIe = derived.indicadorIe || computeIndicadorIe(ie.numero);
      const contribuinteIcms = derived.contribuinteIcms ?? (ieFound ? true : null);
      const mapped = {
        success: true,
        tipoPessoa: "PJ",
        cnpj: emp.cnpj ?? document,
        razaoSocial: emp.razaoSocial || null,
        nomeFantasia: emp.nomeFantasia || null,
        inscricaoEstadual: ie.numero || null,
        inscricaoMunicipal: emp.inscricaoMunicipal || null,
        regimeTributario,
        cnae: emp.cnaePrincipal?.codigo || null,
        atividadeEconomica: emp.cnaePrincipal?.descricao || null,
        situacaoCadastral: emp.situacaoCadastral || null,
        telefone: emp.telefone || null,
        email: emp.email || null,
        cep: emp.cep || null,
        logradouro: emp.endereco || null,
        numero: emp.numero || null,
        complemento: emp.complemento || null,
        bairro: emp.bairro || null,
        cidade: emp.cidade || null,
        uf: emp.uf || null,
        codigoIbge: enrichment.codigoIbge || null,
        codigoUfIbge: enrichment.codigoUfIbge || null,
        ddd: enrichment.ddd || null,
        pais: "BRASIL",
        fonte: ie.fonte || "PROVEDOR_CNPJ",
        dadosOriginais: data,
        alertas: [],
        naturezaJuridica: emp.naturezaJuridica || null,
        porte: emp.porte || null,
        capitalSocial: emp.capitalSocial || null,
        dataAbertura: emp.dataAbertura || null,
        optanteSimples,
        mei,
        filial: emp.filial != null ? emp.filial : null,
        matriz: emp.matriz != null ? emp.matriz : null,
        crt: derived.crt || computeCrt(optanteSimples, mei),
        descricaoCrt: derived.descricaoCrt || null,
        indicadorIe,
        ieStatus: derived.ieStatus || (ieFound ? "ENCONTRADA" : "NAO_ENCONTRADA"),
        imStatus: emp.inscricaoMunicipal ? "ATIVA" : null,
        tipoContribuinte: derived.tipoContribuinte || computeTipoContribuinte(contribuinteIcms, null),
        contribuinteIcms,
        contribuinteIss: null,
        retencoes: { irrf: false, csll: false, pis: false, cofins: false, iss: false },
        cnaeSecundarios: emp.cnaeSecundarios || null,
      };
      if (!mapped.inscricaoEstadual) {
        mapped.alertas.push({
          code: "IE_NOT_FOUND",
          message: "IE não encontrada automaticamente. Confirme manualmente antes de emitir NF-e.",
        });
      }
      sendSuccess(response, mapped);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Não foi possível consultar o CNPJ agora.", "CNPJ_LOOKUP_FAILED", 503);
    }
  }),
);

clientesRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const payload = normalizePayload(request.body || {});

    const tipo = String(payload.tipoPessoa || "").toUpperCase();
    if (!["PJ", "PF"].includes(tipo)) {
      throw new AppError("Tipo de pessoa inválido.", "INVALID_TIPO", 400);
    }

    if (tipo === "PJ") {
      if (!payload.cnpj || !isValidCnpj(normalizeCnpj(payload.cnpj))) {
        throw new AppError("CNPJ inválido.", "INVALID_CNPJ", 400);
      }
      if (!payload.razaoSocial) {
        throw new AppError("Razão Social é obrigatória.", "RAZAO_SOCIAL_REQUIRED", 400);
      }
      const cidade = payload.cidade || payload.municipio;
      if (!payload.uf || !cidade || !payload.logradouro) {
        throw new AppError("Dados de endereço incompletos (UF, cidade e logradouro obrigatórios).", "ENDERECO_INCOMPLETO", 400, [
          { field: "uf", message: !payload.uf ? "UF obrigatória" : undefined },
          { field: "cidade", message: !cidade ? "Cidade obrigatória" : undefined },
          { field: "logradouro", message: !payload.logradouro ? "Logradouro obrigatório" : undefined },
        ].filter(e => e.message !== undefined));
      }
    }

    if (tipo === "PF") {
      if (!payload.cpf || !isValidCpf(normalizeCpf(payload.cpf))) {
        throw new AppError("CPF inválido.", "INVALID_CPF", 400);
      }
      if (!payload.nome) {
        throw new AppError("Nome completo é obrigatório.", "NOME_REQUIRED", 400);
      }
    }

    const nullIfEmpty = (v) => (v === "" || v === undefined || v === null) ? null : v;
    const parseDate = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const parseNum = (v) => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    const parseBool = (v) => {
      if (v === true || v === "true" || v === 1) return true;
      if (v === false || v === "false" || v === 0) return false;
      return null;
    };
    const parseJson = (v) => {
      if (v == null) return null;
      if (typeof v === "object") return v;
      try { return JSON.parse(v); } catch { return null; }
    };

    const data = {
      tipoPessoa: tipo,
      ownerId: request.user.id,
      companyId: request.company.id,
      cnpj: tipo === "PJ" ? String(payload.cnpj).replace(/\D/g, "") : null,
      cpf: tipo === "PF" ? String(payload.cpf).replace(/\D/g, "") : null,
      razaoSocial: nullIfEmpty(payload.razaoSocial),
      nomeFantasia: nullIfEmpty(payload.nomeFantasia),
      nome: nullIfEmpty(payload.nome),
      naturezaJuridica: nullIfEmpty(payload.naturezaJuridica),
      porte: nullIfEmpty(payload.porte),
      capitalSocial: nullIfEmpty(payload.capitalSocial),
      dataAbertura: parseDate(payload.dataAbertura),
      dataNascimento: parseDate(payload.dataNascimento),
      situacaoCadastral: nullIfEmpty(payload.situacaoCadastral),
      situacaoMotivo: nullIfEmpty(payload.situacaoMotivo),
      rg: nullIfEmpty(payload.rg),
      optanteSimples: parseBool(payload.optanteSimples),
      mei: parseBool(payload.mei),
      empresaPublica: parseBool(payload.empresaPublica),
      filial: parseBool(payload.filial),
      matriz: parseBool(payload.matriz),
      regimeTributario: nullIfEmpty(payload.regimeTributario),
      crt: nullIfEmpty(payload.crt),
      indicadorIe: nullIfEmpty(payload.indicadorIe),
      inscricaoEstadual: nullIfEmpty(payload.inscricaoEstadual),
      ieStatus: nullIfEmpty(payload.ieStatus),
      inscricaoMunicipal: nullIfEmpty(payload.inscricaoMunicipal),
      imStatus: nullIfEmpty(payload.imStatus),
      tipoContribuinte: nullIfEmpty(payload.tipoContribuinte),
      contribuinteIcms: parseBool(payload.contribuinteIcms),
      contribuinteIss: parseBool(payload.contribuinteIss),
      substituicaoTributaria: parseBool(payload.substituicaoTributaria),
      retencoes: parseJson(payload.retencoes),
      cnae: nullIfEmpty(payload.cnae),
      atividadeEconomica: nullIfEmpty(payload.atividadeEconomica),
      cnaeSecundarios: parseJson(payload.cnaeSecundarios),
      riscoFiscalCnae: nullIfEmpty(payload.riscoFiscalCnae),
      atividadesPermitidas: parseJson(payload.atividadesPermitidas),
      atividadesIncompativeis: parseJson(payload.atividadesIncompativeis),
      cep: nullIfEmpty(payload.cep) ? String(payload.cep).replace(/\D/g, "") : null,
      logradouro: nullIfEmpty(payload.logradouro),
      numero: nullIfEmpty(payload.numero),
      complemento: nullIfEmpty(payload.complemento),
      bairro: nullIfEmpty(payload.bairro),
      municipio: nullIfEmpty(payload.municipio || payload.cidade),
      uf: nullIfEmpty(payload.uf),
      codigoIbge: nullIfEmpty(payload.codigoIbge),
      codigoUfIbge: nullIfEmpty(payload.codigoUfIbge),
      pais: nullIfEmpty(payload.pais),
      latitude: parseNum(payload.latitude),
      longitude: parseNum(payload.longitude),
      telefone: nullIfEmpty(payload.telefone) ? String(payload.telefone).replace(/\D/g, "") : null,
      whatsapp: nullIfEmpty(payload.whatsapp),
      email: nullIfEmpty(payload.email),
      site: nullIfEmpty(payload.site),
      contatoFinanceiro: nullIfEmpty(payload.contatoFinanceiro),
      contatoFiscal: nullIfEmpty(payload.contatoFiscal),
      observacoes: nullIfEmpty(payload.observacoes),
      fonteDados: nullIfEmpty(payload.fonteDados),
      dadosOriginaisJson: parseJson(payload.dadosOriginaisJson || payload.dadosOriginais),
      alertasJson: parseJson(payload.alertasJson || payload.alertas),
      historicoJson: parseJson(payload.historicoJson),
      fiscalAi: parseJson(payload.fiscalAi),
      scoreCadastro: parseNum(payload.scoreCadastro) != null ? Math.round(Number(payload.scoreCadastro)) : null,
      scoreDetalhes: parseJson(payload.scoreDetalhes),
      reformaPrep: parseJson(payload.reformaPrep),
      validadoPorIa: parseBool(payload.validadoPorIa) ?? false,
      ultimaConsulta: parseDate(payload.ultimaConsulta),
    };

    const cleanData = stripUnknownFields(data);

    try {
      const client = await prisma.client.create({ data: cleanData });
      sendSuccess(response, client, 201);
    } catch (error) {
      if (error.code === "P2002") {
        const target = error.meta?.target || [];
        throw new AppError(`Dados duplicados: ${target.join(", ")}`, "DUPLICATE", 409);
      }
      if (error.code === "P2000") {
        throw new AppError("Valor muito longo para um campo.", "VALUE_TOO_LONG", 400, [{ field: error.meta?.column, message: "Valor excede o tamanho máximo" }]);
      }
      if (error.code === "P2003") {
        throw new AppError("Referência inválida: dado conectado não encontrado.", "FK_VIOLATION", 400, [{ field: error.meta?.field_name, message: error.message || "Chave estrangeira inválida" }]);
      }
      throw new AppError("Erro ao salvar cliente. Verifique os dados.", "CREATE_FAILED", 400, [{ field: "general", message: error.message || "Erro desconhecido" }]);
    }
  }),
);

clientesRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const query = String(request.query.q ?? "").trim();
    const queryDigits = query.replace(/\D/g, "");

    let where = { companyId };

    if (query) {
      const orConditions = [
        { razaoSocial: { contains: query, mode: "insensitive" } },
        { nomeFantasia: { contains: query, mode: "insensitive" } },
        { nome: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { municipio: { contains: query, mode: "insensitive" } },
        { uf: { contains: query.toUpperCase() } },
      ];

      if (queryDigits) {
        orConditions.push(
          { cnpj: { contains: queryDigits } },
          { cnpj: { contains: query } },
          { cpf: { contains: queryDigits } },
          { cpf: { contains: query } },
          { telefone: { contains: queryDigits } },
          { telefone: { contains: query } },
          { inscricaoEstadual: { contains: queryDigits } },
          { inscricaoEstadual: { contains: query } },
        );
      } else {
        orConditions.push(
          { inscricaoEstadual: { contains: query, mode: "insensitive" } },
        );
      }

      where = { ...where, OR: orConditions };
    }

    const items = await prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    sendSuccess(response, { data: items });
  }),
);

clientesRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const query = String(request.query.q ?? request.query.search ?? "").trim();
    const queryDigits = query.replace(/\D/g, "");

    const where = { companyId };
    if (query) {
      where.OR = [
        { razaoSocial: { contains: query, mode: "insensitive" } },
        { nomeFantasia: { contains: query, mode: "insensitive" } },
        { nome: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { municipio: { contains: query, mode: "insensitive" } },
        { uf: { contains: query.toUpperCase() } },
        { inscricaoEstadual: { contains: query, mode: "insensitive" } },
      ];

      if (queryDigits) {
        where.OR.push(
          { cnpj: { contains: queryDigits } },
          { cpf: { contains: queryDigits } },
          { telefone: { contains: queryDigits } },
          { inscricaoEstadual: { contains: queryDigits } },
        );
      }
    }

    const items = await prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: Math.min(Math.max(Number(request.query.limit || 25), 1), 100),
    });
    sendSuccess(response, { data: items });
  }),
);

clientesRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const client = await prisma.client.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!client) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);
    sendSuccess(response, client);
  }),
);

const updateClientHandler = asyncHandler(async (request, response) => {
    const existing = await prisma.client.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!existing) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);

    const payload = normalizePayload(request.body || {});
    if (payload.cpf && !isValidCpf(normalizeCpf(payload.cpf))) {
      throw new AppError("CPF inválido.", "INVALID_CPF", 400);
    }
    if (payload.cnpj && !isValidCnpj(normalizeCnpj(payload.cnpj))) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ", 400);
    }

    const nullIfEmpty = (v) => {
      if (v === undefined) return undefined;
      return (v === "" || v === null) ? null : v;
    };
    const parseDate = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const parseNum = (v) => {
      if (v == null || v === "") return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    };
    const parseBool = (v) => {
      if (v === true || v === "true" || v === 1) return true;
      if (v === false || v === "false" || v === 0) return false;
      return undefined;
    };
    const parseJson = (v) => {
      if (v == null) return undefined;
      if (typeof v === "object") return v;
      try { return JSON.parse(v); } catch { return undefined; }
    };

    const setIfProvided = (obj, key, value) => {
      if (value !== undefined) obj[key] = value;
    };

    const data = {};
    setIfProvided(data, "tipoPessoa", nullIfEmpty(payload.tipoPessoa));
    setIfProvided(data, "cnpj", payload.cnpj ? String(payload.cnpj).replace(/\D/g, "") : undefined);
    setIfProvided(data, "cpf", payload.cpf ? String(payload.cpf).replace(/\D/g, "") : undefined);
    setIfProvided(data, "razaoSocial", nullIfEmpty(payload.razaoSocial));
    setIfProvided(data, "nomeFantasia", nullIfEmpty(payload.nomeFantasia));
    setIfProvided(data, "nome", nullIfEmpty(payload.nome));
    setIfProvided(data, "naturezaJuridica", nullIfEmpty(payload.naturezaJuridica));
    setIfProvided(data, "porte", nullIfEmpty(payload.porte));
    setIfProvided(data, "capitalSocial", nullIfEmpty(payload.capitalSocial));
    setIfProvided(data, "dataAbertura", payload.dataAbertura != null ? parseDate(payload.dataAbertura) : undefined);
    setIfProvided(data, "dataNascimento", payload.dataNascimento != null ? parseDate(payload.dataNascimento) : undefined);
    setIfProvided(data, "situacaoCadastral", nullIfEmpty(payload.situacaoCadastral));
    setIfProvided(data, "situacaoMotivo", nullIfEmpty(payload.situacaoMotivo));
    setIfProvided(data, "rg", nullIfEmpty(payload.rg));
    if (payload.optanteSimples != null) setIfProvided(data, "optanteSimples", parseBool(payload.optanteSimples));
    if (payload.mei != null) setIfProvided(data, "mei", parseBool(payload.mei));
    if (payload.empresaPublica != null) setIfProvided(data, "empresaPublica", parseBool(payload.empresaPublica));
    if (payload.filial != null) setIfProvided(data, "filial", parseBool(payload.filial));
    if (payload.matriz != null) setIfProvided(data, "matriz", parseBool(payload.matriz));
    setIfProvided(data, "regimeTributario", nullIfEmpty(payload.regimeTributario));
    setIfProvided(data, "crt", nullIfEmpty(payload.crt));
    setIfProvided(data, "indicadorIe", nullIfEmpty(payload.indicadorIe));
    setIfProvided(data, "inscricaoEstadual", nullIfEmpty(payload.inscricaoEstadual));
    setIfProvided(data, "ieStatus", nullIfEmpty(payload.ieStatus));
    setIfProvided(data, "inscricaoMunicipal", nullIfEmpty(payload.inscricaoMunicipal));
    setIfProvided(data, "imStatus", nullIfEmpty(payload.imStatus));
    setIfProvided(data, "tipoContribuinte", nullIfEmpty(payload.tipoContribuinte));
    if (payload.contribuinteIcms != null) setIfProvided(data, "contribuinteIcms", parseBool(payload.contribuinteIcms));
    if (payload.contribuinteIss != null) setIfProvided(data, "contribuinteIss", parseBool(payload.contribuinteIss));
    if (payload.substituicaoTributaria != null) setIfProvided(data, "substituicaoTributaria", parseBool(payload.substituicaoTributaria));
    setIfProvided(data, "retencoes", payload.retencoes != null ? parseJson(payload.retencoes) : undefined);
    setIfProvided(data, "cnae", nullIfEmpty(payload.cnae));
    setIfProvided(data, "atividadeEconomica", nullIfEmpty(payload.atividadeEconomica));
    setIfProvided(data, "cnaeSecundarios", payload.cnaeSecundarios != null ? parseJson(payload.cnaeSecundarios) : undefined);
    setIfProvided(data, "riscoFiscalCnae", nullIfEmpty(payload.riscoFiscalCnae));
    setIfProvided(data, "cep", nullIfEmpty(payload.cep) ? String(payload.cep).replace(/\D/g, "") : undefined);
    setIfProvided(data, "logradouro", nullIfEmpty(payload.logradouro));
    setIfProvided(data, "numero", nullIfEmpty(payload.numero));
    setIfProvided(data, "complemento", nullIfEmpty(payload.complemento));
    setIfProvided(data, "bairro", nullIfEmpty(payload.bairro));
    setIfProvided(data, "municipio", nullIfEmpty(payload.municipio || payload.cidade));
    setIfProvided(data, "uf", nullIfEmpty(payload.uf));
    setIfProvided(data, "codigoIbge", nullIfEmpty(payload.codigoIbge));
    setIfProvided(data, "codigoUfIbge", nullIfEmpty(payload.codigoUfIbge));
    setIfProvided(data, "pais", nullIfEmpty(payload.pais));
    if (payload.latitude != null) setIfProvided(data, "latitude", parseNum(payload.latitude));
    if (payload.longitude != null) setIfProvided(data, "longitude", parseNum(payload.longitude));
    setIfProvided(data, "telefone", nullIfEmpty(payload.telefone) ? String(payload.telefone).replace(/\D/g, "") : undefined);
    setIfProvided(data, "whatsapp", nullIfEmpty(payload.whatsapp));
    setIfProvided(data, "email", nullIfEmpty(payload.email));
    setIfProvided(data, "site", nullIfEmpty(payload.site));
    setIfProvided(data, "contatoFinanceiro", nullIfEmpty(payload.contatoFinanceiro));
    setIfProvided(data, "contatoFiscal", nullIfEmpty(payload.contatoFiscal));
    setIfProvided(data, "observacoes", nullIfEmpty(payload.observacoes));
    setIfProvided(data, "fonteDados", nullIfEmpty(payload.fonteDados));
    setIfProvided(data, "dadosOriginaisJson", payload.dadosOriginaisJson != null ? parseJson(payload.dadosOriginaisJson) : undefined);
    setIfProvided(data, "alertasJson", payload.alertasJson != null ? parseJson(payload.alertasJson) : undefined);
    setIfProvided(data, "historicoJson", payload.historicoJson != null ? parseJson(payload.historicoJson) : undefined);
    setIfProvided(data, "fiscalAi", payload.fiscalAi != null ? parseJson(payload.fiscalAi) : undefined);
    if (payload.scoreCadastro != null) setIfProvided(data, "scoreCadastro", parseNum(payload.scoreCadastro) != null ? Math.round(Number(payload.scoreCadastro)) : undefined);
    setIfProvided(data, "scoreDetalhes", payload.scoreDetalhes != null ? parseJson(payload.scoreDetalhes) : undefined);
    setIfProvided(data, "reformaPrep", payload.reformaPrep != null ? parseJson(payload.reformaPrep) : undefined);
    if (payload.validadoPorIa != null) setIfProvided(data, "validadoPorIa", parseBool(payload.validadoPorIa) ?? false);
    setIfProvided(data, "ultimaConsulta", payload.ultimaConsulta != null ? parseDate(payload.ultimaConsulta) : undefined);

    try {
      const cleanData = stripUnknownFields(data);
      const updated = await prisma.client.update({ where: { id: existing.id }, data: cleanData });
      sendSuccess(response, updated);
    } catch (error) {
      if (error.code === "P2002") {
        const target = error.meta?.target || [];
        throw new AppError(`Dados duplicados: ${target.join(", ")}`, "DUPLICATE", 409);
      }
      throw new AppError("Erro ao atualizar cliente. Verifique os dados.", "UPDATE_FAILED", 400, [{ field: "general", message: error.message || "Erro desconhecido" }]);
    }
  });

clientesRouter.put("/:id", updateClientHandler);
clientesRouter.patch("/:id", updateClientHandler);

clientesRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const existing = await prisma.client.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!existing) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);
    await prisma.client.delete({ where: { id: existing.id } });
    sendSuccess(response, { message: "Cliente removido com sucesso." });
  }),
);

function normalizePorte(raw) {
  if (!raw) return null;
  const v = String(raw).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (!v) return null;
  if (v.includes("MEI")) return "MEI";
  if (v.includes("MICRO") || v === "ME") return "ME";
  if (v.includes("PEQUENO") || v === "EPP") return "EPP";
  if (v.includes("DEMAIS")) return "DEMAIS";
  return raw;
}

function porteIsValid(raw) {
  if (!raw) return false;
  const normalized = normalizePorte(raw);
  if (!normalized) return false;
  const valid = ["ME", "EPP", "ME/EPP", "MEI", "DEMAIS"];
  return valid.includes(normalized);
}

function makeSmartError(campo, titulo, explicacao, impacto, regraUtilizada, correcaoSugerida, confianca, tipo, acoes) {
  return {
    id: `${tipo}_${campo}_${regraUtilizada}`,
    campo,
    titulo,
    explicacao,
    impacto,
    regraUtilizada,
    correcaoSugerida,
    confianca,
    tipo,
    acoes: (acoes || []).map((a) => {
      if (typeof a === "string") return { label: a, acao: a.toUpperCase().replace(/\s+/g, "_") };
      return a;
    }),
    corrigido: false,
  };
}

function calcScore(cliente) {
  const tipo = (cliente.tipoPessoa || "").toUpperCase();
  const isPJ = tipo === "PJ";
  const isPF = tipo === "PF";

  const cidade = cliente.cidade || cliente.municipio || null;

  let cadastrais = 100;
  if (isPJ) {
    if (!cliente.razaoSocial) cadastrais -= 10;
    if (!cliente.cnpj) cadastrais -= 15;
    if (!cliente.situacaoCadastral) cadastrais -= 10;
    if (!cliente.naturezaJuridica) cadastrais -= 5;
    if (!cliente.porte) cadastrais -= 5;
    if (!cliente.dataAbertura) cadastrais -= 5;
    if (!cliente.nomeFantasia) cadastrais -= 5;
    const situacao = String(cliente.situacaoCadastral || "").toUpperCase();
    if (situacao && ["BAIXADA", "SUSPENSA", "NULA"].includes(situacao)) cadastrais -= 25;
  } else {
    if (!cliente.nome) cadastrais -= 20;
    if (!cliente.cpf) cadastrais -= 20;
    if (!cliente.situacaoCadastral) cadastrais -= 20;
  }

  let fiscais = 100;
  if (!cliente.regimeTributario || cliente.regimeTributario === "PENDENTE_CONFIRMACAO") fiscais -= 8;
  if (!cliente.cnae) fiscais -= 15;
  if (isPJ && !cliente.crt) fiscais -= 8;
  if (isPJ && !cliente.indicadorIe) fiscais -= 10;
  if (isPJ && cliente.contribuinteIcms && !cliente.inscricaoEstadual) fiscais -= 15;
  if (isPJ && !cliente.tipoContribuinte) fiscais -= 10;

  let endereco = 100;
  if (!cliente.cep) endereco -= 12;
  if (!cliente.logradouro) endereco -= 12;
  if (!cliente.bairro) endereco -= 12;
  if (!cidade) endereco -= 12;
  if (!cliente.uf) endereco -= 12;
  if (!cliente.numero) endereco -= 10;
  if (!cliente.codigoIbge) endereco -= 10;
  if (!cliente.pais) endereco -= 10;

  let contato = 100;
  if (!cliente.email) contato -= 20;
  if (!cliente.telefone) contato -= 20;
  if (isPJ && !cliente.site) contato -= 5;
  if (isPJ && !cliente.whatsapp) contato -= 5;

  let sped = 100;
  if (isPJ) {
    if (!cliente.inscricaoEstadual) sped -= 15;
    if (!cliente.crt) sped -= 15;
    if (!cliente.indicadorIe) sped -= 15;
    if (!cliente.codigoIbge) sped -= 10;
  }

  let nfse = 100;
  if (isPJ) {
    if (!cliente.inscricaoMunicipal) nfse -= 20;
    if (!cliente.contribuinteIss) nfse -= 15;
    if (!cliente.codigoIbge) nfse -= 10;
  }

  const scores = { cadastrais, fiscais, endereco, contato, sped, nfse };
  const values = Object.values(scores);
  const overall = Math.min(100, Math.max(0, Math.round(values.reduce((a, b) => a + b, 0) / values.length)));
  return { overall, detalhes: scores };
}

function buildSavedClientValidation(cliente) {
  const draft = { ...cliente };
  if (!draft.cidade && draft.municipio) draft.cidade = draft.municipio;
  if (!draft.municipio && draft.cidade) draft.municipio = draft.cidade;

  const validation = validarClienteParaEmissao(draft);
  const pendencias = (validation.erros || []).map((err) =>
    makeSmartError(
      err.campo,
      err.problema,
      err.problema,
      err.impacto,
      "VALIDACAO_LOCAL",
      err.correcaoSugerida,
      "ALTA",
      "ERRO",
      err.acoes,
    ),
  );
  const alertas = (validation.alertas || []).map((alert) =>
    makeSmartError(
      alert.campo,
      alert.problema,
      alert.problema,
      alert.impacto,
      "VALIDACAO_LOCAL",
      alert.correcaoSugerida,
      "MEDIA",
      "ALERTA",
      alert.acoes,
    ),
  );
  const { overall, detalhes } = calcScore(draft);
  const status = pendencias.length > 0
    ? "blocked"
    : alertas.length > 0
      ? "attention"
      : "ready";
  const sugestoesCorrecao = [...pendencias, ...alertas]
    .map((issue) => issue.correcaoSugerida)
    .filter(Boolean);
  const isPessoaJuridica = draft.tipoPessoa === "PJ";
  const necessitaIe = isPessoaJuridica && Boolean(draft.contribuinteIcms) && !draft.inscricaoEstadual;
  const necessitaIm = isPessoaJuridica && Boolean(draft.contribuinteIss) && !draft.inscricaoMunicipal;
  return {
    success: true,
    status,
    podeEmitir: status !== "blocked",
    normalizacoes: {},
    pendencias,
    alertas,
    dicas: [],
    sugestoesCorrecao,
    validadoPorIa: false,
    mensagem: status === "ready"
      ? "Cliente apto para operação fiscal."
      : "Cliente validado com pendências fiscais ou cadastrais.",
    scoreCadastro: overall,
    scoreDetalhes: detalhes,
    podeEmitirNfe: status !== "blocked" && isPessoaJuridica,
    podeEmitirNfse: status !== "blocked" && Boolean(draft.inscricaoMunicipal),
    podeEmitirNfce: status !== "blocked" && isPessoaJuridica,
    podeReceberCte: status !== "blocked" && isPessoaJuridica,
    necessitaIe,
    necessitaIm,
    necessitaContador: status === "blocked",
    necessitaCertificado: isPessoaJuridica,
    necessitaCadastroComplementar: status !== "ready",
  };
}

clientesRouter.post(
  "/:id/validate",
  asyncHandler(async (request, response) => {
    const client = await prisma.client.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!client) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);
    const validation = buildSavedClientValidation(client);
    const updated = await prisma.client.update({
      where: { id: client.id },
      data: {
        fiscalAi: validation,
        scoreCadastro: validation.scoreCadastro,
        scoreDetalhes: validation.scoreDetalhes,
        validadoPorIa: false,
      },
    });
    sendSuccess(response, { ...validation, client: updated });
  }),
);

clientesRouter.post(
  "/:id/auto-fix",
  asyncHandler(async (request, response) => {
    const client = await prisma.client.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!client) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);

    const data = {};
    const corrections = [];
    const setCorrection = (field, value, label) => {
      if (value === undefined || value === client[field]) return;
      data[field] = value;
      corrections.push({
        field,
        label,
        previous: client[field] ?? null,
        next: value ?? null,
      });
    };

    if (client.uf) setCorrection("uf", String(client.uf).toUpperCase(), "Normalizar UF");
    if (client.cnpj) setCorrection("cnpj", normalizeCnpj(client.cnpj), "Formatar CNPJ");
    if (client.cpf) setCorrection("cpf", normalizeCpf(client.cpf), "Formatar CPF");
    if (client.cep) setCorrection("cep", String(client.cep).replace(/\D/g, ""), "Formatar CEP");
    if (client.telefone) setCorrection("telefone", String(client.telefone).replace(/\D/g, ""), "Normalizar telefone");
    if (client.whatsapp) setCorrection("whatsapp", String(client.whatsapp).replace(/\D/g, ""), "Normalizar WhatsApp");
    if (!client.pais) setCorrection("pais", "BRASIL", "Preencher país padrão");
    if (client.inscricaoEstadual && client.indicadorIe !== "1") {
      setCorrection("indicadorIe", "1", "Ajustar indicador IE para contribuinte");
      setCorrection("tipoContribuinte", "Contribuinte ICMS", "Ajustar tipo de contribuinte");
      setCorrection("contribuinteIcms", true, "Marcar contribuinte ICMS");
    }
    if (!client.inscricaoEstadual && client.indicadorIe !== "9") {
      setCorrection("indicadorIe", "9", "Ajustar indicador IE para não contribuinte");
      setCorrection("contribuinteIcms", false, "Desmarcar contribuinte ICMS");
    }
    if (client.mei === true && client.crt !== "4") {
      setCorrection("crt", "4", "Ajustar CRT para MEI");
      setCorrection("regimeTributario", "MEI", "Ajustar regime para MEI");
    }

    if (corrections.length === 0) {
      sendSuccess(response, {
        corrected: false,
        corrections,
        client,
        validation: buildSavedClientValidation(client),
      });
      return;
    }

    const historico = Array.isArray(client.historicoJson) ? client.historicoJson : [];
    const updated = await prisma.client.update({
      where: { id: client.id },
      data: {
        ...data,
        historicoJson: [
          ...historico,
          ...corrections.map((correction) => ({
            quem: "FiscalAI",
            quando: new Date().toISOString(),
            campo: correction.label,
            valorAnterior: correction.previous == null ? null : String(correction.previous),
            valorNovo: correction.next == null ? null : String(correction.next),
            origem: "FISCAL_AI",
          })),
        ],
      },
    });

    sendSuccess(response, {
      corrected: true,
      corrections,
      client: updated,
      validation: buildSavedClientValidation(updated),
    });
  }),
);

clientesRouter.get(
  "/:id/documents",
  asyncHandler(async (request, response) => {
    const client = await prisma.client.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!client) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);

    const document = client.cnpj || client.cpf || null;
    if (!document || document.length !== 14) {
      sendSuccess(response, { data: [], total: 0 });
      return;
    }

    const items = await prisma.fiscalDocument.findMany({
      where: {
        companyId: request.company.id,
        OR: [
          { recipientCnpj: document },
          { issuerCnpj: document },
        ],
      },
      select: {
        id: true,
        documentType: true,
        invoiceNumber: true,
        series: true,
        accessKey: true,
        status: true,
        issuerName: true,
        issuerCnpj: true,
        recipientName: true,
        recipientCnpj: true,
        emissionDate: true,
        totalAmount: true,
        createdAt: true,
      },
      orderBy: { emissionDate: "desc" },
      take: 100,
    });

    sendSuccess(response, {
      data: items.map((item) => ({
        ...item,
        totalAmount: item.totalAmount == null ? null : Number(item.totalAmount),
      })),
      total: items.length,
    });
  }),
);

clientesRouter.post(
  "/validar-ia",
  asyncHandler(async (request, response) => {
    const cliente = request.body || {};
    if (!cliente.cidade && cliente.municipio) cliente.cidade = cliente.municipio;
    if (!cliente.municipio && cliente.cidade) cliente.municipio = cliente.cidade;
    const tipo = (cliente.tipoPessoa || "").toUpperCase();
    const isPJ = tipo === "PJ";
    const isPF = tipo === "PF";

    const validation = validarClienteParaEmissao(cliente);
    const smartErros = [];
    const smartAlertas = [];
    const smartDicas = [];

    for (const err of validation.erros || []) {
      smartErros.push(
        makeSmartError(
          err.campo,
          err.problema,
          err.problema,
          err.impacto,
          "VALIDACAO_LOCAL",
          err.correcaoSugerida,
          "ALTA",
          "ERRO",
          err.acoes,
        ),
      );
    }

    for (const alert of validation.alertas || []) {
      smartAlertas.push(
        makeSmartError(
          alert.campo,
          alert.problema,
          alert.problema,
          alert.impacto,
          "VALIDACAO_LOCAL",
          alert.correcaoSugerida,
          "MEDIA",
          "ALERTA",
          alert.acoes,
        ),
      );
    }

    const situacao = String(cliente.situacaoCadastral || "").toUpperCase();
    if (isPJ && situacao && ["BAIXADA", "SUSPENSA", "NULA"].includes(situacao)) {
      smartErros.push(
        makeSmartError(
          "situacaoCadastral",
          "Situação cadastral inválida para emissão",
          "A situação cadastral do CNPJ indica que a empresa está " + cliente.situacaoCadastral,
          "Impossível emitir documentos fiscais para empresa com cadastro inativo, suspenso ou baixado",
          "RECEITA_FEDERAL_SITUACAO",
          "Regularize a situação cadastral junto à Receita Federal",
          "ALTA",
          "ERRO",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && situacao === "INAPTA") {
      smartAlertas.push(
        makeSmartError(
          "situacaoCadastral",
          "Empresa inapta",
          "A Receita Federal classificou esta empresa como inapta",
          "Empresa inapta pode ter restrições para emitir documentos fiscais e participar de licitações",
          "RECEITA_FEDERAL_INAPTA",
          "Verifique o motivo da inaptidão e regularize junto à Receita Federal",
          "ALTA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.cnpj && !isValidCnpj(String(cliente.cnpj).replace(/\D/g, ""))) {
      smartErros.push(
        makeSmartError(
          "cnpj",
          "CNPJ com formato inválido",
          "O CNPJ informado não possui um formato válido de 14 dígitos",
          "Rejeição garantida na emissão de documentos fiscais",
          "VALIDACAO_FORMATO_CNPJ",
          "Corrija o CNPJ com os 14 dígitos numéricos válidos",
          "ALTA",
          "ERRO",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPF && cliente.cpf && !isValidCpf(String(cliente.cpf).replace(/\D/g, ""))) {
      smartErros.push(
        makeSmartError(
          "cpf",
          "CPF com formato inválido",
          "O CPF informado não possui um formato válido de 11 dígitos",
          "Rejeição garantida na emissão de documentos fiscais",
          "VALIDACAO_FORMATO_CPF",
          "Corrija o CPF com os 11 dígitos numéricos válidos",
          "ALTA",
          "ERRO",
          ["Editar cadastro"],
        ),
      );
    }

    if (cliente.cep) {
      const cepDigits = String(cliente.cep).replace(/\D/g, "");
      if (cepDigits.length !== 8) {
        smartAlertas.push(
          makeSmartError(
            "cep",
            "CEP com formato inválido",
            "O CEP deve conter 8 dígitos numéricos",
            "Endereço pode ser rejeitado ou complementado incorretamente",
            "VALIDACAO_FORMATO_CEP",
            "Informe o CEP com 8 dígitos",
            "MEDIA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (cliente.uf) {
      const uf = String(cliente.uf);
      if (!/^[A-Z]{2}$/.test(uf)) {
        smartAlertas.push(
          makeSmartError(
            "uf",
            "UF com formato inválido",
            "A UF deve conter 2 letras maiúsculas",
            "Rejeição possível na emissão de documentos fiscais",
            "VALIDACAO_FORMATO_UF",
            "Informe a UF com 2 letras maiúsculas (ex: SP)",
            "MEDIA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (cliente.email) {
      const email = String(cliente.email);
      if (!email.includes("@") || !email.includes(".")) {
        smartAlertas.push(
          makeSmartError(
            "email",
            "Email com formato inválido",
            "O email informado não parece ter um formato válido",
            "Comunicação com o cliente pode falhar",
            "VALIDACAO_FORMATO_EMAIL",
            "Informe um email válido (ex: cliente@empresa.com)",
            "BAIXA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (cliente.telefone) {
      const telDigits = String(cliente.telefone).replace(/\D/g, "");
      if (telDigits.length > 0 && (telDigits.length < 8 || telDigits.length > 11)) {
        smartAlertas.push(
          makeSmartError(
            "telefone",
            "Telefone com formato inválido",
            "O telefone deve ter entre 8 e 11 dígitos",
            "Contato com o cliente pode falhar",
            "VALIDACAO_FORMATO_TELEFONE",
            "Informe o telefone com DDD (ex: 61999999999)",
            "BAIXA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      } else if (telDigits.length === 8 || telDigits.length === 9) {
        smartDicas.push(
          makeSmartError(
            "telefone",
            "Telefone sem DDD",
            `Número local (${telDigits}) sem DDD — confirme o DDD antes de salvar`,
            "Telefone sem DDD pode não ser alcançável",
            "VALIDACAO_TELEFONE_SEM_DDD",
            `Adicione o DDD antes do número ${telDigits}`,
            "INFORMATIVO",
            "DICA",
            ["Editar cadastro"],
          ),
        );
      }
    } else if (!cliente.email) {
      smartAlertas.push(
        makeSmartError(
          "contato",
          "Nenhum telefone ou email informado",
          "A empresa não possui telefone nem email cadastrado",
          "Comunicação impossibilitada",
          "CONTATO_AUSENTE",
          "Informe ao menos telefone ou email",
          "BAIXA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    } else {
      smartAlertas.push(
        makeSmartError(
          "telefone",
          "Telefone não informado",
          "Nenhum telefone cadastrado para este cliente",
          "Contato com o cliente pode falhar",
          "REQUISITO_TELEFONE",
          "Informe um telefone com DDD",
          "BAIXA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !cliente.cnae) {
      const alreadyHasCnaeAlert = smartAlertas.some((a) => a.campo === "cnae");
      if (!alreadyHasCnaeAlert) {
        smartAlertas.push(
          makeSmartError(
            "cnae",
            "CNAE não informado",
            "O CNAE principal é necessário para classificação fiscal correta",
            "Classificação fiscal incompleta pode gerar tributação incorreta",
            "REQUISITO_CNAE",
            "Informe o CNAE principal da empresa",
            "MEDIA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (isPJ && !cliente.regimeTributario || cliente.regimeTributario === "PENDENTE_CONFIRMACAO") {
      const alreadyHasRegimeAlert = smartAlertas.some((a) => a.campo === "regimeTributario");
      const alreadyHasRegimeDica = smartDicas.some((d) => d.campo === "regimeTributario");
      if (!alreadyHasRegimeAlert && !alreadyHasRegimeDica) {
        smartDicas.push(
          makeSmartError(
            "regimeTributario",
            "Regime tributário exige confirmação",
            "Não foi possível confirmar o regime tributário pela fonte pública",
            "Cálculos fiscais podem ficar incorretos",
            "REGIME_PENDENTE_CONFIRMACAO",
            "Confirme o regime tributário manualmente",
            "INFORMATIVO",
            "DICA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (isPJ && !cliente.crt) {
      const alreadyHasCrtAlert = smartAlertas.some((a) => a.campo === "crt");
      const alreadyHasCrtDica = smartDicas.some((d) => d.campo === "crt");
      if (!alreadyHasCrtAlert && !alreadyHasCrtDica) {
        smartDicas.push(
          makeSmartError(
            "crt",
            "CRT não informado — confirme manualmente",
            "O Código de Regime Tributário será obrigatório para emissão de NF-e",
            "Rejeição possível na emissão de documentos fiscais",
            "REQUISITO_CRT_PJ",
            "Informe o CRT (1=Simples, 2=Simples excesso, 3=Regime Normal, 4=MEI)",
            "INFORMATIVO",
            "DICA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (isPJ && cliente.optanteSimples === false && cliente.crt && (cliente.crt === "1" || cliente.crt === "2")) {
      smartDicas.push(
        makeSmartError(
          "crt",
          "CRT incompatível com não-optante pelo Simples",
          "Empresa não optante pelo Simples Nacional não pode ter CRT 1 ou 2",
          "CRT será rejeitado na emissão de NF-e",
          "CRT_SIMPLICES_INCOMPATIVEL",
          "Altere o CRT para 3 (Regime Normal) ou 4 (MEI)",
          "MEDIA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.inscricaoEstadual && cliente.indicadorIe === "9") {
      cliente.indicadorIe = "1";
      cliente.tipoContribuinte = "Contribuinte ICMS";
      cliente.contribuinteIcms = true;
      smartDicas.push(
        makeSmartError(
          "indicadorIe",
          "Indicador IE ajustado automaticamente",
          "IE preenchida exige indicador = 1. Ajustado automaticamente.",
          "Indicador corrigido para Contribuinte",
          "IE_AUTO_DERIVE",
          "Indicador IE definido como 1",
          "INFORMATIVO",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.mei === true && cliente.crt !== "4") {
      cliente.crt = "4";
      smartDicas.push(
        makeSmartError(
          "crt",
          "CRT ajustado automaticamente para MEI",
          "MEI exige CRT = 4. Ajustado automaticamente.",
          "CRT corrigido para Simei",
          "CRT_MEI_AUTO",
          "CRT definido como 4",
          "INFORMATIVO",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !cliente.inscricaoEstadual && cliente.indicadorIe === "1") {
      smartDicas.push(
        makeSmartError(
          "indicadorIe",
          "Indicador IE sem IE informada",
          "O Indicador IE indica Contribuinte mas não há Inscrição Estadual informada",
          "Sem impacto se a IE ainda será buscada",
          "IE_INDICADOR_SEM_IE",
          "Informe a IE ou altere o Indicador IE para 9 (Não contribuinte)",
          "BAIXA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.capitalSocial != null) {
      const capital = Number(String(cliente.capitalSocial).replace(/[^\d.,]/g, "").replace(",", "."));
      if (capital === 0) {
        smartDicas.push(
          makeSmartError(
            "capitalSocial",
            "Capital social não informado pela fonte",
            "Valor zerado retornado pela fonte pública",
            "Sem impacto fiscal direto",
            "CAPITAL_SOCIAL_ZERADO",
            "Informe o capital social se disponível",
            "INFORMATIVO",
            "DICA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (isPJ && !cliente.naturezaJuridica) {
      smartDicas.push(
        makeSmartError(
          "naturezaJuridica",
          "Natureza jurídica não informada pela fonte",
          "A natureza jurídica é importante para classificação fiscal e tributária",
          "Classificação tributária pode ficar incorreta",
          "REQUISITO_NATUREZA_JURIDICA",
          "Informe a natureza jurídica da empresa se disponível",
          "BAIXA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !porteIsValid(cliente.porte)) {
      smartDicas.push(
        makeSmartError(
          "porte",
          "Porte não retornado pela fonte pública",
          "O porte da empresa não foi informado pela fonte consultada",
          "Sem impacto fiscal direto — não bloqueia salvamento",
          "PORTE_FONTE_AUSENTE",
          "Informe o porte manualmente se disponível (ME, EPP, MEI, DEMAIS)",
          "INFORMATIVO",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !cliente.bairro) {
      smartDicas.push(
        makeSmartError(
          "bairro",
          "Bairro não informado pela fonte",
          "O bairro é parte do endereço completo para emissão fiscal",
          "Dado ausente na fonte pública",
          "ENDERECO_BAIRRO_AUSENTE",
          "Informe o bairro ou refaça a busca com CEP",
          "BAIXA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !cliente.codigoIbge && cliente.municipio) {
      smartAlertas.push(
        makeSmartError(
          "codigoIbge",
          "Código IBGE do município ausente",
          "O código IBGE é obrigatório para emissão de NF-e e NFS-e",
          "Rejeição garantida na emissão de documentos fiscais",
          "REQUISITO_CODIGO_IBGE",
          "Refazer a busca com CEP para obter o código IBGE automaticamente",
          "ALTA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (!cliente.pais) {
      smartAlertas.push(
        makeSmartError(
          "pais",
          "País não informado",
          "O país é necessário para endereçamento fiscal completo",
          "Endereço incompleto",
          "REQUISITO_PAIS",
          "Para empresas brasileiras, informar BRASIL",
          "BAIXA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.cnaeSecundarios && Array.isArray(cliente.cnaeSecundarios) && cliente.cnaeSecundarios.length === 0) {
      smartDicas.push(
        makeSmartError(
          "cnaeSecundarios",
          "Empresa sem CNAEs secundários registrados",
          "Muitas empresas não possuem CNAEs secundários — normal se atividade é única",
          "Sem impacto fiscal direto",
          "CNAE_SECUNDARIO_VAZIO",
          "Normal se a empresa tem atividade única",
          "INFORMATIVO",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.contribuinteIss && !cliente.inscricaoMunicipal) {
      smartAlertas.push(
        makeSmartError(
          "inscricaoMunicipal",
          "Inscrição Municipal ausente para contribuinte de ISS",
          "Empresas contribuintes de ISS devem possuir Inscrição Municipal",
          "Impossível emitir NFS-e sem Inscrição Municipal",
          "REQUISITO_IM_CONTRIBUINTE_ISS",
          "Informe a Inscrição Municipal ou desmarque contribuinte ISS",
          "ALTA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    const allIssues = [...smartErros, ...smartAlertas];
    const hasCriticalOrHigh = allIssues.some(
      (i) => i.tipo === "ERRO" || i.confianca === "ALTA",
    );

    const cidade = cliente.cidade || cliente.municipio || null;
    const podeEmitirNfe = isPJ
      ? Boolean(cliente.cnpj && cliente.razaoSocial && cliente.uf && cidade)
      : false;
    const podeEmitirNfce = podeEmitirNfe;
    const podeEmitirNfse = cliente.inscricaoMunicipal
      ? true
      : (isPF && Boolean(cliente.inscricaoMunicipal));
    const podeReceberCte = isPJ ? true : false;
    const necessitaIe = isPJ && Boolean(cliente.contribuinteIcms);
    const necessitaIm = isPJ && Boolean(cliente.contribuinteIss);
    const necessitaCertificado = isPJ;
    const necessitaContador = hasCriticalOrHigh;
    const necessitaCadastroComplementar = necessitaIm && !cliente.inscricaoMunicipal;

    const { overall, detalhes } = calcScore(cliente);

    const result = {
      success: true,
      normalizacoes: {},
      alertas: smartAlertas,
      pendencias: smartErros,
      dicas: smartDicas,
      sugestoesCorrecao: allIssues.map((i) => i.correcaoSugerida),
      validadoPorIa: false,
      mensagem: "IA não configurada. Validação local executada.",
      erros: smartErros,
      podeEmitirNfe,
      podeEmitirNfse,
      podeEmitirNfce,
      podeReceberCte,
      necessitaIe,
      necessitaIm,
      necessitaContador,
      necessitaCertificado,
      necessitaCadastroComplementar,
      scoreCadastro: overall,
      scoreDetalhes: detalhes,
    };
    sendSuccess(response, result);
  }),
);

customersRouter.use(clientesRouter);
