import { CalendarDays, CircleDollarSign, Filter, Search } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SmartInput(props: InputProps) {
  return <Input {...props} />;
}

export function SmartSelect({
  label,
  error,
  helperText,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  helperText?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-ink">{label}</label>}
      <select
        className={cn(
          "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus:border-red-500 focus:ring-red-100",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {helperText && !error && <p className="text-xs text-subtle">{helperText}</p>}
    </div>
  );
}

export function SmartDate(props: Omit<InputProps, "type">) {
  return <Input type="date" {...props} />;
}

export function SmartCurrency({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  error?: string;
  helperText?: string;
}) {
  return (
    <div className="relative">
      <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <Input
        inputMode="decimal"
        className={cn("pl-10", className)}
        placeholder="R$ 0,00"
        {...props}
      />
    </div>
  );
}

export function SmartSearch({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-10"
        placeholder={placeholder}
      />
    </div>
  );
}

export function SmartFilter({
  title = "Filtros",
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-4", className)}>
      <div className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-subtle">
        <Filter className="h-4 w-4" />
        {title}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export function SmartDateRange({
  start,
  end,
}: {
  start: ReactNode;
  end: ReactNode;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <div className="[&>div>input]:pl-10">{start}</div>
      </div>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <div className="[&>div>input]:pl-10">{end}</div>
      </div>
    </div>
  );
}
