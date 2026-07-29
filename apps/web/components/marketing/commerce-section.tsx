"use client";

import {
  BarChart3,
  Box,
  Check,
  CircleDollarSign,
  ClipboardList,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  Megaphone,
  PieChart,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMMERCE_MODULES,
  COMMERCE_MODULE_STATUS,
  type CommerceModuleDefinition,
  type CommerceModuleStatus as TStatus,
} from "@/helpers/commerce-module-status";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<TStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  AVAILABLE: "success",
  BETA: "info",
  PLANNED: "warning",
  FUTURE: "neutral",
};

const moduleIcons = {
  dashboard: LayoutDashboard,
  products: Box,
  ads: Megaphone,
  orders: ClipboardList,
  pricing: CircleDollarSign,
  margins: PieChart,
  competition: Target,
  opportunities: Rocket,
  marketplaces: Globe2,
} as const;

const iconTones = {
  dashboard: "bg-violet-100 text-violet-600",
  products: "bg-emerald-100 text-emerald-600",
  ads: "bg-blue-100 text-blue-600",
  orders: "bg-orange-100 text-orange-600",
  pricing: "bg-teal-100 text-teal-600",
  margins: "bg-violet-100 text-violet-600",
  competition: "bg-orange-100 text-orange-600",
  opportunities: "bg-amber-100 text-amber-600",
  marketplaces: "bg-blue-100 text-blue-600",
} as const;

const differentiators = [
  "100% integrado ao Doxnira Fiscal",
  "Cálculo de impostos em tempo real",
  "Emissão automática de NF-e",
  "Validação fiscal preventiva",
  "Estoque unificado e inteligente",
  "IA aplicada em todo o processo",
  "Dados oficiais dos marketplaces",
  "Auditoria e logs completos",
  "Multiempresa e multicontas",
];

