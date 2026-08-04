"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/components/providers/company-provider";
import { financialAccountKeys } from "./financial-account-query-keys";
import { financialAccountService } from "./financial-account-service";
import type { FinancialAccountInput } from "./financial-account-types";
const useCompany = () => { const { activeCompanyId } = useCompanyContext(); return activeCompanyId || ""; };
export const useFinancialAccounts = () => {
  const companyId = useCompany();
  return useQuery({
    queryKey: financialAccountKeys.list(companyId),
    queryFn: ({ signal }) => financialAccountService.list(companyId, signal),
    enabled: Boolean(companyId),
    placeholderData: undefined,
  });
};
export const useFinancialAccount = (id: string) => {
  const companyId = useCompany();
  return useQuery({
    queryKey: financialAccountKeys.detail(companyId, id),
    queryFn: ({ signal }) => financialAccountService.detail(companyId, id, signal),
    enabled: Boolean(companyId && id),
  });
};
function useFinancialAccountMutation<T>(run: (companyId: string, value: T) => Promise<unknown>) {
  const companyId = useCompany();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: T) => run(companyId, value),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: financialAccountKeys.all(companyId) }),
        client.invalidateQueries({ queryKey: ["payables"] }),
        client.invalidateQueries({ queryKey: ["financial"] }),
        client.invalidateQueries({ queryKey: ["financial-dashboard"] }),
      ]);
    },
  });
}
export const useCreateFinancialAccount = () => useFinancialAccountMutation<FinancialAccountInput>((companyId, input) => financialAccountService.create(companyId, input));
export const useUpdateFinancialAccount = () => useFinancialAccountMutation<{ id: string; input: FinancialAccountInput }>((companyId, value) => financialAccountService.update(companyId, value.id, value.input));
export const useActivateFinancialAccount = () => useFinancialAccountMutation<{ id: string }>((companyId, value) => financialAccountService.activate(companyId, value.id));
export const useDeactivateFinancialAccount = () => useFinancialAccountMutation<{ id: string }>((companyId, value) => financialAccountService.deactivate(companyId, value.id));
