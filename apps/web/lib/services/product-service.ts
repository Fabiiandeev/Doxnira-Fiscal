import { apiFetch, getCompanyId } from "@/lib/api";
import type {
  FiscalSimulationResultV2,
  NcmAnalysisResult,
  Product,
  ProductAutoFixResult,
  ProductFiscalDocumentItem,
  ProductSettings,
  ProductStockResult,
  ProductSuggestionResult,
  ProductValidationResult,
  SimulateFiscalParams,
} from "@/lib/product-types";

type ProductListResponse = { data: Product[] };
type ProductDocumentsResponse = { data: ProductFiscalDocumentItem[]; total: number };

function productPath(path = "") {
  const companyId = getCompanyId();
  const suffix = path.startsWith("?") ? path : path.startsWith("/") ? path : path ? `/${path}` : "";
  return `/products${suffix}${companyId ? `${suffix.includes("?") ? "&" : "?"}companyId=${encodeURIComponent(companyId)}` : ""}`;
}

export async function listProducts(search?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  const qs = params.toString();
  const res = await apiFetch<ProductListResponse>(productPath(qs ? `?${qs}` : ""));
  return res.data;
}

export async function getProduct(id: string): Promise<Product> {
  return apiFetch<Product>(productPath(`/${id}`));
}

export async function getNextCode(): Promise<string> {
  const res = await apiFetch<{ nextCode: string }>(productPath("/next-code"));
  return res.nextCode;
}

export async function createProduct(payload: Record<string, unknown>): Promise<Product> {
  return apiFetch<Product>(productPath(), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(id: string, payload: Record<string, unknown>): Promise<Product> {
  return apiFetch<Product>(productPath(`/${id}`), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch(productPath(`/${id}`), { method: "DELETE" });
}

export async function lookupNcm(ncm: string): Promise<{ descricao: string; cestObrigatorio: boolean; st: boolean; monofasico: boolean; ipi: boolean; fcp: boolean; aliquotaInterestadual: number | null }> {
  return apiFetch(productPath(`/ncm/${encodeURIComponent(ncm)}`));
}

export async function validarProdutoFiscal(payload: Record<string, unknown>): Promise<ProductValidationResult> {
  return apiFetch<ProductValidationResult>(productPath("/validar-fiscal"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function analyzeNcm(ncm: string): Promise<NcmAnalysisResult> {
  return apiFetch<NcmAnalysisResult>(productPath(`/ncm/${encodeURIComponent(ncm)}/analysis`));
}

export async function simulateFiscal(params: SimulateFiscalParams): Promise<FiscalSimulationResultV2> {
  return apiFetch<FiscalSimulationResultV2>(
    productPath(`/ncm/${encodeURIComponent(params.ncm)}/simulate`),
    {
      method: "POST",
      body: JSON.stringify(params),
    },
  );
}

export async function validateProduct(id: string): Promise<ProductValidationResult> {
  return apiFetch<ProductValidationResult>(productPath(`/${id}/validate`), { method: "POST" });
}

export async function autoFixProduct(id: string): Promise<ProductAutoFixResult> {
  return apiFetch<ProductAutoFixResult>(productPath(`/${id}/auto-fix`), { method: "POST" });
}

export async function suggestProductNcm(id: string): Promise<ProductSuggestionResult> {
  return apiFetch<ProductSuggestionResult>(productPath(`/${id}/suggest-ncm`), { method: "POST" });
}

export async function suggestProductCest(id: string): Promise<ProductSuggestionResult> {
  return apiFetch<ProductSuggestionResult>(productPath(`/${id}/suggest-cest`), { method: "POST" });
}

export async function applyProductFiscalRule(id: string, payload: Record<string, unknown> = {}): Promise<{ product: Product; validation: ProductValidationResult; requiresConfirmation: boolean }> {
  return apiFetch(productPath(`/${id}/apply-fiscal-rule`), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProductStock(id: string): Promise<ProductStockResult> {
  return apiFetch<ProductStockResult>(productPath(`/${id}/stock`));
}

export async function updateProductStockSettings(id: string, payload: Record<string, unknown>): Promise<{ product: Product; stock: ProductSettings["stock"]; validation: ProductValidationResult }> {
  return apiFetch(productPath(`/${id}/stock-settings`), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateProductPricing(id: string, payload: Record<string, unknown>): Promise<{ product: Product; pricing: ProductSettings["pricing"]; validation: ProductValidationResult }> {
  return apiFetch(productPath(`/${id}/pricing`), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateProductMarketplace(id: string, payload: Record<string, unknown>): Promise<{ product: Product; marketplace: ProductSettings["marketplace"]; validation: ProductValidationResult }> {
  return apiFetch(productPath(`/${id}/marketplace`), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function listProductDocuments(id: string): Promise<ProductFiscalDocumentItem[]> {
  const res = await apiFetch<ProductDocumentsResponse>(productPath(`/${id}/documents`));
  return res.data;
}
