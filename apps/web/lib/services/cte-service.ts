import { apiFetch, getCompanyId } from "@/lib/api";

export interface TransportDocument {
  id: string;
  accessKey: string;
  number: string | null;
  series: string | null;
  emissionDate: string | null;
  issuerCnpj: string | null;
  issuerName: string | null;
  recipientCnpj: string | null;
  recipientName: string | null;
  totalAmount: number;
  status: string | null;
  _count?: { nfeLinks: number };
}

function companyId() {
  const id = getCompanyId();
  if (!id) throw new Error("Selecione uma empresa.");
  return id;
}

export function getLinkedCte(documentId: string) {
  return apiFetch<{ data: Array<{ id: string; cteDocument: TransportDocument }> }>(
    `/companies/${companyId()}/documents/${documentId}/linked-cte`,
  );
}

export function getCte(cteId: string) {
  return apiFetch<TransportDocument>(`/companies/${companyId()}/cte/${cteId}`);
}

export function getLinkedNfe(cteId: string) {
  return apiFetch<{
    data: Array<{
      id: string;
      nfeAccessKey: string;
      nfeDocument: {
        id: string;
        invoiceNumber: string | null;
        issuerName: string | null;
        emissionDate: string | null;
        totalAmount: number;
        status: string | null;
      } | null;
    }>;
  }>(`/companies/${companyId()}/cte/${cteId}/linked-nfe`);
}

export function getCteXml(cteId: string) {
  return apiFetch<{ id: string; accessKey: string; xml: string; hash: string }>(
    `/companies/${companyId()}/cte/${cteId}/xml`,
  );
}
