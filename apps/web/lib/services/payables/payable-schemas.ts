import type { PayableInput } from "./payable-types";
export type PayableErrors = Partial<Record<keyof PayableInput, string>>;
export function validatePayable(input: PayableInput) {
  const errors: PayableErrors = {};
  if (!input.description.trim()) errors.description = "Informe a descrição.";
  if (!input.dueDate || Number.isNaN(new Date(`${input.dueDate}T12:00:00`).getTime())) errors.dueDate = "Informe um vencimento válido.";
  if (!input.amount || Number(input.amount.replace(",", ".")) <= 0) errors.amount = "O valor deve ser maior que zero.";
  return errors;
}

