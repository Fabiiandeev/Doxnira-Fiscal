"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "./inventory-service";
import type { Filters, InventoryRow, Page } from "./inventory-types";

export const useInventorySummary = () => useQuery({ queryKey: ["inventory", "summary"], queryFn: inventoryService.summary });
export const useInventoryList = (kind: "warehouses" | "balances" | "movements" | "reservations" | "transfers" | "counts", filters: Filters) =>
  useQuery<Page<InventoryRow>>({ queryKey: ["inventory", kind, filters], queryFn: async () => {
    const result = await inventoryService[kind](filters);
    return { ...result, data: result.data as InventoryRow[] };
  } });
export const useInventoryMutation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, id, body }: { action: string; id?: string; body?: unknown }): Promise<unknown> => {
      if (action === "warehouse.create") return inventoryService.createWarehouse(body);
      if (action === "adjust") return inventoryService.adjust(body);
      if (action === "reservation.create") return inventoryService.createReservation(body);
      if (action.startsWith("reservation.")) return inventoryService.reservationAction(id!, action.split(".")[1]);
      if (action === "transfer.create") return inventoryService.createTransfer(body);
      if (action.startsWith("transfer.")) return inventoryService.transferAction(id!, action.split(".")[1]);
      if (action === "count.create") return inventoryService.createCount(body);
      if (action === "count.save") return inventoryService.saveCount(id!, body);
      if (action.startsWith("count.")) return inventoryService.countAction(id!, action.split(".")[1]);
      throw new Error("Ação de estoque inválida.");
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["inventory"] }),
  });
};
