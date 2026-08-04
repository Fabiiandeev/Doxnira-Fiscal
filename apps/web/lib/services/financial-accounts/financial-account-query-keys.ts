export const financialAccountKeys = {
  all: (companyId: string) => ["financial-accounts", companyId] as const,
  list: (companyId: string) => ["financial-accounts", companyId, "list"] as const,
  detail: (companyId: string, accountId: string) => ["financial-accounts", companyId, "detail", accountId] as const,
};
