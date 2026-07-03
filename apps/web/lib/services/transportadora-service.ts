import { apiFetch, getCompanyId } from "@/lib/api";
import type { Transportadora } from "@/lib/transportadora-types";

type TransportadoraListResponse = { data: Transportadora[] };

export const viacepCache = new Map<string, ViaCepResult>();

interface ViaCepResult {
  cep: string;
  logradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigoIbge: string | null;
  ddd: string | null;
}

export async function lookupViaCep(cep: string): Promise<ViaCepResult | null> {
  const digits = String(cep).replace(/\D/g, "");
  if (digits.length !== 8) return null;
  if (viacepCache.has(digits)) return viacepCache.get(digits)!;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    const result: ViaCepResult = {
      cep: digits,
      logradouro: data.logradouro || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      cidade: data.localidade || null,
      uf: data.uf || null,
      codigoIbge: data.ibge || null,
      ddd: data.ddd || null,
    };
    viacepCache.set(digits, result);
    return result;
  } catch {
    return null;
  }
}

export async function listTransportadoras(q?: string): Promise<Transportadora[]> {
  const companyId = getCompanyId();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const qs = params.toString();
  const res = await apiFetch<TransportadoraListResponse>(`/companies/${companyId}/transportadoras${qs ? `?${qs}` : ""}`);
  return res.data;
}

export async function getTransportadora(id: string): Promise<Transportadora> {
  const companyId = getCompanyId();
  return apiFetch<Transportadora>(`/companies/${companyId}/transportadoras/${id}`);
}

export async function createTransportadora(payload: Record<string, unknown>): Promise<Transportadora> {
  const companyId = getCompanyId();
  return apiFetch<Transportadora>(`/companies/${companyId}/transportadoras`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTransportadora(id: string, payload: Record<string, unknown>): Promise<Transportadora> {
  const companyId = getCompanyId();
  return apiFetch<Transportadora>(`/companies/${companyId}/transportadoras/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTransportadora(id: string): Promise<void> {
  const companyId = getCompanyId();
  await apiFetch(`/companies/${companyId}/transportadoras/${id}`, { method: "DELETE" });
}
