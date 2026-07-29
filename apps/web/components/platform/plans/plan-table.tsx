"use client";
import Link from "next/link";
import { Copy, Eye, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlatformPlanMutation, usePlatformPlans } from "@/lib/services/platform-plans-hooks";
import type { PlatformPlan } from "@/lib/services/platform-plans-service";

const money = (price?: { amountCents: number; currency: string }) => price ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: price.currency }).format(price.amountCents / 100) : "—";
export function PlanTable() {
  const { user } = useAuth();
  const query = usePlatformPlans();
  const mutation = usePlatformPlanMutation();
  if (!["PLATFORM_ADMIN", "PLATFORM_SUPER_ADMIN"].includes(user?.role || "")) return <Card className="p-8 text-center font-bold">Acesso exclusivo da administração da plataforma.</Card>;
  const duplicate = (plan: PlatformPlan) => mutation.mutate({ kind: "create", data: {
    code: `${plan.code}_COPY_${Date.now().toString().slice(-5)}`, slug: `${plan.slug}-copia-${Date.now().toString().slice(-5)}`, name: `${plan.name} (cópia)`,
    sortOrder: plan.sortOrder + 1, trialDays: plan.trialDays, featured: false, publicVisible: false, availableForSale: false,
    buttonLabel: plan.buttonLabel, title: plan.title, shortDescription: plan.shortDescription, description: plan.description,
  } }, { onSuccess: () => notify({ title: "Plano duplicado" }), onError: (error) => notify({ title: "Falha ao duplicar", description: error.message, tone: "error" }) });
  if (query.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-white/60" />;
  if (query.isError) return <Card className="p-8 text-center"><p className="font-bold">Não foi possível carregar os planos.</p><Button className="mt-4" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" />Tentar novamente</Button></Card>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-widest text-subtle">Plataforma</p><h1 className="text-3xl font-extrabold">Gestão de Planos e Preços</h1><p className="mt-2 text-sm text-subtle">Fonte única para landing, contratação, faturas e checkout.</p></div><Button asChild variant="lime"><Link href="/platform/plans/new"><Plus className="h-4 w-4" />Novo plano</Link></Button></div>
    <Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-muted"><tr>{["Plano","Mensal","Anual","Landing","Venda","Status","Assinantes","Ações"].map(x=><th className="px-4 py-3" key={x}>{x}</th>)}</tr></thead><tbody>{query.data?.plans.map(plan=><tr className="border-t" key={plan.id}><td className="px-4 py-4"><p className="font-extrabold">{plan.name}</p><p className="text-subtle">{plan.code}</p></td><td className="px-4">{money(plan.prices.monthly)}</td><td className="px-4">{money(plan.prices.yearly)}</td><td className="px-4">{plan.publicVisible?"Sim":"Não"}</td><td className="px-4">{plan.availableForSale?"Sim":"Não"}</td><td className="px-4"><Badge variant={plan.status==="ACTIVE"?"success":"neutral"}>{plan.status}</Badge></td><td className="px-4">{plan.subscribers}</td><td className="px-4"><div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link href={`/platform/plans/${plan.id}`}><Eye className="h-4 w-4" />Visualizar</Link></Button><Button size="sm" variant="ghost" onClick={()=>duplicate(plan)}><Copy className="h-4 w-4" />Duplicar</Button></div></td></tr>)}</tbody></table></Card>
  </div>;
}
