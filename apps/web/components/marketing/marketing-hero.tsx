"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MarketingHeroMockup } from "./hero-mockup";
import { marketingCopy } from "@/helpers/marketing-copy";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";
import { cn } from "@/lib/utils";

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden bg-white px-4 pb-6 pt-6 md:px-8 md:pb-8 md:pt-8">
      <div aria-hidden="true" className="absolute -left-16 top-0 h-[420px] w-[420px] rounded-full border border-lime/30" />
      <div className="relative mx-auto grid max-w-[1480px] items-center gap-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="flex flex-col">
          <span className="inline-flex w-fit items-center rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
            {marketingCopy.hero.eyebrow}
          </span>
          <h1 className="mt-3 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.055em] text-ink md:text-[38px] lg:text-[40px]">
            Gestão fiscal inteligente para empresas que querem <span className="text-lime-strong">crescer.</span>
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-4 text-ink-soft md:text-[13px]">
            {marketingCopy.hero.description}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              variant="lime"
              size="lg"
              onClick={() => trackMarketingEvent("marketing.hero_start_clicked")}
            >
              <Link href={marketingCopy.hero.primaryCta.href}>
                {marketingCopy.hero.primaryCta.label}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              onClick={() => trackMarketingEvent("marketing.hero_plans_clicked")}
            >
              <Link href={marketingCopy.hero.secondaryCta.href}>
                {marketingCopy.hero.secondaryCta.label}
              </Link>
            </Button>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {marketingCopy.hero.microBenefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-soft">
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-soft text-[10px] font-extrabold text-ink")} aria-hidden="true">
                  ✓
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <MarketingHeroMockup />
      </div>
    </section>
  );
}
