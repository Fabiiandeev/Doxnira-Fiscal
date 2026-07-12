import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SmartChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-subtle">{description}</p>}
        </div>
        {action}
      </div>
      <div className="min-h-[260px]">{children}</div>
    </Card>
  );
}
