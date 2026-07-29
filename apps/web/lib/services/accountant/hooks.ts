"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountantOfficeApi } from "./service";
import type { AccountantFilters } from "./types";
export function useAccountantOfficeData(kind: "dashboard"|"risk"|"queue"|"value", officeId: string, filters: AccountantFilters) {
  return useQuery({ queryKey: ["accountant-office", officeId, kind, filters], enabled: Boolean(officeId), placeholderData: keepPreviousData, queryFn: () => kind === "dashboard" ? accountantOfficeApi.dashboard(officeId, filters) : kind === "risk" ? accountantOfficeApi.risk(officeId, filters) : kind === "queue" ? accountantOfficeApi.queue(officeId, filters) : accountantOfficeApi.value(officeId, filters) });
}
export function useQueueAction(officeId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, action, body }: { id: string; action: string; body?: Record<string, unknown> }) => accountantOfficeApi.action(officeId, id, action, body), onSuccess: () => client.invalidateQueries({ queryKey: ["accountant-office", officeId] }) });
}
