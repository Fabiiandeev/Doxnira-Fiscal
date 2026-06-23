import { AppError } from "../utils/app-error.js";
import { isValidCnpj, normalizeCnpj } from "../utils/cnpj.js";
import { formatStateRegistration } from "./state-registration-validator.service.js";

const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1";
const CNPJWS_URL = "https://publica.cnpj.ws/cnpj";
const lookupCache = new Map();

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

export async function lookupCnpj(cnpj) {
  const normalized = normalizeCnpj(cnpj);
  if (!isValidCnpj(normalized)) {
    throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
  }

  try {
    const response = await fetchWithTimeout(`${BRASILAPI_URL}/${normalized}`);
    
    if (response.status === 404) {
      throw new AppError(
        "CNPJ não encontrado na base de dados pública.",
        "CNPJ_NOT_FOUND",
        404
      );
    }
    
    if (!response.ok) {
      throw new AppError(
        "Erro ao consultar dados do CNPJ.",
        "CNPJ_LOOKUP_ERROR",
        response.status
      );
    }

    const data = await response.json();
    return {
      cnpj: normalized,
      legalName: data.razao_social || null,
      tradeName: data.nome_fantasia || null,
      city: data.municipio || null,
      uf: data.uf || null,
      cnaePrincipal: data.cnae_fiscal || null,
      atividadePrincipal: data.cnae_fiscal_descricao || null,
      situacao: data.descricao_situacao_cadastral || null,
      dataAbertura: data.data_inicio_atividade || null,
      naturezaJuridica: data.natureza_juridica || null,
      porte: data.descricao_porte || null,
      endereco: data.logradouro || null,
      rawData: data,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Erro ao conectar com base de dados de CNPJ.",
      "CNPJ_SERVICE_ERROR",
      503,
      [{ detail: error.message }]
    );
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

export async function lookupCompanyFiscalData(cnpj) {
  const normalized = normalizeCnpj(cnpj);
  if (!isValidCnpj(normalized)) {
    throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
  }

  const cachedData = cached(normalized);
  if (cachedData) return cachedData;

  try {
    const data = await lookupCnpjWs(normalized);
    const establishment = data.estabelecimento || {};
    const mainCnae = establishment.atividade_principal || {};
    const uf = establishment.estado?.sigla || null;
    const registrations = establishment.inscricoes_estaduais || [];
    const registration =
      registrations.find(
        (item) => item.ativo !== false && (!uf || item.estado?.sigla === uf),
      ) || registrations[0] || null;
    const ieNumber = registration?.inscricao_estadual
      ? String(registration.inscricao_estadual).replace(/\D/g, "")
      : null;

    return saveCache(normalized, {
      empresa: {
        cnpj: normalized,
        razaoSocial: data.razao_social || null,
        nomeFantasia: establishment.nome_fantasia || null,
        cidade: establishment.cidade?.nome || null,
        uf,
        cnaePrincipal: {
          codigo: String(mainCnae.id || "").replace(/\D/g, "") || null,
          codigoFormatado:
            mainCnae.subclasse || formatCnae(mainCnae.id),
          descricao: mainCnae.descricao || null,
        },
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
        regimeTributario: "PENDENTE_CONFIRMACAO",
        pisCofins: "PENDENTE_CONFIRMACAO",
        contribuinteICMS: "PENDENTE_VALIDACAO_SEFAZ",
        contribuinteIPI: "PENDENTE_CONFIRMACAO",
        anexoSimples: null,
        receitaAcumulada12Meses: null,
      },
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      ["CNPJ_NOT_FOUND", "INVALID_CNPJ_FORMAT"].includes(error.code)
    ) {
      throw error;
    }

    const fallback = await lookupCnpj(normalized);
    return saveCache(normalized, {
      empresa: {
        cnpj: fallback.cnpj,
        razaoSocial: fallback.legalName,
        nomeFantasia: fallback.tradeName,
        cidade: fallback.city,
        uf: fallback.uf,
        cnaePrincipal: {
          codigo: String(fallback.cnaePrincipal || "").replace(/\D/g, "") || null,
          codigoFormatado: formatCnae(fallback.cnaePrincipal),
          descricao: fallback.atividadePrincipal,
        },
      },
      inscricaoEstadual: {
        numero: null,
        numeroFormatado: null,
        uf: fallback.uf,
        situacao: "PENDENTE_VALIDACAO_SEFAZ",
        fonte: "NAO_ENCONTRADA",
      },
      fiscal: {
        ambiente: "HOMOLOGACAO",
        regimeApuracao: "COMPETENCIA",
        regimeTributario: "PENDENTE_CONFIRMACAO",
        pisCofins: "PENDENTE_CONFIRMACAO",
        contribuinteICMS: "PENDENTE_VALIDACAO_SEFAZ",
        contribuinteIPI: "PENDENTE_CONFIRMACAO",
        anexoSimples: null,
        receitaAcumulada12Meses: null,
      },
    });
  }
}

export async function checkSimpleNacional(cnpj) {
  const normalized = normalizeCnpj(cnpj);
  try {
    const data = await lookupCnpj(normalized);
    return data.rawData?.opcao_pelo_simples === true;
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
