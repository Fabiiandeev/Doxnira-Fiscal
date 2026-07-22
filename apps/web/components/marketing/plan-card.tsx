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
  const prices = plan.prices ?? [];
  const monthly = prices.find((p) => p.billingCycle === "MONTHLY");
  const annual = prices.find((p) => p.billingCycle === "ANNUAL");
  const currentPrice = cycle === "MONTHLY" ? monthly : annual;
  const savings =
    !plan.customPricing && monthly && annual
      ? annualSavingsCents(monthly.amountCents, annual.amountCents)
      : null;

  return (
    <article
      data-testid={`plan-card-${plan.code}`}
      className={cn(
        "relative flex h-full flex-col rounded-3xl border bg-surface p-5 shadow-soft transition-all",
        recommended ? "border-lime-strong ring-2 ring-lime/40" : "border-line hover:shadow-card",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-ink">{plan.name}</h3>
          {plan.description && <p className="mt-1 text-xs text-ink-soft">{plan.description}</p>}
        </div>
        {recommended && <Badge variant="lime">{marketingCopy.plans.recommendedBadge}</Badge>}
        {plan.customPricing && <Badge variant="default">{marketingCopy.plans.customPlanBadge}</Badge>}
      </header>

      <div className="mt-5">
        {plan.customPricing ? (
          <p className="text-3xl font-extrabold tracking-tight text-ink">Preço personalizado</p>
        ) : currentPrice ? (
          <>
            <p className="text-3xl font-extrabold tracking-tight text-ink">
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

      {plan.highlights.length > 0 && (
        <ul className="mt-5 flex-1 space-y-2">
          {plan.highlights.map((highlight) => (
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
