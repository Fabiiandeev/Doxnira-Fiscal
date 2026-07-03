import { normalizeCnpj, isValidCnpj } from "../utils/cnpj.js";
import { AppError } from "../utils/app-error.js";
import { lookupViaCep, resolveIbgeCode, UF_IBGE } from "./cnpj-lookup.service.js";
import { formatStateRegistration } from "./state-registration-validator.service.js";
import { getProviders, getIeProvider } from "./providers/index.js";

const CACHE_TTL = 15 * 60_000;
const dataCache = new Map();

const TRUST_WEIGHTS = {
  cnpj_ws: 0.95,
  receitaws: 0.90,
  brasilapi: 0.85,
  cnpj_wsv2: 0.75,
  sintegra_brasilapi: 0.70,
};

const FIELD_COMPARE_NORMALIZE = (v) => {
  if (v == null) return null;
  return String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const FIELDS_TO_MERGE = [
  "razaoSocial", "nomeFantasia", "dataAbertura", "naturezaJuridica",
  "naturezaJuridicaCodigo", "porte", "capitalSocial", "situacaoCadastral",
  "situacaoCadastralData", "situacaoMotivo", "optanteSimples", "mei",
  "matriz", "filial", "dataOpcaoSimples", "dataExclusaoSimples",
  "cnaePrincipal", "cnaeSecundarios",
  "inscricaoEstadual", "inscricaoEstadualFormatada", "ieUf", "ieSituacao",
  "ieFonte", "inscricaoMunicipal",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "codigoIbge", "latitude", "longitude",
  "telefone", "telefone2", "email", "site", "qsa",
];

function cachedResult(key) {
  const item = dataCache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    dataCache.delete(key);
    return null;
  }
  return item.data;
}

function saveCacheResult(key, data) {
  dataCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
  return data;
}

function normalizePhone(val) {
  if (!val) return null;
  const d = String(val).replace(/\D/g, "");
  if (d.length < 8) return null;
  if (d.length === 8) return d;
  if (d.length === 9) return d;
  if (d.length === 10) return `(${d.slice(0, 2)})${d.slice(2)}`;
  if (d.length === 11) return d.startsWith("0") ? `(${d.slice(1, 3)})${d.slice(3)}` : `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length >= 12 && d.length <= 14) {
    const cnpj = d;
    if (cnpj.length === 12) return `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
    return d;
  }
  return d;
}

function normalizeCep(val) {
  if (!val) return null;
  const d = String(val).replace(/\D/g, "");
  return d.length === 8 ? d : d || null;
}

function normalizeUf(val) {
  if (!val) return null;
  const u = String(val).toUpperCase().trim();
  return u.length === 2 ? u : null;
}

function normalizeCity(val) {
  if (!val) return null;
  return String(val).trim().replace(/\s{2,}/g, " ") || null;
}

function normalizeRazaoSocial(val) {
  if (!val) return null;
  return String(val).trim().replace(/\s{2,}/g, " ") || null;
}

function normalizeEmail(val) {
  if (!val) return null;
  const e = String(val).trim().toLowerCase();
  return e.includes("@") ? e : null;
}

function normalizeCnaePrincipal(val) {
  if (!val || !val.codigo) return null;
  return {
    codigo: String(val.codigo).replace(/\D/g, "") || null,
    codigoFormatado: val.codigoFormatado || null,
    descricao: val.descricao || null,
  };
}

function normalizeCnaeSecundarios(val) {
  if (!Array.isArray(val)) return null;
  return val.filter(c => c && c.codigo).map(c => ({
    codigo: String(c.codigo).replace(/\D/g, "") || null,
    descricao: c.descricao || null,
  }));
}

function normalizeQsa(val) {
  if (!Array.isArray(val) || val.length === 0) return null;
  return val.map(s => ({
    nome: s.nome?.trim() || null,
    qual: s.qual?.trim() || s.cargo?.trim() || null,
    cpfCnpjMascarado: s.cpf_cnpj || s.cpfCnpjMascarado || null,
    dataEntrada: s.dataEntrada || s.entrada_sociedade || s.dataEntradaSociedade || null,
    paisOrigem: s.paisOrigem || s.pais_origem || null,
  }));
}

