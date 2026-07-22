"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { COMMERCE_MODULES, COMMERCE_MODULE_STATUS, type CommerceModuleDefinition, type CommerceModuleStatus as TStatus } from "@/helpers/commerce-module-status";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";

const STATUS_TONE: Record<TStatus, React.ComponentProps<typeof Badge>["variant"]> = { AVAILABLE: "success", BETA: "info", PLANNED: "warning", FUTURE: "neutral" };
const icons: Record<string, string> = { dashboard: "▥", products: "◇", ads: "◆", orders: "▣", pricing: "$", margins: "◔", competition: "◎", opportunities: "➤", marketplaces: "⊕" };

export function CommerceSection() {
  const [active, setActive] = useState<CommerceModuleDefinition | null>(null);
  return (
    <section id="commerce" className="scroll-mt-20 bg-white px-3 py-10 md:px-6">
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[28px] border border-[#d5ceff] bg-gradient-to-br from-[#faf9ff] via-white to-[#f7fff0] p-5 shadow-[0_26px_70px_rgba(74,55,170,0.16)] md:p-7">
        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr_340px]">
          <div className="flex items-center gap-5">
            <div className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-[22px] bg-gradient-to-br from-[#8d7cff] to-[#5238ff] text-4xl text-white shadow-[0_16px_34px_rgba(83,56,255,0.38)]">🛒</div>
            <div><h2 className="text-[32px] font-extrabold tracking-[-0.045em] text-ink md:text-[36px]">Módulo <span className="text-[#5541ff]">Commerce</span></h2><p className="mt-1 max-w-xl text-[15px] font-semibold leading-5 text-ink-soft">Inteligência, operação e lucro para escalar suas vendas nos maiores marketplaces.</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-md bg-[#eeeaff] px-3 py-1.5 text-[10px] font-bold text-[#5541ff]">✦ Dados reais • IA • Automação • Fiscal</span><span className="rounded-md bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">✓ Integrado ao Doxnira Fiscal</span></div></div>
          </div>
          <dl className="grid grid-cols-4 rounded-2xl border border-[#ded9ff] bg-white/95 p-4 shadow-soft">
            {[["9", "Módulos principais"], ["3+", "Marketplaces"], ["360°", "Visão completa"], ["1", "Plataforma"]].map(([value, label]) => <div key={label} className="border-r border-line px-2 text-center last:border-0"><dd className="text-2xl font-extrabold text-ink">{value}</dd><dt className="mt-1.5 text-[10px] font-semibold leading-4 text-ink-soft">{label}</dt></div>)}
          </dl>
          <CommerceDifferentials />
        </div>

        <div className="mt-7">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {COMMERCE_MODULES.map((mod) => (
              <li key={mod.code}>
                <button type="button" onClick={() => { trackMarketingEvent("marketing.commerce_module_opened", { module: mod.code }); setActive(mod); }} className="flex h-full min-h-[238px] w-full flex-col rounded-2xl border border-[#dfdaf5] bg-white p-4 text-left shadow-[0_9px_24px_rgba(45,35,90,0.09)] transition duration-300 hover:-translate-y-1 hover:border-[#8d7cff] hover:shadow-[0_16px_34px_rgba(83,56,255,0.17)]" data-testid={`commerce-card-${mod.code}`} aria-label={`Abrir detalhes do módulo ${mod.title}`}>
                  <div className="flex items-start justify-between gap-3"><h3 className="flex items-center gap-2.5 text-[15px] font-extrabold leading-5 text-ink"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eeeaff] text-base text-[#5541ff]">{icons[mod.code]}</span>{mod.title}</h3><Badge variant={STATUS_TONE[mod.status]} className="px-2 py-0.5 text-[8px]">{COMMERCE_MODULE_STATUS[mod.status]}</Badge></div>
                  <ul className="mt-3 space-y-1">{mod.details.slice(0, 3).map((detail) => <li key={detail} className="text-[11px] leading-4 text-ink-soft">• {detail}</li>)}</ul>
                  <CommerceMiniVisual code={mod.code} status={mod.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Dialog open={Boolean(active)} onOpenChange={(open) => { if (!open) setActive(null); }}>
        <DialogContent>{active && <><DialogTitle>{active.title}</DialogTitle><p className="mt-2 text-sm text-ink-soft">{active.summary}</p><ul className="mt-4 space-y-2">{active.details.map((item) => <li key={item} className="flex gap-2 text-sm text-ink"><span className="text-lime-strong">✓</span>{item}</li>)}</ul><div className="mt-5 flex items-center justify-between"><Badge variant={STATUS_TONE[active.status]}>{COMMERCE_MODULE_STATUS[active.status]}</Badge><DialogClose asChild><button type="button" className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink">Fechar</button></DialogClose></div></>}</DialogContent>
      </Dialog>
    </section>
  );
}

function CommerceDifferentials() {
  return <aside className="rounded-2xl border border-[#ded9ff] bg-white/95 p-4 shadow-soft"><h3 className="text-[13px] font-extrabold text-[#5541ff]">▣ Diferenciais Doxnira Commerce</h3><ul className="mt-2.5 space-y-1">{["100% integrado ao Doxnira Fiscal", "Cálculo de impostos em tempo real", "Emissão automática de NF-e", "Validação fiscal preventiva", "Estoque unificado e inteligente", "IA aplicada em todo o processo", "Dados oficiais dos marketplaces", "Auditoria e logs completos", "Multiempresa e multicontas"].map((item) => <li key={item} className="flex gap-2 text-[10px] font-semibold leading-4 text-ink-soft"><span className="text-green-600">✓</span>{item}</li>)}</ul></aside>;
}

function CommerceMiniVisual({ code, status }: { code: string; status: TStatus }) {
  if (code === "dashboard") return <div className="mt-auto"><div className="grid grid-cols-3 gap-2">{[["Receita", "R$ 247k"], ["Pedidos", "1.206"], ["Lucro", "R$ 60k"]].map(([a,b]) => <div key={a} className="rounded-lg border border-line p-2"><p className="text-[9px] text-subtle">{a}</p><p className="text-xs font-extrabold">{b}</p></div>)}</div><Spark color="#5541ff" /></div>;
  if (code === "products" || code === "margins") return <div className="mt-auto space-y-1.5">{[["Produto A", "R$ 89,90", "32%"], ["Produto B", "R$ 129,90", "26%"], ["Produto C", "R$ 49,90", "18%"]].map((row) => <div key={row[0]} className="grid grid-cols-3 border-b border-line pb-1 text-[10px]"><span>{row[0]}</span><span>{row[1]}</span><span className="text-right font-bold text-green-600">{row[2]}</span></div>)}</div>;
  if (code === "ads" || code === "opportunities") return <div className="mt-auto flex items-center gap-4 rounded-xl bg-muted p-3"><div className="grid h-16 w-16 place-items-center rounded-full border-[6px] border-green-500 text-lg font-extrabold text-green-700">{code === "ads" ? "78" : "82"}</div><div className="grid flex-1 grid-cols-2 gap-2 text-center text-[10px]"><span className="rounded bg-green-50 p-1.5 text-green-700">Alta</span><span className="rounded bg-amber-50 p-1.5 text-amber-600">Média</span><span className="col-span-2 font-bold text-[#5541ff]">Ver análise completa →</span></div></div>;
  if (code === "orders") return <div className="mt-auto grid grid-cols-4 gap-2 text-center">{[["Novo","32"],["Aprovado","18"],["Enviado","45"],["Entregue","128"]].map(([a,b]) => <div key={a}><p className="text-[9px] text-subtle">{a}</p><p className="mt-1.5 rounded-lg bg-muted py-1.5 text-xs font-extrabold">{b}</p></div>)}</div>;
  if (code === "pricing") return <div className="mt-auto grid grid-cols-2 gap-4"><div><p className="text-[9px] text-subtle">Preço atual</p><p className="text-base font-extrabold">R$ 129,90</p><p className="text-[10px] font-bold text-green-600">Margem 22%</p></div><div><p className="text-[9px] text-subtle">Preço sugerido</p><p className="text-base font-extrabold text-green-600">R$ 119,90</p><p className="text-[10px] font-bold text-green-600">Margem 24%</p></div></div>;
  if (code === "competition") return <div className="mt-auto"><div className="flex justify-between text-[10px]"><span>Menor preço <b>R$ 90,00</b></span><span>Sua posição <b>9ª</b></span></div><Spark color="#ff7a22" /></div>;
  return <div className="mt-auto space-y-1.5">{["Mercado Livre", "Shopee", "Amazon"].map((name) => <div key={name} className="flex justify-between text-[10px]"><span className="font-bold">{name}</span><span className={status === "FUTURE" ? "text-subtle" : "text-green-600"}>{status === "FUTURE" ? "Planejado" : "Disponível"}</span></div>)}</div>;
}

function Spark({ color }: { color: string }) {
  return <svg className="mt-2 h-9 w-full" viewBox="0 0 180 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,24 15,15 30,21 45,8 60,17 75,11 90,19 105,7 120,15 135,6 150,17 165,9 180,14" fill="none" stroke={color} strokeWidth="2" /><line x1="0" y1="28" x2="180" y2="28" stroke="#e8e8e3" /></svg>;
}
