import { cn } from "@/lib/utils";

export function MarketingLogo({
  inverse = false,
  className,
  showText = true,
}: {
  inverse?: boolean;
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-xl bg-lime shadow-soft"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 6h16M4 12h16M4 18h10" stroke="#161A18" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="17.5" cy="18" r="2.5" fill="#161A18" />
        </svg>
      </span>
      {showText && (
        <span className={cn("text-[15px] font-extrabold leading-tight tracking-[-0.04em]", inverse ? "text-white" : "text-ink")}>
          Doxnira
          <span className={inverse ? " text-lime" : " text-lime-strong"}> Fiscal</span>
        </span>
      )}
    </div>
  );
}
