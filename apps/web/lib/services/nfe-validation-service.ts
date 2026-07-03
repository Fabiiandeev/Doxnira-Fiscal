import { apiFetch, getCompanyId } from "@/lib/api";
import type { NfeValidationRun } from "@/lib/nfe-validation-types";

function company() {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return companyId;
}

export function listNfeValidationRuns(companyId = company()) {
  return apiFetch<{ data: NfeValidationRun[] }>(
    `/companies/${companyId}/nfe-validation`,
  );
}

export function getNfeValidationRun(runId: string, companyId = company()) {
  return apiFetch<NfeValidationRun>(
    `/companies/${companyId}/nfe-validation/${runId}`,
  );
}

export function runNfeValidation(data: unknown, companyId = company()) {
  return apiFetch<NfeValidationRun>(
    `/companies/${companyId}/nfe-validation`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function autoCorrectNfeValidation(runId: string, companyId = company()) {
  return apiFetch<{ corrected: unknown; corrections: unknown[]; newRun: NfeValidationRun }>(
    `/companies/${companyId}/nfe-validation/${runId}/auto-correct`,
    {
      method: "POST",
    },
  );
}
