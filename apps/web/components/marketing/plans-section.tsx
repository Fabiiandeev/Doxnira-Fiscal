"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { PlanCard } from "./plan-card";
import { marketingCopy } from "@/helpers/marketing-copy";
import { useMarketingPlansQuery } from "@/lib/services/marketing-hooks";
import { enumValue, type PricingCycle } from "@/helpers/formatters";
import { cn } from "@/lib/utils";

const RECOMMENDED_PLAN_CODE = "PROFESSIONAL";

export function PlansSection() {
  const { data, isLoading, error, refetch } = useMarketingPlansQuery();
  const [cycle, setCycle] = useState<PricingCycle>(enumValue.monthly);

  const plans = useMemo(() => {
    return (data?.plans ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
  }, [data]);

  return (
    <section
      id="planos"
      className="scroll-mt-24 bg-canvas px-4 py-16 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lime-strong">
              {marketingCopy.plans.eyebrow}
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-ink md:text-[40px]">
              {marketingCopy.plans.title}
            </h2>
            <p className="mt-3 text-base text-ink-soft">{marketingCopy.plans.description}</p>
          </div>

          <CycleToggle cycle={cycle} setCycle={setCycle} />
        </div>

        <div className="mt-10">
          {error ? (
            <PlanCatalogError onRetry={refetch} />
          ) : isLoading ? (
            <PlanSkeleton />
          ) : plans.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-ink-soft">
              {marketingCopy.plans.emptyDisclaimer}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  cycle={cycle}
                  recommended={plan.recommended || plan.code === RECOMMENDED_PLAN_CODE}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CycleToggle({
  cycle,
  setCycle,
}: {
  cycle: PricingCycle;
  setCycle: (value: PricingCycle) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Ciclo de cobrança"
      className="inline-flex items-center rounded-full border border-line bg-surface p-1"
    >
      {([
        { value: enumValue.monthly, label: marketingCopy.plans.monthlyLabel },
        { value: enumValue.annual, label: marketingCopy.plans.annualLabel },
      ] as const).map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={cycle === option.value}
          onClick={() => setCycle(option.value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-bold transition-colors",
            cycle === option.value
              ? "bg-ink text-white"
              : "text-ink-soft hover:text-ink",
          )}
          data-testid={`cycle-toggle-${option.value.toLowerCase()}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div
      aria-label="Carregando planos"
      aria-busy="true"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-72 animate-pulse rounded-3xl border border-line bg-surface" />
      ))}
    </div>
  );
}

function PlanCatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-line bg-surface p-8 text-center"
    >
      <p className="text-lg font-extrabold text-ink">
        {marketingCopy.plans.fallback.title}
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        {marketingCopy.plans.fallback.description}
      </p>
      <Button variant="lime" className="mx-auto mt-5" onClick={onRetry}>
        {marketingCopy.plans.fallback.retry}
      </Button>
    </div>
  );
}

export const recommendedPlanCode = RECOMMENDED_PLAN_CODE;
