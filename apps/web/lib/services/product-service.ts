import { apiFetch, getCompanyId } from "@/lib/api";
import type { Product, FiscalAiProduct, NcmAnalysisResult, FiscalSimulationResultV2, SimulateFiscalParams } from "@/lib/product-types";

type ProductListResponse = { data: Product[] };

export async function listProducts(search?: string): Promise<Product[]> {
  const companyId = getCompanyId();
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const qs = params.toString();
  const res = await apiFetch<ProductListResponse>(
    `/companies/${companyId}/products${qs ? `?${qs}` : ""}`,
  );
  return res.data;
}

export async function getProduct(id: string): Promise<Product> {
  const companyId = getCompanyId();
  return apiFetch<Product>(`/companies/${companyId}/products/${id}`);
}

export async function getNextCode(): Promise<string> {
  const companyId = getCompanyId();
  const res = await apiFetch<{ nextCode: string }>(`/companies/${companyId}/products/next-code`);
  return res.nextCode;
}

export async function createProduct(payload: Record<string, unknown>): Promise<Product> {
  const companyId = getCompanyId();
  return apiFetch<Product>(`/companies/${companyId}/products`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(id: string, payload: Record<string, unknown>): Promise<Product> {
  const companyId = getCompanyId();
  return apiFetch<Product>(`/companies/${companyId}/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const companyId = getCompanyId();
  await apiFetch(`/companies/${companyId}/products/${id}`, { method: "DELETE" });
}

export async function lookupNcm(ncm: string): Promise<{ descricao: string; cestObrigatorio: boolean; st: boolean; monofasico: boolean; ipi: boolean; fcp: boolean; aliquotaInterestadual: number | null }> {
  const companyId = getCompanyId();
  return apiFetch(`/companies/${companyId}/products/ncm/${encodeURIComponent(ncm)}`);
}

export async function validarProdutoFiscal(payload: Record<string, unknown>): Promise<FiscalAiProduct> {
  return apiFetch<FiscalAiProduct>("/produtos/validar-fiscal", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function analyzeNcm(ncm: string): Promise<NcmAnalysisResult> {
  const companyId = getCompanyId();
  return apiFetch<NcmAnalysisResult>(`/companies/${companyId}/products/ncm/${encodeURIComponent(ncm)}/analysis`);
}

export async function simulateFiscal(params: SimulateFiscalParams): Promise<FiscalSimulationResultV2> {
  const companyId = getCompanyId();
  return apiFetch<FiscalSimulationResultV2>(
    `/companies/${companyId}/products/ncm/${encodeURIComponent(params.ncm)}/simulate`,
    {
      method: "POST",
      body: JSON.stringify(params),
    },
  );
}
