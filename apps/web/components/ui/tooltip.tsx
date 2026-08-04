"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type TooltipSide = "right" | "top" | "bottom" | "left";

type SideToPosition = Record<TooltipSide, React.CSSProperties>;

const sideGapPx = 10;

const sideStyles: SideToPosition = {
  right: { left: "100%", top: "50%", transform: "translateY(-50%)" },
  left: { left: `-${sideGapPx}px`, right: "100%", top: "50%", transform: "translateY(-50%)" },
  top: { bottom: "100%", left: "50%", transform: "translateX(-50%)" },
  bottom: { left: "50%", top: "calc(100% + var(--tt-gap, 0px))", transform: "translateX(-50%)" },
};

export function Tooltip({
  children,
  label,
  side = "right",
  className,
  disabled,
}: {
  children: ReactNode;
  label: string;
  side?: TooltipSide;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (disabled) return <>{children}</>;

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} aria-label={label}>
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          style={{
            position: "absolute",
            zIndex: 1200,
            paddingInline: 8,
            paddingBlock: 4,
            marginLeft: side === "right" ? sideGapPx : 0,
            marginRight: side === "left" ? sideGapPx : 0,
            marginTop: side === "bottom" ? sideGapPx : 0,
            marginBottom: side === "top" ? sideGapPx : 0,
            ...sideStyles[side],
          }}
          className="pointer-events-none whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-bold text-white shadow-card"
        >
          {label}
        </span>
      )}
    </span>
  );
}
