"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  FileBarChart,
  FileCheck2,
  FileText,
  KeyRound,
  ShieldAlert,
  Truck,
} from "lucide-react";
import Link from "next/link";

import {
  ClosingStatusDonut,
  MonthlyRevenueChart,
  TaxDonut,
} from "@/components/dashboard/dashboard-charts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompanyId } from "@/lib/api";
import { getDashboard } from "@/lib/services/dashboard-service";
import { formatCurrency, formatDate, maskCnpj } from "@/lib/utils";

const pendingLabels: Record<string, string> = {
  FULL_XML_MISSING: "XMLs de entrada faltando",
  DOCUMENT_REJECTED: "Notas rejeitadas",
  CERTIFICATE_EXPIRING: "Certificados vencendo",
  PRODUCT_NCM_MISSING: "Produtos sem NCM",
  TAX_RULE_MISSING: "Regras tributárias ausentes",
  CTE_WITHOUT_NFE: "CT-e sem NF-e vinculada",
};

export function DashboardView() {
  const companyId = getCompanyId();
  const query = useQuery({
    queryKey: ["accounting-dashboard", companyId],
    queryFn: () => getDashboard(companyId ?? ""),
    enabled: Boolean(companyId),
    refetchInterval: 60_000,
  });
  if (query.isLoading) {
    return <div className="h-[760px] animate-pulse rounded-2xl bg-white/60" />;
  }
  if (!query.data) {
    return <Card className="grid min-h-96 place-items-center p-8 text-center"><div><AlertTriangle className="mx-auto h-8 w-8 text-amber-500" /><p className="mt-4 text-sm font-extrabold">Dashboard indisponível</p><Button className="mt-4" variant="lime" onClick={() => query.refetch()}>Tentar novamente</Button></div></Card>;
  }
  const { portfolio, fiscal, taxes, monthly, alerts } = query.data;
  const kpis = [
    { label: "Empresas atendidas", value: portfolio.kpis.companies, detail: "CNPJs ativos", icon: Building2, tone: "bg-violet-50 text-violet-700" },
    { label: "Prontas para fechamento", value: portfolio.kpis.ready, detail: "revisadas no mês", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Com pendências", value: portfolio.kpis.pending, detail: "exigem conferência", icon: AlertTriangle, tone: "bg-amber-50 text-amber-600" },
    { label: "Notas rejeitadas", value: portfolio.kpis.rejectedNotes, detail: "no período atual", icon: ShieldAlert, tone: "bg-red-50 text-red-600" },
    { label: "Certificados vencendo", value: portfolio.kpis.expiringCertificates, detail: "próximos 30 dias", icon: KeyRound, tone: "bg-blue-50 text-blue-600" },
    { label: "Imposto previsto (mês)", value: formatCurrency(portfolio.kpis.estimatedTax), detail: "estimativa das empresas", icon: CircleDollarSign, tone: "bg-teal-50 text-teal-600" },
  ];
  const miniModules = [
    ["Empresas", "/companies", Building2, "Cadastros e configuração fiscal"],
    ["Pendências", "/alerts", ShieldAlert, "Alertas para conferência"],
    ["Fechamento mensal", "/reports/monthly-closing", Calculator, "Gerar e aprovar período"],
    ["XMLs", "/documents", FileText, "Entradas, saídas e CT-e"],
    ["Impostos previstos", "/reports/accounting", CircleDollarSign, "Apuração estimada"],
    ["Relatórios", "/reports/accounting", FileBarChart, "Exportações contábeis"],
  ] as const;
  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((item) => (
          <Card key={item.label} className="min-h-[100px] p-4">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.tone}`}><item.icon className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="text-[10px] font-bold">{item.label}</p><p className="mt-1.5 truncate text-xl font-extrabold">{item.value}</p><p className="mt-2 text-[9px] font-semibold text-subtle">{item.detail}</p></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-3.5 2xl:grid-cols-12">
        <Card className="overflow-hidden 2xl:col-span-6">
          <SectionTitle title="Visão geral das empresas" href="/companies" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[9px]">
              <thead className="bg-muted/70 font-extrabold text-subtle"><tr><th className="px-4 py-2.5">Empresa</th><th className="px-3 py-2.5">Faturamento (mês)</th><th className="px-3 py-2.5">Imposto previsto</th><th className="px-3 py-2.5">Pendências</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Atualização</th></tr></thead>
              <tbody>{portfolio.companies.slice(0, 6).map((company) => <tr key={company.id} className="border-t border-line"><td className="px-4 py-3"><Link href={`/companies/${company.id}/edit`} className="font-extrabold hover:underline">{company.tradeName || company.legalName}</Link><p className="mt-0.5 text-[8px] text-subtle">{maskCnpj(company.cnpj)}</p></td><td className="px-3 py-3 font-bold">{formatCurrency(company.revenue)}</td><td className="px-3 py-3 font-bold">{formatCurrency(company.estimatedTax)}</td><td className={`px-3 py-3 font-extrabold ${company.pendingCount ? "text-red-500" : ""}`}>{company.pendingCount}</td><td className="px-3 py-3"><ClosingBadge status={company.closingStatus} /></td><td className="px-3 py-3 text-subtle">{company.lastSyncAt ? formatDate(company.lastSyncAt, true) : "Nunca"}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Card className="p-4 2xl:col-span-3"><h2 className="text-xs font-extrabold">Imposto previsto (mês)</h2><TaxDonut data={taxes.data} total={taxes.total} /><p className="text-center text-[9px] text-subtle">Estimativa para conferência. Não definitiva.</p></Card>
        <Card className="overflow-hidden 2xl:col-span-3">
          <SectionTitle title="Pendências por tipo" href="/alerts" />
          <div>{portfolio.pendingByType.length ? portfolio.pendingByType.map((item) => <Link href="/alerts" key={item.type} className="flex items-center border-t border-line px-4 py-3 text-[10px] first:border-0"><span className="flex-1 font-bold">{pendingLabels[item.type] || item.type.replaceAll("_", " ")}</span><span className="rounded-full bg-red-50 px-2 py-1 font-extrabold text-red-600">{item.count}</span><ArrowRight className="ml-2 h-3 w-3 text-subtle" /></Link>) : <p className="p-8 text-center text-xs text-subtle">Nenhuma pendência aberta.</p>}</div>
        </Card>
      </div>

      <div className="grid gap-3.5 2xl:grid-cols-12">
        <Card className="p-4 2xl:col-span-4"><h2 className="text-xs font-extrabold">Faturamento dos últimos 6 meses</h2><MonthlyRevenueChart data={monthly} /></Card>
        <Card className="p-4 2xl:col-span-3"><h2 className="text-xs font-extrabold">Empresas por status de fechamento</h2><ClosingStatusDonut ready={portfolio.kpis.ready} pending={portfolio.kpis.pending} total={portfolio.kpis.companies} /></Card>
        <Card className="overflow-hidden 2xl:col-span-5">
          <SectionTitle title="Alertas importantes" href="/alerts" />
          <div>{alerts.length ? alerts.map((alert) => <Link key={alert.id} href={alert.fiscalDocumentId ? `/documents/${alert.fiscalDocumentId}` : "/alerts"} className="flex items-start gap-3 border-t border-line px-4 py-3 first:border-0"><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.severity === "high" ? "text-red-500" : "text-amber-500"}`} /><span className="flex-1 text-[10px]"><strong>{alert.title}</strong><span className="mt-0.5 block text-subtle">{alert.message}</span></span><span className="text-[8px] text-subtle">{formatDate(alert.createdAt, true)}</span></Link>) : <p className="p-8 text-center text-xs text-subtle">Nenhum alerta importante.</p>}</div>
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line"><SummaryMini icon={FileCheck2} label="NF-e entrada" value={`${fiscal.inbound.count} · ${formatCurrency(fiscal.inbound.total)}`} /><SummaryMini icon={FileText} label="NF-e saída" value={`${fiscal.outbound.count} · ${formatCurrency(fiscal.outbound.total)}`} /><SummaryMini icon={Truck} label="CT-e entrada" value={`${fiscal.cteInbound.count} · ${formatCurrency(fiscal.cteInbound.total)}`} /><SummaryMini icon={Truck} label="CT-e saída" value={`${fiscal.cteOutbound.count} · ${formatCurrency(fiscal.cteOutbound.total)}`} /></div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {miniModules.map(([title, href, Icon, description]) => <Link href={href} key={title}><Card className="group min-h-[130px] p-4 transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-pastel-purple text-violet-700"><Icon className="h-4 w-4" /></span><ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-1" /></div><p className="mt-5 text-xs font-extrabold">{title}</p><p className="mt-1 text-[9px] text-subtle">{description}</p></Card></Link>)}
      </div>
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return <div className="flex items-center justify-between border-b border-line px-4 py-3.5"><h2 className="text-xs font-extrabold">{title}</h2><Link href={href} className="text-[9px] font-extrabold text-blue-600">Ver todos</Link></div>;
}

function ClosingBadge({ status }: { status: string }) {
  const ready = ["READY_FOR_REVIEW", "APPROVED"].includes(status);
  return <span className={`rounded-md px-2 py-1 text-[8px] font-extrabold ${ready ? "bg-emerald-50 text-emerald-700" : status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"}`}>{ready ? "Pronto" : status === "PENDING" ? "Pendente" : "Revisar"}</span>;
}

function SummaryMini({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return <div className="bg-white p-3"><Icon className="h-3.5 w-3.5 text-subtle" /><p className="mt-2 text-[8px] font-bold text-subtle">{label}</p><p className="mt-1 text-[10px] font-extrabold">{value}</p></div>;
}
