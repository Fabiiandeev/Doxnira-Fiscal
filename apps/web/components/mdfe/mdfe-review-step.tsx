import { Card } from "@/components/ui/card";
import type { MdfeStepProps } from "./mdfe-form-types";

export function MdfeReviewStep({ value }: MdfeStepProps) {
  const sections = [
    ["Identificação", `${value.series ?? "1"}/${value.number || "automático"} · ${value.modal ?? "RODOVIARIO"}`],
    ["Percurso", `${value.loadingState || "—"} → ${value.unloadingState || "—"} · ${(value.routeStates ?? []).join(", ") || "sem UFs intermediárias"}`],
    ["Veículo e condutor", `${value.vehicle?.plate || "sem veículo"} · ${value.drivers?.[0]?.name || "sem condutor"}`],
    ["Documentos", `${value.fiscalDocuments?.length ?? 0} documento(s)`],
    ["ANTT", `${value.ciots?.length ?? 0} CIOT(s) · ${value.tollVouchers?.length ?? 0} vale-pedágio(s)`],
    ["Seguro", `${value.insurances?.length ?? 0} seguro(s)`],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sections.map(([title, content]) => <Card key={title} className="p-4"><p className="text-xs font-extrabold uppercase tracking-wider text-subtle">{title}</p><p className="mt-2 text-sm font-bold">{content}</p></Card>)}
    </div>
  );
}
