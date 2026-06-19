import { AlertTriangle, CircleAlert, Info, MoveUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function AlertCard({
  title,
  description,
  severity,
  time,
}: {
  title: string;
  description: string;
  severity: "warning" | "danger" | "info";
  time: string;
}) {
  const Icon =
    severity === "warning" ? AlertTriangle : severity === "danger" ? CircleAlert : Info;

  return (
    <div className="group flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-muted">
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          severity === "warning"
            ? "bg-amber-100 text-amber-700"
            : severity === "danger"
              ? "bg-red-100 text-red-700"
              : "bg-indigo-100 text-indigo-700",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-extrabold leading-5">{title}</p>
          <MoveUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition group-hover:opacity-100" />
        </div>
        <p className="mt-0.5 text-[10px] leading-4 text-subtle">{description}</p>
        <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-subtle/60">
          {time}
        </p>
      </div>
    </div>
  );
}
