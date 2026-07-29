"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MarketingHeroMockup } from "./hero-mockup";
import { marketingCopy } from "@/helpers/marketing-copy";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";
import { cn } from "@/lib/utils";

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden bg-canvas px-4 pt-12 pb-16 md:px-8 md:pt-20 md:pb-24">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col">
          <span className="inline-flex w-fit items-center rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
            {marketingCopy.hero.eyebrow}
          </span>
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.05em] text-ink md:text-[44px] lg:text-[52px]">
            {marketingCopy.hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-soft md:text-lg">
            {marketingCopy.hero.description}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
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
          <ul className="mt-8 grid gap-2 sm:grid-cols-2">
            {marketingCopy.hero.microBenefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2 text-sm font-medium text-ink-soft">
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
