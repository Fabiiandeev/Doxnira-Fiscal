"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseService } from "./purchase-service";
import type { PurchaseInput } from "./purchase-types";
export const usePurchases = (query: string) => useQuery({ queryKey: ["operation", "purchases", query], queryFn: () => purchaseService.list(query) });
export const usePurchase = (id?: string) => useQuery({ queryKey: ["operation", "purchase", id], queryFn: () => purchaseService.get(id!), enabled: Boolean(id) });
export const usePurchaseMutation = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, action, body }: { id?: string; action: string; body: unknown }) => action === "create" ? purchaseService.create(body as PurchaseInput) : action === "update" ? purchaseService.update(id!, body as PurchaseInput) : purchaseService.action(id!, action, body), onSuccess: () => client.invalidateQueries({ queryKey: ["operation", "purchase"] }) }); };
