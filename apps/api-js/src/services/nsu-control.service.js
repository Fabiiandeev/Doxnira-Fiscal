import { AppError } from "../utils/app-error.js";

export function assertNsuWindow(company) {
  if (
    company.nfeNextAllowedSyncAt &&
    new Date(company.nfeNextAllowedSyncAt).getTime() > Date.now()
  ) {
    throw new AppError(
      "A próxima consulta ainda está bloqueada pela janela de NSU.",
      "NSU_WINDOW_BLOCKED",
      429,
      [{ nextAllowedSyncAt: company.nfeNextAllowedSyncAt }],
    );
  }
}

export function nextNsu(current = "000000000000000", increment = 1) {
  return String(BigInt(current || "0") + BigInt(increment)).padStart(15, "0");
}
