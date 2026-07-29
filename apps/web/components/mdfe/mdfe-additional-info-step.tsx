import type { MdfeStepProps } from "./mdfe-form-types";

const TextArea = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="block text-sm font-bold text-ink">{label}
    <textarea className="mt-2 min-h-28 w-full rounded-xl border border-line bg-white p-3 font-normal" value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

export function MdfeAdditionalInfoStep({ value, onChange }: MdfeStepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextArea label="Informações adicionais ao Fisco" value={value.fiscalInfo ?? ""} onChange={(fiscalInfo) => onChange({ fiscalInfo })} />
      <TextArea label="Informações complementares" value={value.additionalInfo ?? ""} onChange={(additionalInfo) => onChange({ additionalInfo })} />
      <TextArea label="Observações internas (não enviadas)" value={value.internalInfo ?? ""} onChange={(internalInfo) => onChange({ internalInfo })} />
    </div>
  );
}
