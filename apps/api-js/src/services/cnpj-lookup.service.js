import pg from "pg";
import { AppError } from "../utils/app-error.js";
import { isValidCnpj, normalizeCnpj } from "../utils/cnpj.js";
import { formatStateRegistration } from "./state-registration-validator.service.js";

const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1";
const CNPJWS_URL = "https://publica.cnpj.ws/cnpj";
const lookupCache = new Map();

const SITUACAO_CADASTRAL_MAP = { 1: "ATIVA", 2: "SUSPENSA", 3: "BAIXADA", 4: "NULA" };
const PORTE_MAP = { 0: null, 1: "ME", 2: "ME/EPP", 3: "EPP", 4: "MEI", 5: "DEMAIS" };
const UF_IBGE = { RO:"11",AC:"12",AM:"13",RR:"14",PA:"15",AP:"16",TO:"17",MA:"21",PI:"22",CE:"23",RN:"24",PB:"25",PE:"26",AL:"27",SE:"28",BA:"29",MG:"31",ES:"32",RJ:"33",SP:"35",PR:"41",SC:"42",RS:"43",MS:"50",MT:"51",GO:"52",DF:"53" };

export { UF_IBGE };

async function fetchWithTimeout(url, timeout = 10_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "NSFiscalCloud/1.0" }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatCnae(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 7) return digits || null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5)}`;
}

function cached(value) {
  const item = lookupCache.get(value);
  if (!item || item.expiresAt < Date.now()) {
    lookupCache.delete(value);
    return null;
  }
  return item.data;
}

function saveCache(value, data) {
  lookupCache.set(value, { data, expiresAt: Date.now() + 5 * 60_000 });
  return data;
}

export async function lookupViaCep(cep) {
  const digits = String(cep).replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const response = await fetchWithTimeout(`https://viacep.com.br/ws/${digits}/json/`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;
    return {
      cep: data.cep?.replace(/\D/g, "") || digits,
      logradouro: data.logradouro || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      cidade: data.localidade || null,
      uf: data.uf || null,
      codigoIbge: data.ibge || null,
      ddd: data.ddd || null,
    };
  } catch {
    return null;
  }
}

export async function resolveIbgeCode(cidade, uf, cep) {
  if (cep) {
    const viaCep = await lookupViaCep(cep);
    if (viaCep?.codigoIbge) return viaCep.codigoIbge;
  }
  const IBGE_MUNICIPIOS = {
    "SAO PAULO_SP": "3550308",
    "RIO DE JANEIRO_RJ": "3304557",
    "BELO HORIZONTE_MG": "3106200",
    "CURITIBA_PR": "4106902",
    "PORTO ALEGRE_RS": "4314902",
    "SALVADOR_BA": "2927408",
    "FORTALEZA_CE": "2304400",
    "BRASILIA_DF": "5300108",
    "MANAUS_AM": "1302603",
    "RECIFE_PE": "2611606",
    "BELEM_PA": "1501402",
    "VITORIA_ES": "3205309",
    "GOIANIA_GO": "5208707",
    "CAMPINAS_SP": "3509502",
    "FLORIANOPOLIS_SC": "4205407",
    "CUIABA_MT": "5103403",
    "CAMPO GRANDE_MS": "5002704",
    "SAO LUIS_MA": "2111300",
    "NATAL_RN": "2408102",
    "TERESINA_PI": "2211001",
    "MACEIO_AL": "2704302",
    "JOAO PESSOA_PB": "2507507",
    "ARACAJU_SE": "2800308",
    "PALMAS_TO": "1721000",
    "PORTO VELHO_RO": "1100205",
    "RIO BRANCO_AC": "1200401",
    "MANAUS_AM": "1302603",
    "BOA VISTA_RR": "1400100",
    "MACAPA_AP": "1600303",
    "RIBEIRAO PRETO_SP": "3543402",
    "UBERLANDIA_MG": "3170206",
    "CONTAGEM_MG": "3118601",
    "SOROCABA_SP": "3552205",
  };
  const estado = (uf || "").toUpperCase();
  const city = (cidade || "").toUpperCase().trim();
  return IBGE_MUNICIPIOS[`${city}_${estado}`] || null;
}

async function lookupCnpjWs(cnpj) {
  const response = await fetchWithTimeout(`${CNPJWS_URL}/${cnpj}`);
  if (response.status === 404) {
    throw new AppError(
      "CNPJ não encontrado na base de dados pública.",
      "CNPJ_NOT_FOUND",
      404,
    );
  }
  if (!response.ok) {
    throw new AppError(
      "Provedor de dados cadastrais indisponível.",
      "CNPJ_PROVIDER_ERROR",
      response.status,
    );
  }
  return response.json();
}

async function lookupBrasilApi(cnpj) {
  const normalized = normalizeCnpj(cnpj);
  const response = await fetchWithTimeout(`${BRASILAPI_URL}/${normalized}`);

  if (response.status === 404) {
    throw new AppError(
      "CNPJ não encontrado na base de dados pública.",
      "CNPJ_NOT_FOUND",
      404,
    );
  }

  if (!response.ok) {
    throw new AppError(
      "Erro ao consultar dados do CNPJ.",
      "CNPJ_LOOKUP_ERROR",
      response.status,
    );
  }

  return response.json();
}

