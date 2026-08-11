"use client";

import { useMemo, useState } from "react";

import { PlanCard } from "./plan-card";
import { marketingCopy } from "@/helpers/marketing-copy";
import { useMarketingPlansQuery } from "@/lib/services/marketing-hooks";
import type { MarketingPlan } from "@/lib/services/marketing-service";
import { enumValue, type PricingCycle } from "@/helpers/formatters";
import { cn } from "@/lib/utils";

const RECOMMENDED_PLAN_CODE = "BUSINESS";

const FALLBACK_PLANS: MarketingPlan[] = [
  {
    code: "STARTER",
    name: "Starter + Portal Contábil",
    description: "Para quem está começando e quer crescer.",
    displayOrder: 1,
    prices: [
      { billingCycle: "MONTHLY", amountCents: 20000, currency: "BRL" },
      { billingCycle: "ANNUAL", amountCents: 199200, currency: "BRL" },
    ],
    highlights: [], recommended: false, customPricing: false, checkoutAvailable: true,
  },
  {
    code: "PROFESSIONAL",
    name: "Professional + Portal Contábil",
    description: "Para operações em crescimento.",
    displayOrder: 2,
    prices: [
      { billingCycle: "MONTHLY", amountCents: 45000, currency: "BRL" },
      { billingCycle: "ANNUAL", amountCents: 448200, currency: "BRL" },
    ],
    highlights: [], recommended: false, customPricing: false, checkoutAvailable: true,
  },
  {
    code: "BUSINESS",
    name: "Business + Portal Contábil",
    description: "Para operações mais exigentes.",
    displayOrder: 3,
    prices: [
      { billingCycle: "MONTHLY", amountCents: 65000, currency: "BRL" },
      { billingCycle: "ANNUAL", amountCents: 647400, currency: "BRL" },
    ],
    highlights: [], recommended: true, customPricing: false, checkoutAvailable: true,
  },
  {
    code: "COMPANY",
    name: "Empresa + Portal Contábil",
    description: "Solução completa para grandes operações.",
    displayOrder: 4,
    prices: [], highlights: [], recommended: false, customPricing: true, checkoutAvailable: false,
  },
];

export function PlansSection() {
  const { data } = useMarketingPlansQuery();
  const [cycle, setCycle] = useState<PricingCycle>(enumValue.monthly);

  const plans = useMemo(() => {
    const catalog = data?.plans?.length ? data.plans : FALLBACK_PLANS;
    return catalog.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  }, [data]);

  return (
    <section
      id="planos"
      className="scroll-mt-24 bg-gradient-to-b from-white via-white to-[#fbfcf8] px-4 py-8 md:px-8 md:py-10"
    >
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-7 flex flex-col gap-5 border-b border-line/70 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl text-left">
            <span className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-lime-strong">
              {marketingCopy.plans.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-extrabold leading-[1.08] tracking-[-0.045em] text-ink md:text-[36px]">
              Escolha o plano ideal para sua empresa
            </h2>
            <p className="mt-3 text-[12px] leading-5 text-ink-soft">Todos os planos incluem acesso ao Portal Contábil.</p>
          </div>

          <CycleToggle cycle={cycle} setCycle={setCycle} />
        </div>

        <div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                cycle={cycle}
                recommended={plan.code === RECOMMENDED_PLAN_CODE}
              />
            ))}
          </div>
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
      className="inline-flex w-fit shrink-0 items-center rounded-full border border-line bg-surface p-1.5 shadow-sm"
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
            "rounded-full px-5 py-2.5 text-sm font-bold transition-all",
            cycle === option.value
              ? "bg-lime text-ink shadow-sm"
              : "text-ink-soft hover:bg-white hover:text-ink",
          )}
          data-testid={`cycle-toggle-${option.value.toLowerCase()}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const recommendedPlanCode = RECOMMENDED_PLAN_CODE;
