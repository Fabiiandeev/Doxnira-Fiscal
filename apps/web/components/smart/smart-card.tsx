import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SmartCard({
  title,
  description,
  status,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  status?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      {(title || description || status || action) && (
        <div className="mb-5 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {title && <h2 className="text-base font-extrabold text-ink">{title}</h2>}
              {status && <Badge variant="lime">{status}</Badge>}
            </div>
            {description && <p className="mt-1 text-sm leading-6 text-subtle">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}