function extractSecundariosCnpjWs(data) {
  const est = data.estabelecimento || {};
  const list = data.cnaes_secundarios || est.atividades_secundarias || [];
  return list.map((c) => ({
    codigo: String(c.id || "").replace(/\D/g, "") || null,
    descricao: c.descricao || null,
  })).filter((c) => c.codigo);
}

function extractSecundariosBrasilApi(data) {
  const list = data.cnaes_secundarias || [];
  return list.map((c) => ({
    codigo: String(c.codigo || "").replace(/\D/g, "") || null,
    descricao: c.descricao || null,
  })).filter((c) => c.codigo);
}

function mapSituacaoCadastral(code) {
  if (code == null) return null;
  return SITUACAO_CADASTRAL_MAP[Number(code)] || null;
}

function mapPorte(code) {
  if (code == null) return null;
  return PORTE_MAP[Number(code)] || null;
}

function buildCnpjWsResult(data, originalCnpj) {
  const est = data.estabelecimento || {};
  const mainCnae = est.atividade_principal || {};
  const uf = est.estado?.sigla || null;
  const registrations = est.inscricoes_estaduais || [];
  const registration =
    registrations.find(
      (item) => item.ativo !== false && (!uf || item.estado?.sigla === uf),
    ) || registrations[0] || null;
  const ieNumber = registration?.inscricao_estadual
    ? String(registration.inscricao_estadual).replace(/\D/g, "")
    : null;

  const simples = data.simples || {};
  const opcaoSimples = simples.opcao_pelo_simples === true ? true : simples.opcao_pelo_simples === false ? false : null;
  const opcaoMei = simples.opcao_pelo_mei === true ? true : simples.opcao_pelo_mei === false ? false : null;
  const tipo = est.tipo != null ? Number(est.tipo) : null;
  const porte = mapPorte(data.porte);
  const natJur = data.natureza_juridica || {};

  const telefone1 = est.telefone1 || null;
  const telefone2 = est.telefone2 || null;
  const email = est.email || null;

  const cepDigits = est.cep ? String(est.cep).replace(/\D/g, "") : null;

  return {
    empresa: {
      cnpj: originalCnpj,
      razaoSocial: data.razao_social || null,
      nomeFantasia: est.nome_fantasia || null,
      endereco: est.endereco || null,
      numero: est.numero || null,
      complemento: est.complemento || null,
      bairro: est.bairro || null,
      cep: cepDigits,
      cidade: est.cidade?.nome || null,
      uf,
      cnaePrincipal: {
        codigo: String(mainCnae.id || "").replace(/\D/g, "") || null,
        codigoFormatado: mainCnae.subclasse || formatCnae(mainCnae.id),
        descricao: mainCnae.descricao || null,
      },
      cnaeSecundarios: extractSecundariosCnpjWs(data),
      inscricaoMunicipal: est.inscricao_municipal || null,
      telefone: telefone1,
      telefone1,
      telefone2,
      email,
      dataAbertura: est.data_inicio_atividade || null,
      situacaoCadastral: mapSituacaoCadastral(est.situacao_cadastral),
      situacaoCadastralData: est.situacao_cadastral_data || null,
      naturezaJuridica: natJur.id && natJur.descricao ? `${natJur.id} - ${natJur.descricao}` : (natJur.descricao || natJur.id || null),
      naturezaJuridicaCodigo: natJur.id || null,
      porte,
      capitalSocial: data.capital_social != null ? String(data.capital_social) : null,
      optanteSimples: opcaoSimples,
      mei: opcaoMei,
      matriz: tipo === 1,
      filial: tipo === 2,
    },
    inscricaoEstadual: {
      numero: ieNumber,
      numeroFormatado: ieNumber
        ? formatStateRegistration(ieNumber, uf) || ieNumber
        : null,
      uf,
      situacao: "PENDENTE_VALIDACAO_SEFAZ",
      fonte: ieNumber ? "BUSCA_AUTOMATICA" : "NAO_ENCONTRADA",
    },
    fiscal: {
      ambiente: "HOMOLOGACAO",
      regimeApuracao: "COMPETENCIA",
      regimeTributario: opcaoSimples ? "Simples Nacional" : null,
      pisCofins: "PENDENTE_CONFIRMACAO",
      contribuinteICMS: ieNumber ? true : "PENDENTE_VALIDACAO_SEFAZ",
      contribuinteIPI: "PENDENTE_CONFIRMACAO",
      anexoSimples: null,
      receitaAcumulada12Meses: null,
    },
  };
}

