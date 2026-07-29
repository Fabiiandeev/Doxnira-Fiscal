import { Input } from "@/components/ui/input";
import type { MdfeStepProps } from "./mdfe-form-types";

export function MdfeInsuranceStep({ value, onChange }: MdfeStepProps) {
  const insurance = (value.insurances?.[0] ?? {
    responsibleType: "EMITENTE", insurerName: "", insurerCnpj: "", policyNumber: "", endorsements: [],
  }) as { responsibleType: string; insurerName: string; insurerCnpj: string; policyNumber: string; endorsements: string[] };
  const update = (patch: Partial<typeof insurance>) => onChange({ insurances: [{ ...insurance, ...patch }] });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Input label="Seguradora" value={insurance.insurerName} onChange={(e) => update({ insurerName: e.target.value })} />
      <Input label="CNPJ da seguradora" value={insurance.insurerCnpj} onChange={(e) => update({ insurerCnpj: e.target.value.replace(/\D/g, "") })} />
      <Input label="Número da apólice" value={insurance.policyNumber} onChange={(e) => update({ policyNumber: e.target.value })} />
      <Input label="Averbações, separadas por vírgula" value={insurance.endorsements.join(", ")} onChange={(e) => update({ endorsements: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
    </div>
  );
}
