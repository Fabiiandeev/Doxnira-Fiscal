import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SmartDashboardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}
