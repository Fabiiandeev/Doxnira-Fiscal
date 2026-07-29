import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const mdfeSteps = [
  "Identificação", "Percurso", "Veículos", "Documentos",
  "ANTT e pagamento", "Seguro", "Informações", "Revisão",
];

export function MdfeStepper({
  currentStep,
  onSelect,
}: {
  currentStep: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="grid gap-2 md:grid-cols-4 xl:grid-cols-8" aria-label="Etapas do MDF-e">
      {mdfeSteps.map((label, index) => {
        const step = index + 1;
        const complete = step < currentStep;
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onSelect(step)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold transition",
                step === currentStep ? "border-ink bg-ink text-white" : "border-line bg-white text-subtle hover:bg-muted",
              )}
            >
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", complete ? "bg-lime text-ink" : "bg-muted text-ink")}>
                {complete ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <span className="truncate">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
