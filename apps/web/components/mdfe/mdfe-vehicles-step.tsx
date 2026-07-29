import { Input } from "@/components/ui/input";
import type { MdfeStepProps } from "./mdfe-form-types";

export function MdfeVehiclesStep({ value, onChange }: MdfeStepProps) {
  const vehicle = value.vehicle ?? { plate: "", plateState: "", rntrc: "", renavam: "" };
  const driver = value.drivers?.[0] ?? { cpf: "", name: "", phone: "", isPrimary: true };
  return (
    <div className="space-y-6">
      <div><h3 className="mb-3 font-extrabold">Veículo de tração</h3><div className="grid gap-4 md:grid-cols-4">
        <Input label="Placa" value={vehicle.plate} onChange={(e) => onChange({ vehicle: { ...vehicle, plate: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7) } })} />
        <Input label="UF da placa" value={vehicle.plateState ?? ""} onChange={(e) => onChange({ vehicle: { ...vehicle, plateState: e.target.value.toUpperCase().slice(0, 2) } })} />
        <Input label="RNTRC" value={vehicle.rntrc ?? ""} onChange={(e) => onChange({ vehicle: { ...vehicle, rntrc: e.target.value } })} />
        <Input label="RENAVAM" value={vehicle.renavam ?? ""} onChange={(e) => onChange({ vehicle: { ...vehicle, renavam: e.target.value.replace(/\D/g, "") } })} />
      </div></div>
      <div><h3 className="mb-3 font-extrabold">Condutor principal</h3><div className="grid gap-4 md:grid-cols-3">
        <Input label="CPF" value={driver.cpf} onChange={(e) => onChange({ drivers: [{ ...driver, cpf: e.target.value.replace(/\D/g, "").slice(0, 11), isPrimary: true }] })} />
        <Input label="Nome" value={driver.name} onChange={(e) => onChange({ drivers: [{ ...driver, name: e.target.value, isPrimary: true }] })} />
        <Input label="Telefone" value={driver.phone ?? ""} onChange={(e) => onChange({ drivers: [{ ...driver, phone: e.target.value, isPrimary: true }] })} />
      </div></div>
    </div>
  );
}
