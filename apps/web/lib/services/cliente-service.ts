import { apiFetch } from "@/lib/api";

export async function buscarCnpj(cnpj: string) {
  return apiFetch(`/clientes/buscar-cnpj?cnpj=${encodeURIComponent(cnpj)}`) as Promise<unknown>;
}

export async function buscarCpf(cpf: string) {
  return apiFetch(`/clientes/buscar-cpf?cpf=${encodeURIComponent(cpf)}`) as Promise<unknown>;
}

export async function salvarCliente(payload: Record<string, unknown>) {
  return apiFetch(`/companies/${String(payload.companyId)}/clientes`, {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<unknown>;
}
