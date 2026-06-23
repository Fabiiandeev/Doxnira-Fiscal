import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { normalizeCnpj } from "../utils/cnpj.js";
import { validateStateRegistration, validateStateRegistrationDetailed, formatStateRegistration } from "./state-registration-validator.service.js";

async function fetchWithTimeout(url, timeout = 10_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "NSFiscalCloud/1.0" },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchStateRegistrationBrasilAPI(cnpj, uf) {
  const normalized = normalizeCnpj(cnpj);
  const state = (uf || "").toUpperCase();

  if (normalized.length !== 14 || !state || state.length !== 2) {
    throw new AppError("CNPJ ou UF inválido.", "INVALID_INPUT", 400);
  }

  try {
    const response = await fetchWithTimeout(
      `https://brasilapi.com.br/api/inscricao_estadual/v1/${state}/${normalized}`
    );

    if (response.status === 404) {
      return {
        encontrada: false,
        numero: null,
        situacao: "NAO_ENCONTRADA",
        fonte: "BRASILAPI",
        validado: false,
      };
    }

    if (!response.ok) {
      return {
        encontrada: false,
        numero: null,
        situacao: "ERRO_CONSULTA",
        fonte: "BRASILAPI",
        validado: false,
      };
    }

    const data = await response.json();
    const ie = data.inscricao_estadual || data.ie || null;

    if (!ie) {
      return {
        encontrada: false,
        numero: null,
        situacao: "NAO_ENCONTRADA",
        fonte: "BRASILAPI",
        validado: false,
      };
    }

    const validation = validateStateRegistrationDetailed(ie, state);
    return {
      encontrada: true,
      numero: ie,
      numeroFormatado: formatStateRegistration(ie, state),
      situacao: data.ativo === false ? "INATIVA" : "ATIVA",
      fonte: "BRASILAPI",
      validado: validation.valid === null ? null : Boolean(validation.valid),
      validacaoStatus: validation.status,
      validacaoMessage: validation.message,
      validacaoSuggestion: validation.suggestion,
      ativo: data.ativo !== false,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return {
      encontrada: false,
      numero: null,
      situacao: "ERRO_CONEXAO",
      fonte: "BRASILAPI",
      validado: false,
      erro: error.message,
    };
  }
}

export async function searchStateRegistration(cnpj, uf) {
  const normalized = normalizeCnpj(cnpj);
  const state = (uf || "").toUpperCase();

  if (normalized.length !== 14) {
    throw new AppError("CNPJ deve conter 14 dígitos.", "INVALID_CNPJ", 400);
  }

  if (!state || state.length !== 2) {
    throw new AppError("UF deve ser informada.", "INVALID_STATE", 400);
  }

  const result = await searchStateRegistrationBrasilAPI(normalized, state);
  return {
    cnpj: normalized,
    uf: state,
    ...result,
    consultadoEm: new Date().toISOString(),
  };
}

export function validateStateRegistrationInput(ie, uf) {
  if (!ie || !uf) return false;
  const normalized = String(ie).replace(/\D/g, "");
  const state = (uf || "").toUpperCase();
  return validateStateRegistration(normalized, state);
}
