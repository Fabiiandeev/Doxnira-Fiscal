import { Input } from "@/components/ui/input";
import type { MdfeStepProps } from "./mdfe-form-types";

export function MdfeAnttStep({ value, onChange }: MdfeStepProps) {
  const ciot = (value.ciots?.[0] ?? { number: "", responsibleTaxId: "" }) as { number?: string; responsibleTaxId?: string };
  const voucher = (value.tollVouchers?.[0] ?? { providerCnpj: "", purchaseNumber: "", amountCents: 0 }) as { providerCnpj?: string; purchaseNumber?: string; amountCents?: number | string };
  return (
    <div className="space-y-6">
      <p className="text-sm text-subtle">Para transporte rodoviário remunerado de carga de terceiros, o CIOT é validado conforme a NT vigente.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Número CIOT" value={ciot.number ?? ""} onChange={(e) => onChange({ ciots: [{ ...ciot, number: e.target.value }] })} />
        <Input label="CPF/CNPJ responsável CIOT" value={ciot.responsibleTaxId ?? ""} onChange={(e) => onChange({ ciots: [{ ...ciot, responsibleTaxId: e.target.value.replace(/\D/g, "") }] })} />
        <Input label="CNPJ fornecedor vale-pedágio" value={voucher.providerCnpj ?? ""} onChange={(e) => onChange({ tollVouchers: [{ ...voucher, providerCnpj: e.target.value.replace(/\D/g, "") }] })} />
        <Input label="Número da compra" value={voucher.purchaseNumber ?? ""} onChange={(e) => onChange({ tollVouchers: [{ ...voucher, purchaseNumber: e.target.value }] })} />
        <Input label="Valor em centavos" value={String(voucher.amountCents ?? 0)} onChange={(e) => onChange({ tollVouchers: [{ ...voucher, amountCents: e.target.value.replace(/\D/g, "") || 0 }] })} />
      </div>
    </div>
  );
}
