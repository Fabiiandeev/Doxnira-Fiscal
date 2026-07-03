import { apiFetch, getCompanyId } from "@/lib/api";
import type { Cfop } from "@/lib/product-types";

type CfopListResponse = { data: Cfop[] };
type CfopResponse = { data: Cfop | null };

export async function searchCfops(q: string, tipo?: string): Promise<Cfop[]> {
  const companyId = getCompanyId();
  const params = new URLSearchParams();
  params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  const basePath = companyId ? `/companies/${companyId}/cfops/search` : "/cfops/search";
  const res = await apiFetch<CfopListResponse>(`${basePath}?${params.toString()}`);
  return res.data;
}

export async function getCfopByCodigo(codigo: string): Promise<Cfop | null> {
  const companyId = getCompanyId();
  const basePath = companyId ? `/companies/${companyId}/cfops` : "/cfops";
  const res = await apiFetch<CfopResponse>(`${basePath}/${codigo}`);
  return res.data ?? null;
}