function applyNormalization(data) {
  return {
    ...data,
    razaoSocial: normalizeRazaoSocial(data.razaoSocial),
    nomeFantasia: data.nomeFantasia ? String(data.nomeFantasia).trim() : null,
    telefone: normalizePhone(data.telefone),
    telefone2: normalizePhone(data.telefone2),
    cep: normalizeCep(data.cep),
    uf: normalizeUf(data.uf),
    cidade: normalizeCity(data.cidade),
    email: normalizeEmail(data.email),
    cnaePrincipal: normalizeCnaePrincipal(data.cnaePrincipal),
    cnaeSecundarios: normalizeCnaeSecundarios(data.cnaeSecundarios),
    qsa: normalizeQsa(data.qsa),
  };
}

function scoreField(value, source) {
  if (value == null || value === "" || value === false) return 0;
  const baseTrust = TRUST_WEIGHTS[source] || 0.5;
  return baseTrust * 100;
}

function mergeResults(primary, alternatives) {
  const merged = { ...primary };
  const fieldSources = {};
  const fieldScores = {};

  for (const field of FIELDS_TO_MERGE) {
    if (merged[field] != null && merged[field] !== "" && merged[field] !== false) {
      fieldSources[field] = primary._source || "unknown";
      fieldScores[field] = scoreField(merged[field], primary._source);
      continue;
    }

    for (const alt of alternatives) {
      const val = alt[field];
      if (val != null && val !== "" && val !== false) {
        merged[field] = val;
        fieldSources[field] = alt._source || "unknown";
        fieldScores[field] = scoreField(val, alt._source);
        break;
      }
    }
  }

  merged._fieldSources = fieldSources;
  merged._fieldScores = fieldScores;
  return merged;
}

const VALIDATION_FIELDS = [
  "razaoSocial", "nomeFantasia", "logradouro", "cidade", "uf",
  "cnaePrincipal", "porte", "situacaoCadastral", "naturezaJuridica",
  "capitalSocial", "email", "telefone",
];

function crossValidate(merged) {
  const divergences = [];

  const uniqueSources = new Set(Object.values(merged._fieldSources || {}));
  if (uniqueSources.size <= 1) return divergences;

  return divergences;
}

function computeDerivedFields(data) {
  const optSimples = data.optanteSimples;
  const mei = data.mei;
  let regimeTributario = null;
  let crt = null;

  if (mei === true) {
    regimeTributario = "MEI";
    crt = "4";
  } else if (optSimples === true) {
    regimeTributario = "Simples Nacional";
    crt = "1";
  } else if (optSimples === false && mei === false) {
    crt = null;
    regimeTributario = "PENDENTE_CONFIRMACAO";
  } else {
    regimeTributario = "PENDENTE_CONFIRMACAO";
  }

  let indicadorIe = "9";
  if (data.inscricaoEstadual) {
    const ieUpper = String(data.inscricaoEstadual).toUpperCase().trim();
    if (ieUpper === "ISENTO") indicadorIe = "2";
    else if (/^\d+$/.test(ieUpper)) indicadorIe = "1";
  }

  const ieFound = Boolean(data.inscricaoEstadual);
  const contribuinteIcms = ieFound ? true : null;
  const tipoContribuinte = ieFound ? "Contribuinte ICMS" : "Não contribuinte";

  const cnae = data.cnaePrincipal?.codigo || null;
  const cnaePrefix = cnae ? String(cnae).slice(0, 2) : null;
  const industrial = ["20","21","22","23","24","25","26","27","28","29","30","31"];
  const contribuinteIPI = industrial.includes(cnaePrefix) ? "PROVAVEL" : "PENDENTE_CONFIRMACAO";

  const anexoSimples = (() => {
    if (!cnae) return null;
    const anexos = { "01":"ANEXO_I","02":"ANEXO_II","03":"ANEXO_III","05":"ANEXO_V" };
    return anexos[cnaePrefix] || null;
  })();

  const obrigatorioIE = optSimples === false && mei === false;

  return {
    regimeTributario,
    crt,
    descricaoCrt: crt === "4" ? "4 — MEI" : crt === "1" ? "1 — Simples Nacional" : crt === "2" ? "2 — Simples com ST" : crt === "3" ? "3 — Regime Normal" : null,
    indicadorIe,
    ieStatus: ieFound ? "ENCONTRADA" : "NAO_ENCONTRADA",
    imStatus: data.inscricaoMunicipal ? "ATIVA" : null,
    contribuinteIcms,
    contribuinteIPI,
    tipoContribuinte,
    anexoSimples,
    obrigatorioIE,
  };
}

