import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

export type FiscalModuleAction = {
  label: string;
  href: string;
  variant?: "lime" | "outline";
};

export type FiscalModuleMetric = {
  label: string;
  value: string;
  note?: string;
};

export type FiscalModuleChecklistItem = {
  title: string;
  description: string;
};

export type FiscalModuleHighlight = {
  title: string;
  description: string;
};

export function FiscalModuleView({
  eyebrow,
  title,
  description,
  icon,
  statusLabel,
  statusVariant = "lime",
  primaryAction,
  secondaryAction,
  metrics = [],
  checklist = [],
  highlights = [],
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  statusLabel: string;
  statusVariant?: BadgeVariant;
  primaryAction?: FiscalModuleAction;
  secondaryAction?: FiscalModuleAction;
  metrics?: FiscalModuleMetric[];
  checklist?: FiscalModuleChecklistItem[];
  highlights?: FiscalModuleHighlight[];
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        icon={icon}
        action={
          <div className="flex flex-wrap gap-2">
            {secondaryAction && (
              <Button asChild variant={secondaryAction.variant ?? "outline"}>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            )}
            {primaryAction && (
              <Button asChild variant={primaryAction.variant ?? "lime"}>
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-subtle">
                Estrutura fiscal
              </p>
              <p className="mt-3 text-sm leading-6 text-subtle">{description}</p>
            </div>
          </div>

          {checklist.length > 0 && (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {checklist.map((item) => (
                <div key={item.title} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime text-ink">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-ink">{item.title}</p>
                      <p className="mt-1 text-[11px] leading-5 text-subtle">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle">
            Indicadores base
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl bg-muted p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
                  {metric.label}
                </p>
                <p className="mt-2 text-lg font-extrabold text-ink">{metric.value}</p>
                {metric.note && (
                  <p className="mt-1 text-[11px] leading-5 text-subtle">{metric.note}</p>
                )}
              </div>
            ))}
            {metrics.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line bg-surface p-4 text-sm text-subtle">
                Nenhum indicador configurado.
              </div>
            )}
          </div>
        </Card>
      </div>

      {highlights.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {highlights.map((highlight) => (
            <Card key={highlight.title} className="p-5">
              <p className="text-sm font-extrabold text-ink">{highlight.title}</p>
              <p className="mt-2 text-sm leading-6 text-subtle">{highlight.description}</p>
            </Card>
          ))}
        </div>
      )}

      {footer}
    </div>
  );
}
