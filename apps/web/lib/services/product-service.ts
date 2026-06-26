import { apiFetch, getCompanyId } from "@/lib/api";

interface Product {
  id: string;
  companyId: string;
  name: string;
  code: string;
  ncm: string | null;
  cest: string | null;
  unit: string;
  price: number;
  stock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductListResponse {
  data: Product[];
}

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

export async function createProduct(
  payload: Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">,
): Promise<Product> {
  const companyId = getCompanyId();
  return apiFetch<Product>(`/companies/${companyId}/products`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(
  id: string,
  payload: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>,
): Promise<Product> {
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

export type { Product };
