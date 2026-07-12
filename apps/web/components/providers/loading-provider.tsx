"use client";

import { RefreshCw } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LoadingEntry = {
  id: string;
  label?: string;
};

type LoadingContextValue = {
  isLoading: boolean;
  showLoading: (label?: string) => string;
  hideLoading: (id: string) => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LoadingEntry[]>([]);

  const showLoading = useCallback((label?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEntries((current) => [...current, { id, label }]);
    return id;
  }, []);

  const hideLoading = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo<LoadingContextValue>(
    () => ({
      isLoading: entries.length > 0,
      showLoading,
      hideLoading,
    }),
    [entries.length, hideLoading, showLoading],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {entries.length > 0 && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4 shadow-card">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-extrabold text-ink">
              {entries.at(-1)?.label ?? "Carregando..."}
            </span>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoadingOverlay() {
  const context = useContext(LoadingContext);
  if (!context) throw new Error("useLoadingOverlay deve ser usado dentro de LoadingProvider.");
  return context;
}
