export type AppAsyncState = "idle" | "loading" | "empty" | "success" | "error";

export const EMPTY_STATE_COPY = {
  title: "Nenhum dado encontrado.",
  description: "Cadastre, importe ou sincronize informações para gerar análise.",
} as const;

export function resolveAsyncState({
  isLoading,
  hasError,
  count,
}: {
  isLoading?: boolean;
  hasError?: boolean;
  count?: number;
}): AppAsyncState {
  if (isLoading) return "loading";
  if (hasError) return "error";
  if (count === 0) return "empty";
  if (typeof count === "number" && count > 0) return "success";
  return "idle";
}
