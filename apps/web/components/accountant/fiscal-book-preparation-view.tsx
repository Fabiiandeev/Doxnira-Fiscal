"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createFiscalBookPreparation,
  getFiscalBookPreparation,
  listAccountantCompanies,
  listAccountantMonthlyClosings,
  listFiscalBookPreparations,
  updateFiscalBookIssue,
  type AccountantCompany,
} from "@/lib/services/accountant-documents-service";

type FiscalBookPreparation = {
  id: string;
  documentsCount: number;
  itemsCount: number;
  issuesCount: number;
  blockingIssuesCount: number;
  status: string;
};

type FiscalBookIssue = {
  id: string;
  severity: string;
  code: string;
  message: string;
  recommendation: string | null;
  status: string;
};

type FiscalBookPreparationDetail = FiscalBookPreparation & {
  issues: FiscalBookIssue[];
  preview?: Record<string, unknown>;
};

type IssueAction = "resolve" | "ignore";

const can = (company: AccountantCompany | null, permission: string) =>
  company?.accessLevel === "FULL" || !!company?.permissions.includes(permission);

export function FiscalBookPreparationView() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AccountantCompany | null>(null);
  const [tab, setTab] = useState("Resumo");
  const companies = useQuery({ queryKey: ["accountant", "companies"], queryFn: listAccountantCompanies });
  const company = selected ?? companies.data?.data[0] ?? null;
  const closings = useQuery({
    queryKey: ["closings", company?.company.id],
    queryFn: () => listAccountantMonthlyClosings({ companyId: company!.company.id, officeId: company!.office.id }),
    enabled: !!company,
  });
  const preparations = useQuery({
    queryKey: ["books", company?.company.id],
    queryFn: () => listFiscalBookPreparations({ companyId: company!.company.id, officeId: company!.office.id }),
    enabled: !!company,
  });
  const preparation = preparations.data?.data[0] as FiscalBookPreparation | undefined;
  const detail = useQuery({
    queryKey: ["book", preparation?.id],
    queryFn: () => getFiscalBookPreparation({ companyId: company!.company.id, officeId: company!.office.id, preparationId: preparation!.id }),
    enabled: !!company && !!preparation,
  });
  const detailData = detail.data as FiscalBookPreparationDetail | undefined;
  const create = useMutation({
    mutationFn: (closingId: string) => createFiscalBookPreparation({ companyId: company!.company.id, officeId: company!.office.id, closingId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
  const issue = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: IssueAction; reason?: string }) =>
      updateFiscalBookIssue({ companyId: company!.company.id, officeId: company!.office.id, preparationId: preparation!.id, issueId: id, action, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["book", preparation?.id] }),
  });

  const summaryCards: Array<{ label: string; value: string | number }> = preparation
    ? [
        { label: "Documentos", value: preparation.documentsCount },
        { label: "Itens", value: preparation.itemsCount },
        { label: "Issues", value: preparation.issuesCount },
        { label: "Bloqueantes", value: preparation.blockingIssuesCount },
        { label: "Status", value: preparation.status },
      ]
    : [];

  return (
    <>
      <PageHeader eyebrow="Contabilidade" title="Pré-escrituração fiscal" description="Prévia interna. Não gera arquivo oficial SPED ou SINTEGRA." />
      <Card className="mb-4 p-4">
        {!company ? "Nenhuma empresa liberada." : <>
          <select value={`${company.office.id}:${company.company.id}`} onChange={(event) => setSelected(companies.data?.data.find((item) => `${item.office.id}:${item.company.id}` === event.target.value) ?? null)}>
            {companies.data?.data.map((item) => <option key={item.company.id} value={`${item.office.id}:${item.company.id}`}>{item.company.tradeName || item.company.legalName}</option>)}
          </select>
          {closings.data?.data.filter((closing) => closing.status === "APPROVED").map((closing) => <Button key={closing.id} size="sm" disabled={!can(company, "fiscal.book_preparation.create")} onClick={() => create.mutate(closing.id)}>Preparar {closing.periodMonth}/{closing.periodYear}</Button>)}
        </>}
      </Card>
      {preparations.isLoading ? <Card className="p-6">Carregando…</Card> : !preparation ? <Card className="p-6">Nenhuma pré-escrituração. Selecione um fechamento aprovado.</Card> : <>
        <div className="grid gap-3 md:grid-cols-5">
          {summaryCards.map((card) => <Card key={card.label} className="p-3"><p>{card.label}</p><b>{String(card.value)}</b></Card>)}
        </div>
        <div className="my-4 flex gap-2">
          {["Resumo", "Prévia SPED", "Prévia SINTEGRA", "Inconsistências"].map((item) => <Button key={item} size="sm" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item}</Button>)}
        </div>
        <Card className="p-4">
          {detail.isLoading ? "Carregando detalhes…" : detail.isError ? <Button onClick={() => detail.refetch()}>Tentar novamente</Button> : tab === "Inconsistências" ? detailData?.issues.map((item) => <div key={item.id} className="border-b p-3">
            <Badge>{item.severity}</Badge><b className="ml-2">{item.code}</b><p>{item.message}</p><p>{item.recommendation}</p>
            {item.status === "OPEN" && <>
              <Button size="sm" disabled={!can(company, "fiscal.book_preparation.manage_issues")} onClick={() => issue.mutate({ id: item.id, action: "resolve" })}>Resolver</Button>
              {item.severity !== "BLOCKING" && <Button size="sm" variant="outline" disabled={!can(company, "fiscal.book_preparation.manage_issues")} onClick={() => { const reason = prompt("Justificativa"); if (reason) issue.mutate({ id: item.id, action: "ignore", reason }); }}>Ignorar</Button>}
            </>}
          </div>) : <pre className="overflow-auto text-xs">{JSON.stringify(detailData, null, 2)}</pre>}
        </Card>
      </>}
    </>
  );
}
