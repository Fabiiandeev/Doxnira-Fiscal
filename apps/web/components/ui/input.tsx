import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, id: providedId, ...props }, ref) => {
    const generatedId = React.useId();
    const id = providedId ?? generatedId;
    const messageId = `${id}-message`;
    return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>}
      <input
        id={id}
        type={type}
        aria-describedby={error || helperText ? messageId : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-subtle/70 focus:border-ink/30 focus:ring-4 focus:ring-ink/5 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus:border-red-500 focus:ring-red-100",
          className,
        )}
        ref={ref}
        {...props}
      />
      {error && <p id={messageId} className="text-xs text-red-600">{error}</p>}
      {helperText && !error && <p id={messageId} className="text-xs text-subtle">{helperText}</p>}
    </div>
    );
  },
);
Input.displayName = "Input";
