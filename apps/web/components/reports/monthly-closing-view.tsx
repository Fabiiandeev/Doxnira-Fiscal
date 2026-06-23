"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Download, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  closingAction,
  createMonthlyClosing,
  downloadFiscalReport,
  listMonthlyClosings,
  repairTaxSettings,
} from "@/lib/services/tax-service";
import { getCompany } from "@/lib/services/company-service";
import { getCompanyId } from "@/lib/api";
import type { MonthlyClosing } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function MonthlyClosingView() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const queryClient = useQueryClient();
  const companyId = getCompanyId();
  const companyQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId!),
    enabled: Boolean(companyId),
  });
  const query = useQuery({
    queryKey: ["monthly-closing", year, month],
    queryFn: () => listMonthlyClosings(year, month),
  });
  const closing = query.data?.data[0];
  const hasStateRegistration = Boolean(
    companyQuery.data?.stateRegistration ||
      companyQuery.data?.stateRegistrationFormatted,
  );
  const iePending =
    hasStateRegistration &&
    (companyQuery.data?.stateRegistrationStatus ===
      "PENDENTE_VALIDACAO_SEFAZ" ||
      companyQuery.data?.icmsContributorStatus ===
        "PENDENTE_VALIDACAO_SEFAZ");
  const generate = useMutation({
    mutationFn: () => createMonthlyClosing(year, month),
    onSuccess: () => {
      notify({ title: "Fechamento calculado", description: "Pronto para conferência do contador." });
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] });
    },
    onError: (error) => handleSmartError(error),
  });
  const repair = useMutation({
    mutationFn: () => repairTaxSettings(companyId!),
    onSuccess: () => {
      notify({ title: "Configuração fiscal criada", description: "Tente gerar o fechamento novamente." });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] });
    },
    onError: (error) =>
      notify({ title: "Correção automática falhou", description: error.message, tone: "error" }),
  });
  const action = useMutation({
    mutationFn: ({ id, name }: { id: string; name: "recalculate" | "approve" | "reopen" }) =>
      closingAction(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["monthly-closing"] }),
    onError: (error) => handleSmartError(error),
  });
  const groups = useMemo(() => {
    const items = closing?.items || [];
    return {
      inbound: items.filter((item) => item.category === "INBOUND"),
      outbound: items.filter((item) => item.category === "OUTBOUND"),
      cteInbound: items.filter((item) => item.category === "TRANSPORT_INBOUND"),
      cteOutbound: items.filter((item) => item.category === "TRANSPORT_OUTBOUND"),
      unknown: items.filter((item) => !["INBOUND", "OUTBOUND", "TRANSPORT_INBOUND", "TRANSPORT_OUTBOUND"].includes(item.category)),
      ignored: closing?.ignoredDocuments || 0,
    };
  }, [closing]);

  function handleSmartError(error: { code?: string; message?: string }) {
    // allow passing ApiError-like objects
    if (["TAX_SETTINGS_REQUIRED", "FISCAL_CONFIG_MISSING_UF"].includes(error.code || "")) {
      repair.mutate();
      return;
    }
    if (error.code === "STATE_REGISTRATION_VALIDATION_REQUIRED") {
      router.push(`/companies/${companyId}/edit`);
      return;
    }
    notify({ title: "Fechamento não concluído", description: error.message, tone: "error" });
  }

  return (
    <>
      <PageHeader
        eyebrow="Fechamento assistido"
        title="Fechamento fiscal mensal"
        description="Conferência baseada apenas em documentos REAL_SEFAZ, MANUAL_IMPORT ou ERP_IMPORT."
        icon={Calculator}
        action={
          <div className="flex flex-wrap gap-2">
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="h-10 rounded-xl border border-line bg-white px-3 text-xs font-bold">
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2026, index, 1))}</option>)}
            </select>
            <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 w-24 rounded-xl border border-line bg-white px-3 text-xs font-bold" />
            <Button variant="lime" onClick={() => generate.mutate()} disabled={generate.isPending || iePending}>
              {generate.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Gerar fechamento
            </Button>
          </div>
        }
      />

      {(generate.error || action.error) && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-extrabold">Fechamento requer atenção</p>
                <p className="mt-1 text-xs">{generate.error?.message || action.error?.message}</p>
                <p className="mt-1 text-[10px] font-bold text-amber-700">código: {(generate.error as unknown as { code?: string })?.code || (action.error as unknown as { code?: string })?.code}</p>
              </div>
            </div>
              <Button variant="outline" size="sm" onClick={() => handleSmartError((generate.error as unknown as { code?: string; message?: string }) || (action.error as unknown as { code?: string; message?: string }))}>Corrigir automaticamente</Button>
          </div>
        </Card>
      )}
      {iePending && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-extrabold">Fechamento bloqueado</p>
              <p className="mt-1 text-xs">
                A Inscrição Estadual da empresa selecionada precisa ser validada na SEFAZ/SINTEGRA.
              </p>
            </div>
          </div>
        </Card>
      )}
      {!closing ? (
        <Card className="grid min-h-72 place-items-center p-8 text-center">
          <div><Calculator className="mx-auto h-8 w-8 text-subtle" /><p className="mt-4 text-sm font-extrabold">Nenhum fechamento para o período</p><p className="mt-2 text-xs text-subtle">Configure a empresa e gere o fechamento mensal.</p></div>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ClosingMetric label="Entradas" value={formatCurrency(closing.inboundTotal)} />
            <ClosingMetric label="Saídas" value={formatCurrency(closing.outboundTotal)} />
            <ClosingMetric label="Fretes CT-e" value={formatCurrency(closing.freightTotal)} />
            <ClosingMetric label="Impostos estimados" value={formatCurrency(closing.estimatedTaxTotal)} />
            <ClosingMetric label="Status" value={statusLabel(closing.status)} />
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
              <Badge variant={closing.status === "APPROVED" ? "success" : "warning"}>{statusLabel(closing.status)}</Badge>
              <span className="mr-auto text-[10px] font-bold text-subtle">{closing.includedDocuments} incluídos · {closing.ignoredDocuments} MOCK/SEED ignorados</span>
              <Button size="sm" variant="outline" onClick={() => action.mutate({ id: closing.id, name: "recalculate" })}><RefreshCw className="h-3.5 w-3.5" />Recalcular</Button>
              {closing.status === "APPROVED" ? (
                <Button size="sm" variant="outline" onClick={() => action.mutate({ id: closing.id, name: "reopen" })}><RotateCcw className="h-3.5 w-3.5" />Reabrir</Button>
              ) : (
                <Button size="sm" variant="lime" onClick={() => action.mutate({ id: closing.id, name: "approve" })}><ShieldCheck className="h-3.5 w-3.5" />Aprovar</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => downloadFiscalReport("monthly-closing", "csv", { closingId: closing.id })}><Download className="h-3.5 w-3.5" />CSV</Button>
              <Button size="sm" variant="ghost" onClick={() => downloadFiscalReport("monthly-closing", "xlsx", { closingId: closing.id })}><Download className="h-3.5 w-3.5" />XLSX</Button>
            </div>
            <div className="p-4 md:p-5">
              <Tabs defaultValue="summary">
                <div className="scrollbar-none overflow-x-auto">
                  <TabsList className="w-max">
                    <TabsTrigger value="summary">Resumo</TabsTrigger>
                    <TabsTrigger value="inbound">NF-e Entrada</TabsTrigger>
                    <TabsTrigger value="outbound">NF-e Saída</TabsTrigger>
                    <TabsTrigger value="cte-inbound">CT-e Entrada</TabsTrigger>
                    <TabsTrigger value="cte-outbound">CT-e Saída</TabsTrigger>
                    <TabsTrigger value="unknown">UNKNOWN</TabsTrigger>
                    <TabsTrigger value="taxes">Impostos</TabsTrigger>
                    <TabsTrigger value="warnings">Alertas</TabsTrigger>
                    <TabsTrigger value="ignored">Documentos ignorados</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="summary"><ClosingTable items={closing.items} /></TabsContent>
                <TabsContent value="inbound"><ClosingTable items={groups.inbound} /></TabsContent>
                <TabsContent value="outbound"><ClosingTable items={groups.outbound} /></TabsContent>
                <TabsContent value="cte-inbound"><ClosingTable items={groups.cteInbound} /></TabsContent>
                <TabsContent value="cte-outbound"><ClosingTable items={groups.cteOutbound} /></TabsContent>
                <TabsContent value="unknown"><ClosingTable items={groups.unknown} /></TabsContent>
                <TabsContent value="taxes"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["ICMS", closing.icmsTotal], ["IPI", closing.ipiTotal], ["PIS", closing.pisTotal], ["COFINS", closing.cofinsTotal]].map(([label, value]) => <ClosingMetric key={String(label)} label={String(label)} value={formatCurrency(Number(value))} />)}</div></TabsContent>
                <TabsContent value="warnings">
                  <div className="space-y-2">
                    {closing.warnings.map((warning) => (
                      <div key={warning.id} className="rounded-xl border border-line p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant={warning.severity === "ERROR" ? "danger" : warning.severity === "WARNING" ? "warning" : "neutral"}>{warning.code}</Badge>
                          <div className="flex-1">
                            <p className="text-xs font-extrabold">{warning.message}</p>
                            {warning.field && <p className="mt-1 text-[10px]"><span className="font-extrabold">Campo:</span> {warning.field}</p>}
                            {warning.cause && <p className="mt-1 text-[10px]"><span className="font-extrabold">Causa:</span> {warning.cause}</p>}
                            {warning.suggestion && <p className="mt-1 text-[10px]"><span className="font-extrabold">Sugestão:</span> {warning.suggestion}</p>}
                            {warning.documentId && <p className="mt-1 text-[10px]"><span className="font-extrabold">Documento:</span> {warning.documentId} {warning.accessKey && <span className="ml-2 font-mono">{warning.accessKey}</span>}</p>}
                          </div>
                          <div className="ml-3 flex-shrink-0">
                            {warning.autoFix?.available ? (
                              <Button size="sm" variant="lime">Corrigir automaticamente</Button>
                            ) : (
                              <Button size="sm" variant="outline">Correção manual necessária</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="ignored"><p className="rounded-xl bg-muted p-5 text-xs font-bold">{groups.ignored} documento(s) MOCK/SEED excluído(s) automaticamente do fechamento.</p></TabsContent>
              </Tabs>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function ClosingMetric({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-[10px] font-bold text-subtle">{label}</p><p className="mt-2 text-lg font-extrabold">{value}</p></Card>;
}

function ClosingTable({ items }: { items: MonthlyClosing["items"] }) {
  return <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[700px] text-left text-[10px]"><thead className="bg-muted text-[9px] font-extrabold uppercase text-subtle"><tr><th className="px-4 py-3">Operação</th><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Chave</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Tributos</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-line"><td className="px-4 py-3 font-extrabold">{item.category}</td><td className="px-4 py-3">{item.source}</td><td className="max-w-64 truncate px-4 py-3 font-mono">{item.accessKey || "—"}</td><td className="px-4 py-3 font-extrabold">{formatCurrency(item.amount)}</td><td className="px-4 py-3">{formatCurrency(item.taxAmount)}</td></tr>)}</tbody></table>{!items.length && <p className="p-8 text-center text-xs text-subtle">Nenhum documento nesta categoria.</p>}</div>;
}

function statusLabel(status: MonthlyClosing["status"]) {
  return {
    DRAFT: "Rascunho",
    PROCESSING: "Processando",
    READY_FOR_REVIEW: "Pronto para revisão",
    APPROVED: "Aprovado",
    REOPENED: "Reaberto",
    ERROR: "Erro",
  }[status];
}
