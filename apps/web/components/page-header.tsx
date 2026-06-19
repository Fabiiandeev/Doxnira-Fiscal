import type { LucideIcon } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-subtle">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-ink md:text-[32px]">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