function buildBrasilApiResult(data) {
  const uf = data.uf || null;
  const opcaoSimples = data.opcao_pelo_simples === true ? true : data.opcao_pelo_simples === false ? false : null;
  const opcaoMei = data.opcao_pelo_mei === true ? true : data.opcao_pelo_mei === false ? false : null;
  const cnaeDigits = String(data.cnae_fiscal || "").replace(/\D/g, "");
  const cepDigits = data.cep ? String(data.cep).replace(/\D/g, "") : null;

  const natJurStr = data.natureza_juridica || "";
  const natJurCodigo = natJurStr.includes(" - ") ? natJurStr.split(" - ")[0].trim() : null;

  return {
    empresa: {
      cnpj: data.cnpj || null,
      razaoSocial: data.razao_social || null,
      nomeFantasia: data.nome_fantasia || null,
      endereco: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      cep: cepDigits,
      cidade: data.municipio || null,
      uf,
      cnaePrincipal: {
        codigo: cnaeDigits || null,
        codigoFormatado: formatCnae(data.cnae_fiscal),
        descricao: data.cnae_fiscal_descricao || null,
      },
      cnaeSecundarios: extractSecundariosBrasilApi(data),
      inscricaoMunicipal: null,
      telefone: data.ddd && data.telefone ? `(${data.ddd})${data.telefone}` : (data.telefone || null),
      telefone1: data.telefone || null,
      telefone2: null,
      email: data.email || null,
      dataAbertura: data.data_inicio_atividade || null,
      situacaoCadastral: data.descricao_situacao_cadastral || mapSituacaoCadastral(data.situacao_cadastral),
      situacaoCadastralData: data.situacao_cadastral_data || null,
      naturezaJuridica: natJurStr || null,
      naturezaJuridicaCodigo: natJurCodigo,
      porte: data.descricao_porte || null,
      capitalSocial: data.capital_social != null ? String(data.capital_social) : null,
      optanteSimples: opcaoSimples,
      mei: opcaoMei,
      matriz: null,
      filial: null,
    },
    inscricaoEstadual: {
      numero: null,
      numeroFormatado: null,
      uf,
      situacao: "PENDENTE_VALIDACAO_SEFAZ",
      fonte: "NAO_ENCONTRADA",
    },
    fiscal: {
      ambiente: "HOMOLOGACAO",
      regimeApuracao: "COMPETENCIA",
      regimeTributario: opcaoSimples ? "Simples Nacional" : null,
      pisCofins: "PENDENTE_CONFIRMACAO",
      contribuinteICMS: "PENDENTE_VALIDACAO_SEFAZ",
      contribuinteIPI: "PENDENTE_CONFIRMACAO",
      anexoSimples: null,
      receitaAcumulada12Meses: null,
    },
  };
}

export async function lookupCompanyFiscalData(cnpj) {
  const normalized = normalizeCnpj(cnpj);
  if (!isValidCnpj(normalized)) {
    throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
  }

  const cachedData = cached(normalized);
  if (cachedData) return cachedData;

  try {
      const data = await lookupCnpjWs(normalized);
      return saveCache(normalized, buildCnpjWsResult(data, normalized));
  } catch (error) {
    if (
      error instanceof AppError &&
      ["CNPJ_NOT_FOUND", "INVALID_CNPJ_FORMAT"].includes(error.code)
    ) {
      throw error;
    }

    try {
      const data = await lookupBrasilApi(normalized);
      return saveCache(normalized, buildBrasilApiResult(data));
    } catch {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Erro ao conectar com base de dados de CNPJ.",
        "CNPJ_SERVICE_ERROR",
        503,
        [{ detail: error.message }]
      );
    }
  }
}

export async function checkSimpleNacional(cnpj) {
  const normalized = normalizeCnpj(cnpj);
  try {
    const data = await lookupCompanyFiscalData(normalized);
    return data.empresa?.optanteSimples === true;
  } catch {
    return null;
  }
}

export async function searchStateRegistration(cnpj, uf) {
  const data = await lookupCompanyFiscalData(cnpj);
  const state = (uf || "").toUpperCase();
  const sameState = !state || data.inscricaoEstadual.uf === state;
  return {
    found: Boolean(data.inscricaoEstadual.numero && sameState),
    inscricaoEstadual: sameState ? data.inscricaoEstadual.numero : null,
    inscricaoEstadualFormatada: sameState
      ? data.inscricaoEstadual.numeroFormatado
      : null,
    ativo: false,
    situacao: data.inscricaoEstadual.situacao,
  };
}

export function resolveSimpleNacionalAnexo(cnaePrincipal) {
  if (!cnaePrincipal) return null;

  const cnae = String(cnaePrincipal).slice(0, 2);

  const anexos = {
    "01": "ANEXO_I",
    "02": "ANEXO_II",
    "03": "ANEXO_III",
    "05": "ANEXO_V",
  };

  return anexos[cnae] || null;
}

export function classifyIPI(cnaePrincipal) {
  if (!cnaePrincipal) return "PENDENTE_CONFIRMACAO";

  const cnae = String(cnaePrincipal).slice(0, 2);
  const industrial = ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"];

  return industrial.includes(cnae) ? "PROVAVEL" : "PENDENTE_CONFIRMACAO";
}

export async function ensureCodigoUfIbgeColumn() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.dcjsxfobvpqtaygafksi:PHFABIAN%40%402008@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  });
  try {
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS codigo_uf_ibge VARCHAR(2)`);
  } finally {
    await pool.end();
  }
}
