import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { MdfeValidationIssue } from "@/lib/mdfe-types";

export function MdfeValidationPanel({ issues }: { issues: MdfeValidationIssue[] }) {
  if (!issues.length) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Nenhuma pendência encontrada.</div>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {issues.map((issue, index) => (
        <Card key={`${issue.code}-${index}`} className="p-4">
          <div className="flex gap-3">
            {issue.severity === "BLOCKING" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" /> : <Info className="mt-0.5 h-4 w-4 text-amber-600" />}
            <div>
              <p className="text-sm font-bold text-ink">{issue.message}</p>
              <p className="mt-1 text-xs text-subtle">{issue.code}{issue.field ? ` · ${issue.field}` : ""}{issue.suggestion ? ` · ${issue.suggestion}` : ""}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
