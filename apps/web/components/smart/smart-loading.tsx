import { RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SmartLoading({
  label = "Carregando...",
  rows = 4,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
        <RefreshCw className="h-4 w-4 animate-spin" />
        {label}
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </Card>
  );
}