function ModulePreview({ code }: { code: CommerceModuleDefinition["code"] }) {
  if (code === "marketplaces") {
    return (
      <div className="space-y-2">
        {["Mercado Livre", "Shopee", "Amazon"].map((name, index) => (
          <div key={name} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-2 text-[10px] font-bold">
            <span>{name}</span>
            <span className={index === 0 ? "text-emerald-600" : "text-subtle"}>
              {index === 0 ? "Disponível" : "Em breve"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (code === "orders") {
    return (
      <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
        {["Novo", "Aprovado", "Enviado", "Entregue"].map((label, index) => (
          <div key={label}><span className="text-subtle">{label}</span><div className={cn("mt-2 h-8 rounded-lg", ["bg-orange-100", "bg-amber-100", "bg-blue-100", "bg-emerald-100"][index])} /></div>
        ))}
      </div>
    );
  }

  if (code === "pricing") {
    return (
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded-lg bg-white p-2"><span className="text-subtle">Preço atual</span><div className="mt-1 h-2 w-16 rounded bg-slate-200" /></div>
        <div className="rounded-lg bg-emerald-50 p-2"><span className="text-emerald-700">Preço sugerido</span><div className="mt-1 h-2 w-16 rounded bg-emerald-300" /></div>
        <div className="rounded-lg bg-white p-2"><span className="text-subtle">Margem atual</span><div className="mt-1 h-2 w-10 rounded bg-slate-200" /></div>
        <div className="rounded-lg bg-emerald-50 p-2"><span className="text-emerald-700">Nova margem</span><div className="mt-1 h-2 w-12 rounded bg-emerald-300" /></div>
      </div>
    );
  }

  if (code === "ads" || code === "opportunities") {
    return (
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[7px] border-emerald-500 border-r-emerald-100 text-base font-extrabold text-emerald-700">IA</div>
        <div className="flex-1 space-y-2">{["Análise", "Melhorias", "Oportunidades"].map((item) => <div key={item} className="flex items-center justify-between text-[9px]"><span>{item}</span><Check className="h-3 w-3 text-emerald-600" /></div>)}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {[65, 82, 54].map((width, index) => <div key={width} className="rounded-lg bg-white p-2"><div className="h-1.5 rounded bg-slate-200" /><div className={cn("mt-2 h-2 rounded", index === 2 ? "bg-orange-300" : "bg-emerald-300")} style={{ width: `${width}%` }} /></div>)}
      </div>
      <div className="mt-3 flex h-10 items-end gap-1">
        {[10, 22, 15, 30, 18, 34, 27, 40, 24, 36, 30].map((height, index) => <span key={`${height}-${index}`} className="flex-1 rounded-t bg-violet-400" style={{ height }} />)}
      </div>
    </div>
  );
}

export function CommerceSection() {
  const [active, setActive] = useState<CommerceModuleDefinition | null>(null);

  return (
    <section id="commerce" className="scroll-mt-24 bg-surface-muted px-3 py-12 md:px-6 md:py-20">
      <div className="mx-auto max-w-[1500px] rounded-[28px] border border-violet-100 bg-white p-5 shadow-[0_18px_55px_rgba(63,52,115,0.10)] md:p-7">
        <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-28 w-28 shrink-0 place-items-center rounded-[24px] bg-gradient-to-br from-violet-400 to-indigo-600 shadow-lg shadow-indigo-200">
              <ShoppingCart className="h-14 w-14 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-ink md:text-5xl">
                Módulo <span className="text-indigo-600">Commerce</span>
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-ink-soft md:text-lg">
                Inteligência, operação e lucro para escalar suas vendas nos maiores marketplaces.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-indigo-700"><Sparkles className="h-4 w-4" />Dados reais • IA • Automação • Fiscal</span>
                <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><ShieldCheck className="h-4 w-4" />100% integrado ao Doxnira Fiscal</span>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-y divide-line rounded-2xl border border-line bg-white p-3 sm:grid-cols-4 sm:divide-y-0">
            {[
              [LayoutDashboard, "9", "Módulos principais"],
              [Globe2, "3+", "Marketplaces integrados"],
              [PieChart, "360°", "Visão completa do negócio"],
              [ShieldCheck, "1", "Plataforma unificada"],
            ].map(([Icon, value, label]) => (
              <div key={String(label)} className="px-3 py-4 text-center">
                <Icon className="mx-auto h-6 w-6 text-indigo-600" />
                <dd className="mt-2 text-3xl font-extrabold text-ink">{String(value)}</dd>
                <dt className="mt-1 text-[11px] font-semibold leading-4 text-ink-soft">{String(label)}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-7 grid gap-3 xl:grid-cols-5">
          {COMMERCE_MODULES.slice(0, 5).map((mod) => <CommerceModuleCard key={mod.code} mod={mod} setActive={setActive} />)}
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.08fr]">
          {COMMERCE_MODULES.slice(5).map((mod) => <CommerceModuleCard key={mod.code} mod={mod} setActive={setActive} />)}
          <aside className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50">
            <div className="p-5">
              <h3 className="flex items-center gap-2 font-extrabold text-indigo-800"><ShieldCheck className="h-5 w-5" />Diferenciais Doxnira Commerce</h3>
              <ul className="mt-4 space-y-2">
                {differentiators.map((item) => <li key={item} className="flex gap-2 text-[11px] font-semibold text-indigo-950"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />{item}</li>)}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
              <p className="flex items-center gap-2 text-lg font-extrabold"><Sparkles className="h-5 w-5" />Tudo o que você precisa, em um só lugar.</p>
              <p className="mt-2 text-xs text-violet-100">Mais controle, mais lucro, menos retrabalho.</p>
            </div>
          </aside>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-gradient-to-r from-violet-100/80 to-violet-50 px-5 py-3 text-xs font-semibold text-indigo-950">
          <LockKeyhole className="h-4 w-4 text-indigo-600" />Segurança de dados <span>•</span> LGPD <span>•</span> Criptografia <span>•</span> Backups automáticos <span>•</span> Infraestrutura em nuvem
        </div>
      </div>

      <Dialog open={Boolean(active)} onOpenChange={(open) => { if (!open) setActive(null); }}>
        <DialogContent>
          {active && <><DialogTitle>{active.title}</DialogTitle><p className="mt-2 text-sm text-ink-soft">{active.summary}</p><ul className="mt-4 space-y-2">{active.details.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-ink"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul><div className="mt-5 flex items-center justify-between"><Badge variant={STATUS_TONE[active.status]}>{COMMERCE_MODULE_STATUS[active.status]}</Badge><DialogClose asChild><button type="button" className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink">Fechar</button></DialogClose></div></>}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CommerceModuleCard({ mod, setActive }: { mod: CommerceModuleDefinition; setActive: (value: CommerceModuleDefinition) => void }) {
  const Icon = moduleIcons[mod.code as keyof typeof moduleIcons] ?? BarChart3;
  return (
    <button type="button" onClick={() => { trackMarketingEvent("marketing.commerce_module_opened", { module: mod.code }); setActive(mod); }} className="flex min-h-[290px] flex-col rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-card" data-testid={`commerce-card-${mod.code}`} aria-label={`Abrir detalhes do módulo ${mod.title}`}>
      <div className="flex items-center gap-3"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", iconTones[mod.code as keyof typeof iconTones])}><Icon className="h-5 w-5" /></span><h3 className="font-extrabold text-ink">{mod.title}</h3></div>
      <ul className="mt-4 min-h-[92px] space-y-1.5">{mod.details.slice(0, 4).map((item) => <li key={item} className="text-[11px] leading-4 text-ink-soft">• {item}</li>)}</ul>
      <div className="mt-auto rounded-xl border border-line bg-slate-50 p-3"><ModulePreview code={mod.code} /></div>
    </button>
  );
}
