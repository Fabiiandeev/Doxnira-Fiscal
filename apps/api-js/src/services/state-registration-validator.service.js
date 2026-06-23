import { AppError } from "../utils/app-error.js";

export function validateStateRegistrationMG(ie) {
  if (!ie) return false;
  const normalized = String(ie).replace(/\D/g, "");
  if (normalized.length !== 13) return false;

  const numbers = normalized.split("").map(Number);
  const sequence = "3298765432";
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += numbers[i] * Number(sequence[i]);
  }

  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += numbers[i + 1] * Number(sequence[i]);
  }

  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;

  return numbers[10] === digit1 && numbers[11] === digit2;
}

export function validateStateRegistrationDetailed(ie, uf) {
  if (!ie || !uf) {
    return { valid: false, status: "INVALID_INPUT", message: "IE ou UF inválidos.", suggestion: "Informe a UF e a Inscrição Estadual." };
  }
  const state = (uf || "").toUpperCase();

  const validators = {
    MG: validateStateRegistrationMG,
    SP: () => true,
    RJ: () => true,
    BA: () => true,
    PR: () => true,
  };

  const validator = validators[state];
  if (!validator) {
    return {
      valid: null,
      status: "NOT_IMPLEMENTED",
      message: "Validação automática de IE ainda não implementada para esta UF.",
      suggestion: "Marque como pendente de validação manual ou revise com a contabilidade.",
    };
  }
  try {
    const valid = Boolean(validator(ie));
    return { valid, status: valid ? "VALID" : "INVALID", message: valid ? "Inscrição Estadual válida." : "Inscrição Estadual inválida.", suggestion: valid ? null : "Verifique os dígitos e a combinação com a UF." };
  } catch (error) {
    return { valid: null, status: "ERROR", message: "Erro ao validar IE.", suggestion: "Valide manualmente." };
  }
}

export function validateStateRegistration(ie, uf) {
  const res = validateStateRegistrationDetailed(ie, uf);
  if (res.status === "NOT_IMPLEMENTED") return false;
  return Boolean(res.valid);
}

export function formatStateRegistration(ie, uf) {
  if (!ie || !uf) return null;
  const normalized = String(ie).replace(/\D/g, "");
  const state = (uf || "").toUpperCase();

  const formatters = {
    MG: (value) => {
      if (value.length !== 13) return value;
      return `${value.slice(0, 3)}.${value.slice(3, 9)}.${value.slice(9, 11)}-${value.slice(11)}`;
    },
    SP: (value) => {
      if (value.length !== 12) return value;
      return `${value.slice(0, 8)}.${value.slice(8)}`;
    },
  };

  const formatter = formatters[state];
  return formatter ? formatter(normalized) : normalized;
}

export function getStateRegistrationFormat(uf) {
  const state = (uf || "").toUpperCase();
  const formats = {
    MG: "XXX.XXXXXX.XX-XX (13 dígitos)",
    SP: "XXXXXXXX.XXX (11 dígitos)",
    RJ: "XXXXXXXX.XX (10 dígitos)",
    BA: "XXXXXXXXXXXXXXX (15 dígitos)",
    PR: "XXXXXXXX.XXX (9 dígitos)",
  };
  return formats[state] || "Consulte com a Receita Estadual";
}
