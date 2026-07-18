"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createFiscalExport, downloadFiscalExport, listAccountantCompanies, listFiscalBookPreparations, listFiscalExports, validateFiscalExport, type AccountantCompany, type FiscalBookPreparationSummary, type FiscalExport } from "@/lib/services/accountant-documents-service";

const can = (company: AccountantCompany | null, action: "read" | "generate" | "download") => company?.accessLevel === "FULL" || !!company?.permissions.includes(`fiscal.export.${action}`);

export function FiscalExportsView() {
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<AccountantCompany | null>(null);
  const [selectedPreparationId, setSelectedPreparationId] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const companies = useQuery({ queryKey: ["accountant", "companies"], queryFn: listAccountantCompanies });
  const company = selectedCompany ?? companies.data?.data[0] ?? null;
  const preparations = useQuery({ queryKey: ["fiscal-exports", "preparations", company?.company.id], queryFn: () => listFiscalBookPreparations({ companyId: company!.company.id, officeId: company!.office.id }), enabled: !!company });
  const exports = useQuery({ queryKey: ["fiscal-exports", company?.company.id], queryFn: () => listFiscalExports({ companyId: company!.company.id, officeId: company!.office.id }), enabled: !!company && can(company, "read") });
  const validate = useMutation({ mutationFn: () => validateFiscalExport({ companyId: company!.company.id, officeId: company!.office.id, preparationId: selectedPreparationId }), onSuccess: () => setValidation("Pré-escrituração pronta para conferência."), onError: (error: Error) => setValidation(error.message) });
  const generate = useMutation({ mutationFn: (type: FiscalExport["type"]) => createFiscalExport({ companyId: company!.company.id, officeId: company!.office.id, preparationId: selectedPreparationId, type }), onSuccess: () => { setValidation("Arquivo local gerado com sucesso."); queryClient.invalidateQueries({ queryKey: ["fiscal-exports"] }); }, onError: (error: Error) => setValidation(error.message) });
  const readyPreparations = (preparations.data?.data as FiscalBookPreparationSummary[] | undefined)?.filter((item) => item.status === "READY") ?? [];

  return <>
    <PageHeader eyebrow="Contabilidade" title="Exportações fiscais" description="Arquivo gerado para conferência. Não há transmissão automática à SEFAZ." />
    <Card className="mb-4 space-y-3 p-4">
      {!company ? "Nenhuma empresa liberada." : <>
        <select value={`${company.office.id}:${company.company.id}`} onChange={(event) => { setSelectedCompany(companies.data?.data.find((item) => `${item.office.id}:${item.company.id}` === event.target.value) ?? null); setSelectedPreparationId(""); }}>
          {companies.data?.data.map((item) => <option key={item.company.id} value={`${item.office.id}:${item.company.id}`}>{item.company.tradeName || item.company.legalName}</option>)}
        </select>
        <select value={selectedPreparationId} onChange={(event) => setSelectedPreparationId(event.target.value)}><option value="">Selecione pré-escrituração READY</option>{readyPreparations.map((item) => <option key={item.id} value={item.id}>{item.periodMonth}/{item.periodYear} · {item.documentsCount} documentos</option>)}</select>
        <div className="flex flex-wrap gap-2"><Button disabled={!selectedPreparationId || !can(company, "generate")} onClick={() => validate.mutate()}>Validar</Button><Button disabled={!selectedPreparationId || !can(company, "generate")} onClick={() => generate.mutate("SPED_FISCAL")}>Gerar SPED Fiscal</Button><Button disabled={!selectedPreparationId || !can(company, "generate")} variant="outline" onClick={() => generate.mutate("SINTEGRA")}>Gerar SINTEGRA</Button></div>
        {validation && <p role="status">{validation}</p>}
      </>}
    </Card>
    <Card className="p-4"><h2 className="mb-3 font-semibold">Histórico</h2>{exports.isLoading ? "Carregando…" : exports.isError ? <Button onClick={() => exports.refetch()}>Tentar novamente</Button> : !exports.data?.data.length ? "Nenhuma geração local." : <div className="space-y-2">{exports.data.data.map((item) => <div className="flex flex-wrap items-center gap-2 border-b py-2" key={item.id}><Badge>{item.type}</Badge><span>{item.periodMonth}/{item.periodYear}</span><span className="text-xs">{item.contentHash}</span><span>{new Date(item.generatedAt).toLocaleString("pt-BR")}</span><Badge>{item.status}</Badge><Button size="sm" disabled={!can(company, "download")} onClick={() => downloadFiscalExport({ companyId: company!.company.id, officeId: company!.office.id, exportId: item.id, fileName: item.fileName })}>Download</Button></div>)}</div>}</Card>
  </>;
}
