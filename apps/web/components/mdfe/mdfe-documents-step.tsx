import { Input } from "@/components/ui/input";
import type { MdfeStepProps } from "./mdfe-form-types";

export function MdfeDocumentsStep({ value, onChange }: MdfeStepProps) {
  const document = value.fiscalDocuments?.[0] ?? {
    documentType: "NFE" as const, accessKey: "", unloadingCityCode: value.unloadingCities?.[0]?.cityCode ?? "",
    documentValue: "", grossWeight: "", linkSource: "MANUAL" as const,
  };
  const update = (patch: Partial<typeof document>) => onChange({ fiscalDocuments: [{ ...document, ...patch }] });
  return (
    <div className="space-y-4">
      <p className="text-sm text-subtle">A chave pode ser informada manualmente ou vinculada futuramente a uma NF-e/CT-e autorizada da própria empresa.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-ink">Tipo
          <select className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3" value={document.documentType} onChange={(e) => update({ documentType: e.target.value as "NFE" | "CTE" })}>
            <option value="NFE">NF-e</option><option value="CTE">CT-e</option>
          </select>
        </label>
        <Input label="Chave de acesso (44 dígitos)" value={document.accessKey} onChange={(e) => update({ accessKey: e.target.value.replace(/\D/g, "").slice(0, 44) })} />
        <Input label="Código IBGE de descarregamento" value={document.unloadingCityCode} onChange={(e) => update({ unloadingCityCode: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
        <Input label="Valor do documento (R$)" value={String(document.documentValue ?? "")} onChange={(e) => update({ documentValue: e.target.value.replace(",", ".") })} />
        <Input label="Peso bruto (kg)" value={String(document.grossWeight ?? "")} onChange={(e) => update({ grossWeight: e.target.value.replace(",", ".") })} />
      </div>
    </div>
  );
}
