import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { isValidCnpj, normalizeCnpj } from "../../utils/cnpj.js";
import { normalizeCpf, isValidCpf } from "../../utils/cpf.js";
import {
  lookupCompanyFiscalData,
  lookupViaCep,
  resolveIbgeCode,
  ensureCodigoUfIbgeColumn,
  UF_IBGE,
} from "../../services/cnpj-lookup.service.js";
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
  if (mei) return "4";
  if (optanteSimples) return "1";
  return "3";
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
      const data = await lookupCompanyFiscalData(digits);
      const emp = data.empresa || {};
      const ie = data.inscricaoEstadual || {};
      const fiscal = data.fiscal || {};
      const ieFound = Boolean(ie.numero);

      let codigoIbge = null;
      let ddd = null;
      const cepDigits = emp.cep ? String(emp.cep).replace(/\D/g, "") : null;

      if (cepDigits && cepDigits.length === 8 && (!emp.endereco || !emp.bairro || !emp.cidade)) {
        const viaCep = await lookupViaCep(cepDigits);
        if (viaCep) {
          if (!emp.endereco) emp.endereco = viaCep.logradouro;
          if (!emp.bairro) emp.bairro = viaCep.bairro;
          if (!emp.complemento) emp.complemento = viaCep.complemento;
          if (!emp.cidade) emp.cidade = viaCep.cidade;
          if (!emp.uf) emp.uf = viaCep.uf;
          if (viaCep.codigoIbge) codigoIbge = viaCep.codigoIbge;
          if (viaCep.ddd) ddd = viaCep.ddd;
        }
      }

      if (!codigoIbge) {
        codigoIbge = await resolveIbgeCode(emp.cidade, emp.uf, cepDigits);
      }

      const codigoUfIbge = emp.uf ? (UF_IBGE[emp.uf] || null) : null;

      const optanteSimples = emp.optanteSimples != null ? emp.optanteSimples : null;
      const mei = emp.mei != null ? emp.mei : null;
      const crt = computeCrt(optanteSimples, mei);
      const indicadorIe = computeIndicadorIe(ie.numero);
      const contribuinteIcms = ieFound ? true : null;
      const contribuinteIssCapable = null;
      const tipoContribuinte = computeTipoContribuinte(contribuinteIcms, contribuinteIssCapable);

      const situacaoMotivo = null;

      const mapped = {
        success: true,
        tipoPessoa: "PJ",
        cnpj: emp.cnpj || digits,
        razaoSocial: emp.razaoSocial || null,
        nomeFantasia: emp.nomeFantasia || null,
        inscricaoEstadual: ie.numero || null,
        inscricaoMunicipal: null,
        regimeTributario: fiscal.regimeTributario || null,
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
        ddd: ddd || null,
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
        situacaoMotivo,
        situacaoData: emp.situacaoCadastralData || null,
        optanteSimples,
        mei,
        empresaPublica: null,
        filial: emp.filial != null ? emp.filial : null,
        matriz: emp.matriz != null ? emp.matriz : null,
        crt,
        indicadorIe,
        ieStatus: ieFound ? "ENCONTRADA" : "NAO_ENCONTRADA",
        imStatus: null,
        tipoContribuinte,
        contribuinteIcms,
        contribuinteIss: null,
        substituicaoTributaria: null,
        whatsapp: null,
        site: null,
        contatoFinanceiro: null,
        contatoFiscal: null,
        cnaeSecundarios: emp.cnaeSecundarios || null,
        riscoFiscalCnae: null,
        atividadesPermitidas: null,
        atividadesIncompativeis: null,
        observacoes: null,
      };

      if (!mapped.inscricaoEstadual) {
        mapped.alertas.push({ code: "IE_NOT_FOUND", message: "IE não encontrada automaticamente. Confirme manualmente antes de emitir NF-e." });
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
      if (!payload.uf || !payload.cidade || !payload.logradouro) {
        throw new AppError("Dados de endereço incompletos.", "ENDERECO_INCOMPLETO", 400);
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

    const data = {
      ...payload,
      cpf: payload.cpf ? String(payload.cpf).replace(/\D/g, "") : null,
      cnpj: payload.cnpj ? String(payload.cnpj).replace(/\D/g, "") : null,
      ownerId: request.user.id,
      dadosOriginaisJson: payload.dadosOriginais || payload.dadosOriginaisJson || null,
      alertasJson: payload.alertas || payload.alertasJson || null,
    };

    delete data.dadosOriginais;
    delete data.alertas;

    const client = await prisma.client.create({ data });
    sendSuccess(response, client, 201);
  }),
);

clientesRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const items = await prisma.client.findMany({ where: { ownerId: request.user.id } });
    sendSuccess(response, { data: items });
  }),
);

clientesRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const client = await prisma.client.findUnique({ where: { id: request.params.id } });
    if (!client) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);
    sendSuccess(response, client);
  }),
);

clientesRouter.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const existing = await prisma.client.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);

    const payload = normalizePayload(request.body || {});
    if (payload.cpf && !isValidCpf(normalizeCpf(payload.cpf))) {
      throw new AppError("CPF inválido.", "INVALID_CPF", 400);
    }
    if (payload.cnpj && !isValidCnpj(normalizeCnpj(payload.cnpj))) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ", 400);
    }

    const data = {
      ...payload,
      cpf: payload.cpf ? String(payload.cpf).replace(/\D/g, "") : existing.cpf,
      cnpj: payload.cnpj ? String(payload.cnpj).replace(/\D/g, "") : existing.cnpj,
    };

    const updated = await prisma.client.update({ where: { id: existing.id }, data });
    sendSuccess(response, updated);
  }),
);

clientesRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const existing = await prisma.client.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);
    await prisma.client.delete({ where: { id: existing.id } });
    sendSuccess(response, { message: "Cliente removido com sucesso." });
  }),
);

function makeSmartError(campo, titulo, explicacao, impacto, regraUtilizada, correcaoSugerida, confianca, tipo, acoes) {
  return {
    id: campo + "_" + String(Date.now()),
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
  if (!cliente.regimeTributario) fiscais -= 15;
  if (!cliente.cnae) fiscais -= 15;
  if (isPJ && !cliente.crt) fiscais -= 15;
  if (isPJ && !cliente.indicadorIe) fiscais -= 10;
  if (isPJ && cliente.contribuinteIcms && !cliente.inscricaoEstadual) fiscais -= 15;
  if (isPJ && !cliente.tipoContribuinte) fiscais -= 10;

  let endereco = 100;
  if (!cliente.cep) endereco -= 12;
  if (!cliente.logradouro) endereco -= 12;
  if (!cliente.bairro) endereco -= 12;
  if (!cliente.cidade) endereco -= 12;
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

clientesRouter.post(
  "/validar-ia",
  asyncHandler(async (request, response) => {
    const cliente = request.body || {};
    const tipo = (cliente.tipoPessoa || "").toUpperCase();
    const isPJ = tipo === "PJ";
    const isPF = tipo === "PF";

    const validation = validarClienteParaEmissao(cliente);
    const smartErros = [];
    const smartAlertas = [];

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
      if (telDigits.length < 10) {
        smartAlertas.push(
          makeSmartError(
            "telefone",
            "Telefone com formato inválido",
            "O telefone deve conter pelo menos 10 dígitos (DDD + número)",
            "Contato com o cliente pode falhar",
            "VALIDACAO_FORMATO_TELEFONE",
            "Informe o telefone com DDD (ex: 11999999999)",
            "BAIXA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      }
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

    if (isPJ && !cliente.regimeTributario) {
      const alreadyHasRegimeAlert = smartAlertas.some((a) => a.campo === "regimeTributario");
      if (!alreadyHasRegimeAlert) {
        smartAlertas.push(
          makeSmartError(
            "regimeTributario",
            "Regime tributário não informado",
            "O regime tributário é necessário para cálculos fiscais",
            "Cálculos de impostos podem ficar incorretos",
            "REQUISITO_REGIME_TRIBUTARIO",
            "Informe o regime tributário (Simples Nacional, Lucro Presumido, Lucro Real)",
            "MEDIA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (isPJ && !cliente.crt) {
      smartAlertas.push(
        makeSmartError(
          "crt",
          "CRT não informado",
          "O Código de Regime Tributário é obrigatório para PJ na emissão de NF-e",
          "Rejeição possível na emissão de documentos fiscais",
          "REQUISITO_CRT_PJ",
          "Informe o CRT (1=Simples, 2=Simples excesso, 3=Regime Normal, 4=MEI)",
          "MEDIA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.crt && cliente.optanteSimples === false && (cliente.crt === "1" || cliente.crt === "2")) {
      smartAlertas.push(
        makeSmartError(
          "crt",
          "CRT incompatível com Simples Nacional",
          "A empresa não é optante pelo Simples mas o CRT indica Simples Nacional",
          "Tributação calculada incorretamente na emissão de NF-e",
          "CRT_SIMPLICES_INCOMPATIVEL",
          "Altere o CRT para 3 (Regime Normal) ou confirme a opção pelo Simples Nacional",
          "ALTA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.mei === true && cliente.crt !== "4") {
      smartAlertas.push(
        makeSmartError(
          "crt",
          "CRT incompatível com MEI",
          "MEI deve ter CRT = 4 (Simei)",
          "Rejeição na emissão de NF-e para MEI com CRT incorreto",
          "CRT_MEI_INCOMPATIVEL",
          "Altere o CRT para 4 (MEI/Simei)",
          "ALTA",
          "ALERTA",
          ["Corrigir automaticamente"],
        ),
      );
    }

    if (isPJ && cliente.inscricaoEstadual && cliente.indicadorIe === "9") {
      smartAlertas.push(
        makeSmartError(
          "indicadorIe",
          "IE inconsistente",
          "A empresa possui Inscrição Estadual mas o indicador IE está como Não Contribuinte",
          "Pode haver rejeição na emissão de NF-e",
          "IE_INDICADOR_INCONSISTENTE",
          "Altere o Indicador IE para 1 (Contribuinte) ou verifique a IE",
          "MEDIA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !cliente.inscricaoEstadual && cliente.indicadorIe === "1") {
      smartAlertas.push(
        makeSmartError(
          "indicadorIe",
          "Indicador IE inconsistente",
          "O Indicador IE indica Contribuinte mas não há Inscrição Estadual informada",
          "Pode haver rejeição na emissão de NF-e",
          "IE_INDICADOR_SEM_IE",
          "Informe a IE ou altere o Indicador IE para 9 (Não contribuinte)",
          "MEDIA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.capitalSocial != null) {
      const capital = Number(String(cliente.capitalSocial).replace(/[^\d.,]/g, "").replace(",", "."));
      if (capital === 0) {
        smartAlertas.push(
          makeSmartError(
            "capitalSocial",
            "Capital social zerado",
            "O capital social está registrado como zero",
            "Pode indicar dado incompleto ou cadastral desatualizado",
            "CAPITAL_SOCIAL_ZERADO",
            "Verifique o capital social junto à Receita Federal",
            "BAIXA",
            "ALERTA",
            ["Editar cadastro"],
          ),
        );
      }
    }

    if (isPJ && !cliente.naturezaJuridica) {
      smartAlertas.push(
        makeSmartError(
          "naturezaJuridica",
          "Natureza jurídica não informada",
          "A natureza jurídica é importante para classificação fiscal e tributária",
          "Classificação tributária pode ficar incorreta",
          "REQUISITO_NATUREZA_JURIDICA",
          "Informe a natureza jurídica da empresa",
          "BAIXA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !cliente.porte) {
      smartAlertas.push(
        makeSmartError(
          "porte",
          "Porte não informado",
          "O porte da empresa é relevante para enquadramento tributário",
          "Benefícios fiscais de microempresa/EPP podem não ser aplicados",
          "REQUISITO_PORTE",
          "Informe o porte da empresa (Microempresa, EPP, Demais)",
          "BAIXA",
          "DICA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && !cliente.bairro) {
      smartAlertas.push(
        makeSmartError(
          "bairro",
          "Bairro não informado",
          "O bairro é parte do endereço completo necessário para emissão fiscal",
          "Endereço incompleto pode gerar rejeição na SEFAZ",
          "ENDERECO_BAIRRO_AUSENTE",
          "Informe o bairro ou refaça a busca com CEP para preenchimento automático",
          "MEDIA",
          "ALERTA",
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

    if (isPJ && !cliente.telefone && !cliente.email) {
      smartAlertas.push(
        makeSmartError(
          "contato",
          "Sem dados de contato",
          "A empresa não possui telefone nem email cadastrado",
          "Comunicação com o cliente impossibilitada",
          "CONTATO_AUSENTE",
          "Informe ao menos telefone ou email de contato",
          "MEDIA",
          "ALERTA",
          ["Editar cadastro"],
        ),
      );
    }

    if (isPJ && cliente.cnaeSecundarios && Array.isArray(cliente.cnaeSecundarios) && cliente.cnaeSecundarios.length === 0) {
      smartAlertas.push(
        makeSmartError(
          "cnaeSecundarios",
          "Sem CNAE secundário",
          "A empresa não possui CNAEs secundários registrados",
          "Atividades secundárias não serão consideradas na classificação fiscal",
          "CNAE_SECUNDARIO_AUSENTE",
          "Verifique os CNAEs secundários e adicione se aplicável",
          "BAIXA",
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

    const podeEmitirNfe = isPJ
      ? Boolean(cliente.cnpj && cliente.razaoSocial && cliente.uf && cliente.cidade)
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
