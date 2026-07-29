"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useMarketplace } from "@/hooks/use-marketplace";
import {
  beginMercadoLivreConnection,
  disconnectMarketplaceConnection,
  listMarketplaceConnections,
  syncMarketplaceConnection,
  testMarketplaceConnection,
} from "@/lib/services/marketplace/service";

export function useMarketplaceModule() {
  const marketplace = useMarketplace();
  const queryClient = useQueryClient();
  const connections = useQuery({
    queryKey: ["marketplace-connections", marketplace.companyId],
    queryFn: () => listMarketplaceConnections(marketplace.companyId ?? ""),
    enabled: Boolean(marketplace.companyId),
  });
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["marketplace-connections", marketplace.companyId] }),
    [marketplace.companyId, queryClient],
  );
  const connect = useMutation({
    mutationFn: () => beginMercadoLivreConnection(marketplace.companyId ?? ""),
  });
  const test = useMutation({
    mutationFn: (connectionId: string) => testMarketplaceConnection(marketplace.companyId ?? "", connectionId),
  });
  const sync = useMutation({
    mutationFn: (connectionId: string) => syncMarketplaceConnection(marketplace.companyId ?? "", connectionId),
    onSuccess: invalidate,
  });
  const disconnect = useMutation({
    mutationFn: (connectionId: string) => disconnectMarketplaceConnection(marketplace.companyId ?? "", connectionId),
    onSuccess: invalidate,
  });

  return {
    ...marketplace,
    connections,
    connect,
    test,
    sync,
    disconnect,
    invalidate,
  };
}
