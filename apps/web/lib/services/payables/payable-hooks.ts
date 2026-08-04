"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/components/providers/company-provider";
import { payableKeys } from "./payable-query-keys";
import { payableService } from "./payable-service";
import type { PayableFilters, PayableInput } from "./payable-types";
const useCompany = () => { const { activeCompanyId } = useCompanyContext(); return activeCompanyId || ""; };
export const usePayables = (filters: PayableFilters) => { const companyId = useCompany(); return useQuery({ queryKey: payableKeys.list(companyId, filters), queryFn: ({ signal }) => payableService.list(companyId, filters, signal), enabled: Boolean(companyId), placeholderData: undefined }); };
export const usePayable = (id: string) => { const companyId = useCompany(); return useQuery({ queryKey: payableKeys.detail(companyId, id), queryFn: ({ signal }) => payableService.detail(companyId, id, signal), enabled: Boolean(companyId && id) }); };
export const usePayableOptions = () => { const companyId = useCompany(); return useQuery({ queryKey: payableKeys.options(companyId), queryFn: () => payableService.options(companyId), enabled: Boolean(companyId), staleTime: 60_000 }); };
function usePayableMutation<T>(run: (companyId: string, value: T) => Promise<unknown>) { const companyId = useCompany(), client = useQueryClient(); return useMutation({ mutationFn: (value: T) => run(companyId, value), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: payableKeys.all(companyId) }), client.invalidateQueries({ queryKey: ["financial-dashboard"] })]); } }); }
export const useCreatePayable = () => usePayableMutation<PayableInput>((companyId, input) => payableService.create(companyId, input));
export const useUpdatePayable = () => usePayableMutation<{ id: string; input: PayableInput }>((companyId, value) => payableService.update(companyId, value.id, value.input));
export const useSettlePayable = () => usePayableMutation<{ id: string; amount: string; date: string; financialAccountId?: string | null; method?: string | null }>((companyId, value) => payableService.settle(companyId, value.id, value));
export const useCancelPayable = () => usePayableMutation<{ id: string; reason: string }>((companyId, value) => payableService.cancel(companyId, value.id, value.reason));
export const useReversePayable = () => usePayableMutation<{ id: string; reason: string }>((companyId, value) => payableService.reverse(companyId, value.id, value.reason));
export const useReopenPayable = () => usePayableMutation<{ id: string; reason: string }>((companyId, value) => payableService.reopen(companyId, value.id, value.reason));
