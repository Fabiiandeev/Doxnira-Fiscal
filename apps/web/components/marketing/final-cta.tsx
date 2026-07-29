"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { marketingCopy } from "@/helpers/marketing-copy";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";

export function FinalCta() {
  return (
    <section id="sobre" className="scroll-mt-24 bg-lime px-4 py-24 md:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-3xl font-extrabold tracking-[-0.04em] text-ink md:text-[44px]">
          {marketingCopy.finalCta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-ink/75">
          {marketingCopy.finalCta.description}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            variant="default"
            onClick={() => trackMarketingEvent("marketing.signup_clicked")}
          >
            <Link href={marketingCopy.finalCta.primaryCta.href}>
              {marketingCopy.finalCta.primaryCta.label}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            onClick={() => trackMarketingEvent("marketing.contact_opened", { topic: "final_cta" })}
          >
            <Link href={marketingCopy.finalCta.secondaryCta.href}>
              {marketingCopy.finalCta.secondaryCta.label}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}