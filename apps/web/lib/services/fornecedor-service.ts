import { apiFetch, getCompanyId } from "@/lib/api";
import type { Fornecedor } from "@/lib/fornecedor-types";

type FornecedorListResponse = { data: Fornecedor[] };

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

export async function listFornecedores(q?: string): Promise<Fornecedor[]> {
  const companyId = getCompanyId();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const qs = params.toString();
  const res = await apiFetch<FornecedorListResponse>(`/companies/${companyId}/fornecedores${qs ? `?${qs}` : ""}`);
  return res.data;
}

export async function getFornecedor(id: string): Promise<Fornecedor> {
  const companyId = getCompanyId();
  return apiFetch<Fornecedor>(`/companies/${companyId}/fornecedores/${id}`);
}

export async function createFornecedor(payload: Record<string, unknown>): Promise<Fornecedor> {
  const companyId = getCompanyId();
  return apiFetch<Fornecedor>(`/companies/${companyId}/fornecedores`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFornecedor(id: string, payload: Record<string, unknown>): Promise<Fornecedor> {
  const companyId = getCompanyId();
  return apiFetch<Fornecedor>(`/companies/${companyId}/fornecedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteFornecedor(id: string): Promise<void> {
  const companyId = getCompanyId();
  await apiFetch(`/companies/${companyId}/fornecedores/${id}`, { method: "DELETE" });
}
