"use client";

import { Badge } from "@/components/ui/badge";
import { marketingCopy } from "@/helpers/marketing-copy";
import { CheckoutButton } from "./checkout-button";
import type { MarketingPlan } from "@/lib/services/marketing-service";
import { annualSavingsCents, formatAmount, type PricingCycle } from "@/helpers/formatters";
import { cn } from "@/lib/utils";

export function PlanCard({
  plan,
  cycle,
  recommended,
}: {
  plan: MarketingPlan;
  cycle: PricingCycle;
  recommended: boolean;
}) {
  const includedByPlan: Record<string, string[]> = {
    STARTER: ["1 empresa", "1 usuário", "Até 100 documentos fiscais/mês", "Retenção de XML por 12 meses"],
    PROFESSIONAL: ["1 empresa", "3 usuários", "Até 1.000 documentos fiscais/mês", "Portal Contábil e correção assistida"],
    BUSINESS: ["1 empresa", "10 usuários", "Até 5.000 documentos fiscais/mês", "Relatórios avançados e suporte prioritário"],
    COMPANY: ["Usuários personalizados", "Volume de documentos sob medida", "Integrações e SLA corporativo", "Implantação assistida"],
  };
  const prices = plan.prices ?? [];
  const monthly = prices.find((p) => p.billingCycle === "MONTHLY");
  const annual = prices.find((p) => p.billingCycle === "ANNUAL");
  const currentPrice = cycle === "MONTHLY" ? monthly : annual;
  const savings =
    !plan.customPricing && monthly && annual
      ? annualSavingsCents(monthly.amountCents, annual.amountCents)
      : null;

  const highlights = includedByPlan[plan.code] ?? [];
  const displayName = plan.name.split("+")[0]?.trim() || plan.name;

  return (
    <article
      data-testid={`plan-card-${plan.code}`}
      className={cn(
        "relative flex h-full min-h-[330px] flex-col rounded-2xl border bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-1",
        recommended ? "border-lime-strong shadow-[0_16px_45px_rgba(170,215,0,0.16)] ring-1 ring-lime/50" : "border-line hover:border-lime/60 hover:shadow-card",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-ink">{displayName}</h3>
          <p className="text-[10px] font-bold text-ink">+ Portal Contábil</p>
          <p className="mt-0.5 text-[9px] leading-3 text-ink-soft">{plan.description || (plan.code === "COMPANY" ? "Solução completa para grandes operações." : "Para quem está começando e quer crescer.")}</p>
        </div>
        {recommended && <Badge variant="lime">{marketingCopy.plans.recommendedBadge}</Badge>}
        {plan.customPricing && <Badge variant="default">{marketingCopy.plans.customPlanBadge}</Badge>}
      </header>

      <div className="mt-5">
        {plan.customPricing ? (
          <p className="text-3xl font-extrabold tracking-tight text-ink">Preço personalizado</p>
        ) : currentPrice ? (
          <>
            <p className="text-2xl font-extrabold tracking-tight text-ink">
              {formatAmount(currentPrice.amountCents, currentPrice.currency)}
              <span className="ml-1 text-xs font-semibold text-subtle">
                /{cycle === "MONTHLY" ? "mês" : "ano"}
              </span>
            </p>
            {cycle === "ANNUAL" && savings !== null && savings > 0 ? (
              <p className="mt-1 text-[11px] font-bold text-lime-strong">
                {marketingCopy.plans.savingsLabel} {formatAmount(savings, currentPrice.currency)} / ano
              </p>
            ) : null}
            {cycle === "ANNUAL" && (!annual || annual.amountCents === 0) && !monthly ? (
              <p className="mt-1 text-[11px] text-subtle">{marketingCopy.plans.emptyDisclaimer}</p>
            ) : null}
          </>
        ) : (
          <p className="text-3xl font-extrabold tracking-tight text-ink">—</p>
        )}
      </div>

      {highlights.length > 0 && (
        <ul className="mt-3 flex-1 space-y-1.5">
          {highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-xs text-ink-soft">
              <span aria-hidden="true" className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-lime-soft text-[9px] font-extrabold text-ink">✓</span>
              {highlight}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <CheckoutButton
          planCode={plan.code}
          billingCycle={cycle}
          customPricing={plan.customPricing}
        />
      </div>
    </article>
  );
}
