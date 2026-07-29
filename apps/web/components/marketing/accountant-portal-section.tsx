"use client";

import { Button } from "@/components/ui/button";
import { marketingCopy } from "@/helpers/marketing-copy";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";

export function AccountantPortalSection() {
  return (
    <section
      id="portal-contabil"
      className="scroll-mt-24 bg-surface px-4 py-16 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lime-strong">
            {marketingCopy.accountantPortal.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-ink md:text-[40px]">
            {marketingCopy.accountantPortal.title}
          </h2>
          <p className="mt-3 text-base text-ink-soft">
            {marketingCopy.accountantPortal.description}
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {marketingCopy.accountantPortal.benefits.map((benefit) => (
            <li
              key={benefit.title}
              data-testid={`portal-card-${benefit.title}`}
              className="rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <h3 className="text-base font-extrabold tracking-tight text-ink">
                {benefit.title}
              </h3>
              <p className="mt-2 text-sm text-ink-soft">{benefit.description}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Button
            variant="lime"
            size="lg"
            onClick={() => {
              trackMarketingEvent("marketing.contact_opened", { topic: "portal_contabil" });
              document
                .querySelector("#contato")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {marketingCopy.accountantPortal.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}
