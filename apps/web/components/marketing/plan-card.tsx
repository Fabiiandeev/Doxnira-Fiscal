"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { marketingCopy } from "@/helpers/marketing-copy";
import { CheckoutButton } from "./checkout-button";
import type { MarketingPlan } from "@/lib/services/marketing-service";
import { annualSavingsCents, formatAmount, type PricingCycle } from "@/helpers/formatters";
import { cn } from "@/lib/utils";

export function PlanCard({ plan, cycle, recommended, action }: { plan: MarketingPlan; cycle: PricingCycle; recommended: boolean; action?: ReactNode }) {
  const monthly = plan.prices.monthly;
  const annual = plan.prices.yearly;
  const currentPrice = cycle === "MONTHLY" ? monthly : annual;
  const savings = monthly && annual ? annualSavingsCents(monthly.amountCents, annual.amountCents) : null;

  return (
    <article
      data-testid={`plan-card-${plan.code}`}
      className={cn(
        "relative flex h-full flex-col rounded-3xl border bg-surface p-5 shadow-soft transition-all",
        recommended ? "border-lime ring-2 ring-lime/40" : "border-line hover:shadow-card",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-ink">{plan.name}</h3>
          {plan.shortDescription && <p className="mt-1 text-xs text-subtle">{plan.shortDescription}</p>}
        </div>
        {recommended ? <Badge variant="lime">{plan.badgeLabel || marketingCopy.plans.recommendedBadge}</Badge> : null}
        {!recommended && plan.badgeLabel ? <Badge variant="default">{plan.badgeLabel}</Badge> : null}
      </header>

      <div className="mt-5">
        {currentPrice ? (
          <>
            <p className="text-3xl font-extrabold tracking-tight text-ink">
              {formatAmount(currentPrice.amountCents, currentPrice.currency)}
              <span className="ml-1 text-xs font-semibold text-subtle">/{cycle === "MONTHLY" ? "mês" : "ano"}</span>
            </p>
            {cycle === "ANNUAL" && savings !== null && savings > 0 ? (
              <p className="mt-1 text-[11px] font-bold text-emerald-700">
                {marketingCopy.plans.savingsLabel} {formatAmount(savings, currentPrice.currency)} / ano
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-3xl font-extrabold tracking-tight text-ink">Preço personalizado</p>
        )}
      </div>

      {plan.features.length > 0 ? (
        <ul className="mt-5 flex-1 space-y-2">
          {plan.features.filter((feature) => feature.included).map((feature) => (
            <li key={feature.code} className="flex items-start gap-2 text-xs text-subtle">
              <span aria-hidden="true" className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-lime text-[9px] font-extrabold text-ink">✓</span>
              {feature.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6">
        {action ?? <CheckoutButton planCode={plan.code} billingCycle={cycle} customPricing={!plan.availableForSale || !currentPrice} />}
      </div>
    </article>
  );
}
