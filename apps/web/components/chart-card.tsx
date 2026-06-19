import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn("p-5 md:p-6", className)}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em]">{title}</h2>
          {description && <p className="mt-1 text-[11px] text-subtle">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