function buildLog(startTime, results) {
  return {
    tempoTotal: Date.now() - startTime,
    providers: results.map(r => ({
      name: r.provider,
      success: r.success,
      duration: r.duration,
      fieldsReturned: r.fieldsCount || 0,
      error: r.error || null,
    })),
    fallbackUsed: results.filter(r => r.success && r.isFallback).length > 0,
  };
}

export async function resolveCnpjData(cnpj, options = {}) {
  const startTime = Date.now();
  const normalized = normalizeCnpj(cnpj);
  if (!isValidCnpj(normalized)) {
    throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
  }

  const cached = cachedResult(normalized);
  if (cached) return { ...cached, _fromCache: true };

  const providers = getProviders();
  if (providers.length === 0) {
    throw new AppError("Nenhum provedor de dados disponível.", "NO_PROVIDERS", 503);
  }

  const primary = providers[0];
  const alternatives = providers.slice(1);

  const providerResults = [];

  const primaryStart = Date.now();
  let primaryResult = null;
  let primaryError = null;
  try {
    primaryResult = await primary.lookup(normalized);
    providerResults.push({
      provider: primary.name,
      success: primaryResult !== null,
      duration: Date.now() - primaryStart,
      fieldsCount: primaryResult ? FIELDS_TO_MERGE.filter(f => primaryResult[f] != null && primaryResult[f] !== "" && primaryResult[f] !== false).length : 0,
      isFallback: false,
    });
  } catch (error) {
    primaryError = error;
    const isNotFound = error instanceof AppError && error.code === "CNPJ_NOT_FOUND";
    providerResults.push({
      provider: primary.name,
      success: false,
      duration: Date.now() - primaryStart,
      error: error.message,
      fieldsCount: 0,
      isFallback: false,
    });
    if (isNotFound) {
      throw new AppError("CNPJ não encontrado na base de dados pública.", "CNPJ_NOT_FOUND", 404);
    }
  }

  let altResults = [];
  if (!primaryResult || primaryResult.razaoSocial == null || primaryResult.inscricaoEstadual == null) {
    const altPromises = alternatives.map(async (provider) => {
      const start = Date.now();
      try {
        const result = await provider.lookup(normalized);
        return {
          result,
          log: {
            provider: provider.name,
            success: result !== null,
            duration: Date.now() - start,
            fieldsCount: result ? FIELDS_TO_MERGE.filter(f => result[f] != null && result[f] !== "" && result[f] !== false).length : 0,
            isFallback: true,
          },
        };
      } catch (error) {
        return {
          result: null,
          log: {
            provider: provider.name,
            success: false,
            duration: Date.now() - start,
            error: error.message,
            fieldsCount: 0,
            isFallback: true,
          },
        };
      }
    });

    const altSettled = await Promise.allSettled(altPromises);
    for (const entry of altSettled) {
      if (entry.status === "fulfilled" && entry.value) {
        if (entry.value.result) altResults.push(entry.value.result);
        providerResults.push(entry.value.log);
      }
    }
  }

  let baseData = primaryResult || {};
  const merged = mergeResults(baseData, altResults);
  const enriched = applyNormalization(merged);
  const divergences = crossValidate(enriched);
  const derived = computeDerivedFields(enriched);

  const cepDigits = enriched.cep;
  let codigoIbge = enriched.codigoIbge || null;
  let ddd = null;

  if (cepDigits && cepDigits.length === 8 && (!enriched.logradouro || !enriched.bairro || !enriched.cidade)) {
    const viaCep = await lookupViaCep(cepDigits);
    if (viaCep) {
      if (!enriched.logradouro) enriched.logradouro = viaCep.logradouro;
      if (!enriched.bairro) enriched.bairro = viaCep.bairro;
      if (!enriched.complemento) enriched.complemento = viaCep.complemento;
      if (!enriched.cidade) enriched.cidade = viaCep.cidade;
      if (!enriched.uf) enriched.uf = viaCep.uf;
      if (viaCep.codigoIbge) codigoIbge = viaCep.codigoIbge;
      if (viaCep.ddd) ddd = viaCep.ddd;
    }
  }

  if (!codigoIbge) {
    codigoIbge = await resolveIbgeCode(enriched.cidade, enriched.uf, cepDigits);
  }

  const codigoUfIbge = enriched.uf ? (UF_IBGE[enriched.uf] || null) : null;

  if (ddd && enriched.telefone) {
    const telDigits = String(enriched.telefone).replace(/\D/g, "");
    if (telDigits.length === 8 || telDigits.length === 9) {
      enriched.telefone = `${ddd}${telDigits}`;
    }
  }
  if (ddd && enriched.telefone2) {
    const telDigits = String(enriched.telefone2).replace(/\D/g, "");
    if (telDigits.length === 8 || telDigits.length === 9) {
      enriched.telefone2 = `${ddd}${telDigits}`;
    }
  }

  if (!enriched.inscricaoEstadual && enriched.uf) {
    const ieProvider = getIeProvider();
    try {
      const ieResult = await ieProvider.lookup(normalized, enriched.uf);
      if (ieResult && ieResult.inscricaoEstadual) {
        enriched.inscricaoEstadual = ieResult.inscricaoEstadual;
        enriched.inscricaoEstadualFormatada = ieResult.inscricaoEstadualFormatada;
        enriched.ieUf = ieResult.ieUf;
        enriched.ieSituacao = ieResult.ieSituacao;
        enriched.ieFonte = ieResult.ieFonte;
        const ieDerived = computeDerivedFields(enriched);
        Object.assign(derived, ieDerived);
        providerResults.push({
          provider: ieProvider.name,
          success: true,
          duration: 0,
          fieldsCount: 1,
          isFallback: true,
        });
      }
    } catch {}
  }

  if (enriched.inscricaoEstadual && enriched.uf && !enriched.inscricaoEstadualFormatada) {
    enriched.inscricaoEstadualFormatada = formatStateRegistration(enriched.inscricaoEstadual, enriched.uf) || enriched.inscricaoEstadual;
  }

  const log = buildLog(startTime, providerResults);

  const result = {
    empresa: {
      cnpj: enriched.cnpj || normalized,
      razaoSocial: enriched.razaoSocial,
      nomeFantasia: enriched.nomeFantasia,
      endereco: enriched.logradouro,
      numero: enriched.numero,
      complemento: enriched.complemento,
      bairro: enriched.bairro,
      cep: enriched.cep,
      cidade: enriched.cidade,
      uf: enriched.uf,
      cnaePrincipal: enriched.cnaePrincipal,
      cnaeSecundarios: enriched.cnaeSecundarios,
      inscricaoMunicipal: enriched.inscricaoMunicipal,
      telefone: enriched.telefone,
      telefone1: enriched.telefone,
      telefone2: enriched.telefone2,
      email: enriched.email,
      dataAbertura: enriched.dataAbertura,
      situacaoCadastral: enriched.situacaoCadastral,
      situacaoCadastralData: enriched.situacaoCadastralData,
      naturezaJuridica: enriched.naturezaJuridica,
      naturezaJuridicaCodigo: enriched.naturezaJuridicaCodigo,
      porte: enriched.porte,
      capitalSocial: enriched.capitalSocial,
      optanteSimples: enriched.optanteSimples,
      mei: enriched.mei,
      matriz: enriched.matriz,
      filial: enriched.filial,
    },
    inscricaoEstadual: {
      numero: enriched.inscricaoEstadual || null,
      numeroFormatado: enriched.inscricaoEstadualFormatada || null,
      uf: enriched.ieUf || enriched.uf,
      situacao: enriched.ieSituacao || "PENDENTE_VALIDACAO_SEFAZ",
      fonte: enriched.ieFonte || (enriched.inscricaoEstadual ? "BUSCA_AUTOMATICA" : "NAO_ENCONTRADA"),
    },
    fiscal: {
      ambiente: "HOMOLOGACAO",
      regimeApuracao: "COMPETENCIA",
      regimeTributario: derived.regimeTributario || (enriched.optanteSimples ? "Simples Nacional" : null),
      pisCofins: "PENDENTE_CONFIRMACAO",
      contribuinteICMS: derived.contribuinteIcms ?? "PENDENTE_VALIDACAO_SEFAZ",
      contribuinteIPI: derived.contribuinteIPI,
      anexoSimples: derived.anexoSimples,
      receitaAcumulada12Meses: null,
    },
    _enrichment: {
      derived,
      codigoIbge,
      codigoUfIbge,
      ddd,
      qsa: enriched.qsa,
      site: enriched.site,
      dataOpcaoSimples: enriched.dataOpcaoSimples,
      dataExclusaoSimples: enriched.dataExclusaoSimples,
      fieldSources: enriched._fieldSources || {},
      fieldScores: enriched._fieldScores || {},
      divergences,
      log,
    },
  };

  saveCacheResult(normalized, result);
  return result;
}

export function clearDataResolverCache() {
  dataCache.clear();
}
