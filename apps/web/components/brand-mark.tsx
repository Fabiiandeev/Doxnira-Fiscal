import { ScanLine } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  inverse = false,
  className,
}: {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "NS Fiscal Cloud";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime text-ink shadow-sm">
        <ScanLine className="h-5 w-5" strokeWidth={2.4} />
      </div>
      {!compact && (
        <div>
          <p
            className={cn(
              "text-[15px] font-extrabold leading-tight tracking-[-0.03em]",
              inverse ? "text-white" : "text-ink",
            )}
          >
            {productName}
          </p>
          <p className={cn("mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em]", inverse ? "text-white/45" : "text-subtle")}>
            Central fiscal
          </p>
        </div>
      )}
    </div>
  );
}

