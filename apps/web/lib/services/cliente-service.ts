import { apiFetch, getCompanyId } from "@/lib/api";
import type { IntelligentClient, ClientLookupResult, ClientValidationResult } from "@/lib/client-types";

type ClientListResponse = { data: IntelligentClient[] };

const viacepCache = new Map<string, ViaCepResult>();

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

export async function listClients(q?: string): Promise<IntelligentClient[]> {
  const companyId = getCompanyId();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const qs = params.toString();
  const res = await apiFetch<ClientListResponse>(`/companies/${companyId}/clientes${qs ? `?${qs}` : ""}`);
  return res.data;
}

export async function getClient(id: string): Promise<IntelligentClient> {
  const companyId = getCompanyId();
  return apiFetch<IntelligentClient>(`/companies/${companyId}/clientes/${id}`);
}

export async function createClient(payload: Record<string, unknown>): Promise<IntelligentClient> {
  const companyId = getCompanyId();
  return apiFetch<IntelligentClient>(`/companies/${companyId}/clientes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(id: string, payload: Record<string, unknown>): Promise<IntelligentClient> {
  const companyId = getCompanyId();
  return apiFetch<IntelligentClient>(`/companies/${companyId}/clientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteClient(id: string): Promise<void> {
  const companyId = getCompanyId();
  await apiFetch(`/companies/${companyId}/clientes/${id}`, { method: "DELETE" });
}

export async function buscarCnpj(cnpj: string): Promise<ClientLookupResult> {
  return apiFetch<ClientLookupResult>(`/clientes/buscar-cnpj?cnpj=${encodeURIComponent(cnpj)}`);
}

export async function buscarCpf(cpf: string): Promise<ClientLookupResult> {
  return apiFetch<ClientLookupResult>(`/clientes/buscar-cpf?cpf=${encodeURIComponent(cpf)}`);
}

export interface SintegraResult {
  success: boolean;
  cnpj: string;
  uf: string | null;
  inscricaoEstadual: string | null;
  inscricaoEstadualFormatada: string | null;
  ieStatus: string;
  situacao: string;
  fonte: string;
  indicadorIe: string;
  contribuinteIcms: boolean;
  tipoContribuinte: string;
}

export async function validarSintegra(cnpj: string, uf?: string): Promise<SintegraResult> {
  const params = new URLSearchParams({ cnpj });
  if (uf) params.set("uf", uf);
  return apiFetch<SintegraResult>(`/clientes/validar-sintegra?${params.toString()}`);
}

export async function validarCliente(cliente: Record<string, unknown>): Promise<ClientValidationResult> {
  const companyId = getCompanyId();
  return apiFetch<ClientValidationResult>(`/companies/${companyId}/clientes/validar-ia`, {
    method: "POST",
    body: JSON.stringify(cliente),
  });
}

export type { IntelligentClient, ClientLookupResult, ClientValidationResult };
