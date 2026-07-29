"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useState } from "react";

import { PlanCard } from "@/components/marketing/plan-card";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { MarketingBillingCycle, MarketingPlan } from "@/lib/services/marketing-service";
import { subscriptionPaymentService } from "@/lib/services/subscription-payment-service";

const checkoutInvoiceKey = "ns-fiscal-checkout-invoice";

export function SubscriptionPlanCatalog() {
  const [cycle, setCycle] = useState<MarketingBillingCycle>("MONTHLY");
  const query = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => apiFetch<{ plans: MarketingPlan[] }>("/subscription/plans"),
  });
  const checkout = useMutation({
    mutationFn: async (plan: MarketingPlan) => {
      const interval = cycle === "ANNUAL" ? "YEARLY" : "MONTHLY";
      const invoice = await subscriptionPaymentService.createInvoice(plan.id, interval);
      const result = await subscriptionPaymentService.createCheckout(invoice.id);
      return result;
    },
    onSuccess: (invoice) => {
      window.sessionStorage.setItem(checkoutInvoiceKey, invoice.id);
      if (!invoice.checkoutUrl) {
        notify({ title: "Link de pagamento indisponível", tone: "error" });
        return;
      }
      window.location.assign(invoice.checkoutUrl);
    },
    onError: (error) => notify({ title: "Não foi possível iniciar o pagamento", description: error.message, tone: "error" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Planos e assinatura</h1>
          <p className="mt-2 text-sm text-subtle">Escolha o plano. O valor da cobrança é definido e protegido pelo backend.</p>
        </div>
        <div className="rounded-full bg-white p-1">
          <Button size="sm" variant={cycle === "MONTHLY" ? "default" : "ghost"} onClick={() => setCycle("MONTHLY")}>Mensal</Button>
          <Button size="sm" variant={cycle === "ANNUAL" ? "default" : "ghost"} onClick={() => setCycle("ANNUAL")}>Anual</Button>
        </div>
      </div>
      {query.isLoading ? (
        <div className="h-80 animate-pulse rounded-2xl bg-white/60" />
      ) : query.isError ? (
        <Card className="p-8 text-center">
          <p className="font-bold">Não foi possível carregar os planos.</p>
          <Button className="mt-4" onClick={() => query.refetch()}>Tentar novamente</Button>
        </Card>
      ) : query.data?.plans.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {query.data.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              recommended={plan.featured}
              action={
                <Button
                  className="w-full"
                  variant="lime"
                  disabled={checkout.isPending}
                  onClick={() => {
                    if (window.confirm(`Gerar cobrança do plano ${plan.name}?`)) checkout.mutate(plan);
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  {checkout.isPending ? "Gerando checkout..." : "Pagar agora"}
                </Button>
              }
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-subtle">Nenhum plano disponível para contratação.</Card>
      )}
    </div>
  );
}

export { checkoutInvoiceKey };
