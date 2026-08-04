export type Money = string;

export type FinancialAccountType = "CASH" | "BANK" | "DIGITAL_WALLET" | "MARKETPLACE" | "CLEARING";

export type FinancialAccount = {
  id: string;
  name: string;
  type: FinancialAccountType;
  bank?: string | null;
  branch?: string | null;
  maskedAccount?: string | null;
  initialBalance: Money;
  initialBalanceDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FinancialAccountInput = {
  name: string;
  type: FinancialAccountType;
  bank?: string | null;
  branch?: string | null;
  maskedAccount?: string | null;
  initialBalance: string;
  initialBalanceDate: string;
  active: boolean;
};

export const financialAccountTypeLabels: Record<FinancialAccountType, string> = {
  CASH: "Caixa",
  BANK: "Conta corrente",
  DIGITAL_WALLET: "Carteira digital",
  MARKETPLACE: "Marketplace",
  CLEARING: "Compensação",
};
