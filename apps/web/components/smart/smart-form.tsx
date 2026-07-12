import type { FormHTMLAttributes, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SmartForm({
  title,
  description,
  submitLabel = "Salvar",
  isSubmitting,
  actions,
  children,
  className,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  title?: string;
  description?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  actions?: ReactNode;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <form className="space-y-5" {...props}>
        {(title || description) && (
          <div>
            {title && <h2 className="text-base font-extrabold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-6 text-subtle">{description}</p>}
          </div>
        )}
        {children}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
          {actions}
          <Button type="submit" variant="lime" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
