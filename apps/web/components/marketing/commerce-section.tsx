"use client";

import { useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { marketingCopy } from "@/helpers/marketing-copy";
import {
  COMMERCE_MODULES,
  COMMERCE_MODULE_STATUS,
  type CommerceModuleDefinition,
  type CommerceModuleStatus as TStatus,
} from "@/helpers/commerce-module-status";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";

const STATUS_TONE: Record<TStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  AVAILABLE: "success",
  BETA: "info",
  PLANNED: "warning",
  FUTURE: "neutral",
};

export function CommerceSection() {
  const [active, setActive] = useState<CommerceModuleDefinition | null>(null);

  return (
    <section
      id="commerce"
      className="scroll-mt-24 bg-surface-muted px-4 py-16 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lime-strong">
            {marketingCopy.commerce.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-ink md:text-[40px]">
            {marketingCopy.commerce.title}
          </h2>
          <p className="mt-3 text-base text-ink-soft">{marketingCopy.commerce.subtitle}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {marketingCopy.commerce.chips.map((chip) => (
              <li key={chip}>
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold text-ink">
                  {chip}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {marketingCopy.commerce.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-line bg-surface p-4 text-center"
            >
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
                {metric.label}
              </dt>
              <dd className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMMERCE_MODULES.map((mod) => (
            <li key={mod.code}>
              <button
                type="button"
                onClick={() => {
                  trackMarketingEvent("marketing.commerce_module_opened", { module: mod.code });
                  setActive(mod);
                }}
                className="flex h-full w-full flex-col gap-2 rounded-2xl border border-line bg-surface p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
                data-testid={`commerce-card-${mod.code}`}
                aria-label={`Abrir detalhes do módulo ${mod.title}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-extrabold tracking-tight text-ink">{mod.title}</h3>
                  <Badge variant={STATUS_TONE[mod.status]}>
                    {COMMERCE_MODULE_STATUS[mod.status]}
                  </Badge>
                </div>
                <p className="text-sm text-ink-soft">{mod.summary}</p>
                <span className="mt-1 text-[11px] font-bold text-lime-strong">Ver detalhes →</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      >
        <DialogContent>
          {active && (
            <>
              <DialogTitle>{active.title}</DialogTitle>
              <p className="mt-2 text-sm text-ink-soft">{active.summary}</p>
              <ul className="mt-4 space-y-2">
                {active.details.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink">
                    <span aria-hidden="true" className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-lime-soft text-[9px] font-extrabold text-ink">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center justify-between">
                <Badge variant={STATUS_TONE[active.status]}>
                  {COMMERCE_MODULE_STATUS[active.status]}
                </Badge>
                <DialogClose asChild>
                  <button type="button" className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink">
                    Fechar
                  </button>
                </DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
