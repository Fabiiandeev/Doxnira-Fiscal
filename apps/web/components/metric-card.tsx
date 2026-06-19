import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const tones = {
  white: "bg-white",
  green: "bg-pastel-green",
  purple: "bg-pastel-purple",
  yellow: "bg-pastel-yellow",
  cyan: "bg-pastel-cyan",
};

export function MetricCard({
  label,
  value,
  detail,
  trend = "neutral",
  tone = "white",
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: "up" | "down" | "neutral";
  tone?: keyof typeof tones;
  icon?: LucideIcon;
}) {
  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;

  return (
    <div
      className={cn(
        "relative min-h-40 overflow-hidden rounded-2xl border border-white/70 p-5 shadow-soft",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold text-subtle">{label}</p>
        {Icon && (
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-ink">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-6 text-[30px] font-extrabold tracking-[-0.05em] text-ink">{value}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <TrendIcon
          className={cn(
            "h-3.5 w-3.5",
            trend === "up"
              ? "text-emerald-600"
              : trend === "down"
                ? "text-red-500"
                : "text-subtle",
          )}
        />
        <p className="text-[11px] font-bold text-subtle">{detail}</p>
      </div>
    </div>
  );
}

