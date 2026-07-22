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
        className="grid h-7 w-9 place-items-center"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 5h8.5a7 7 0 0 1 0 14H4v-4h8.5a3 3 0 0 0 0-6H4V5Z" fill="#B8F000" />
          <path d="M2 8h8M2 12h7M2 16h8" stroke="#B8F000" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      {showText && (
        <span className={cn("flex flex-col text-[18px] font-extrabold leading-[0.7] tracking-[-0.04em]", inverse ? "text-white" : "text-ink")}>
          Doxnira
          <span className="text-center text-[7px] font-bold uppercase tracking-[0.42em]">Fiscal</span>
        </span>
      )}
    </div>
  );
}
