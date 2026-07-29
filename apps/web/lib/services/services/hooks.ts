"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { servicesService } from "./service";
import type { ServiceInput } from "./types";
export const useServices = (q: string, page: number, active: string) => useQuery({ queryKey: ["services", q, page, active], queryFn: () => servicesService.list(q, page, active) });
export const useServiceMutation = () => { const client = useQueryClient(); return useMutation<unknown, Error, { op: "create"|"update"|"toggle"|"delete"; id?: string; data?: Partial<ServiceInput>; active?: boolean }>({ mutationFn: (input) => input.op === "create" ? servicesService.create(input.data as ServiceInput) : input.op === "update" ? servicesService.update(input.id!, input.data || {}) : input.op === "toggle" ? servicesService.toggle(input.id!, Boolean(input.active)) : servicesService.remove(input.id!), onSuccess: () => client.invalidateQueries({ queryKey: ["services"] }) }); };
