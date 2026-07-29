"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { salesService } from "./sales-service";
import type { SalesInput } from "./sales-types";
export const useSales = (query: string) => useQuery({ queryKey: ["operation", "sales", query], queryFn: () => salesService.list(query) });
export const useSale = (id?: string) => useQuery({ queryKey: ["operation", "sale", id], queryFn: () => salesService.get(id!), enabled: Boolean(id) });
export const useSalesMutation = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, action, body }: { id?: string; action: string; body: unknown }) => action === "create" ? salesService.create(body as SalesInput) : action === "update" ? salesService.update(id!, body as SalesInput) : salesService.action(id!, action, body), onSuccess: () => client.invalidateQueries({ queryKey: ["operation", "sale"] }) }); };
