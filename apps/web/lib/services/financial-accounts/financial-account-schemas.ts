import type { FinancialAccountInput } from "./financial-account-types";
export type FinancialAccountErrors = Partial<Record<keyof FinancialAccountInput, string>>;
const numberValue = (value: string) => Number(String(value).replace(",", "."));
export function validateFinancialAccount(input: FinancialAccountInput) {
  const errors: FinancialAccountErrors = {};
  if (!input.name.trim()) errors.name = "Informe o nome da conta.";
  if (!input.type) errors.type = "Selecione o tipo da conta.";
  if (!input.initialBalanceDate || Number.isNaN(new Date(`${input.initialBalanceDate}T12:00:00`).getTime())) errors.initialBalanceDate = "Informe a data do saldo inicial.";
  if (!input.initialBalance.toString().trim() || numberValue(input.initialBalance) < 0) errors.initialBalance = "Saldo inicial inválido.";
  return errors;
}
