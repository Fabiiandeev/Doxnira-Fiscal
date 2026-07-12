import type { ReactNode } from "react";

import { SmartEmpty } from "@/components/smart/smart-empty";
import { SmartLoading } from "@/components/smart/smart-loading";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SmartTableColumn<T> = {
  id: string;
  header: ReactNode;
  accessor?: keyof T;
  cell?: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
}

export function SmartTable<T>({
  columns,
  data,
  rowKey,
  isLoading,
  empty,
  className,
}: {
  columns: SmartTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => React.Key;
  isLoading?: boolean;
  empty?: ReactNode;
  className?: string;
}) {
  if (isLoading) return <SmartLoading />;
  if (data.length === 0) return <>{empty ?? <SmartEmpty />}</>;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="bg-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-subtle",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowKey(row, rowIndex)} className="border-t border-line bg-white">
                {columns.map((column) => {
                  const value = column.cell
                    ? column.cell(row)
                    : column.accessor
                      ? renderValue(row[column.accessor])
                      : "—";
                  return (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3 text-sm text-ink",
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        column.className,
                      )}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
