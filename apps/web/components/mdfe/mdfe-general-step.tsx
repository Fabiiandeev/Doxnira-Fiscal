import { Input } from "@/components/ui/input";
import type { MdfeStepProps } from "./mdfe-form-types";

export function MdfeGeneralStep({ value, onChange }: MdfeStepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Input label="Série" value={value.series ?? "1"} onChange={(event) => onChange({ series: event.target.value.replace(/\D/g, "").slice(0, 3) })} />
      <Input label="Número (automático se vazio)" value={value.number ?? ""} onChange={(event) => onChange({ number: event.target.value.replace(/\D/g, "").slice(0, 9) || null })} />
      <label className="text-sm font-bold text-ink">Emitente
        <select className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3" value={value.issuerType} onChange={(event) => onChange({ issuerType: event.target.value as MdfePayloadIssuer })}>
          <option value="PRESTADOR_SERVICO_TRANSPORTE">Prestador de transporte</option>
          <option value="TRANSPORTADOR_CARGA_PROPRIA">Carga própria</option>
        </select>
      </label>
      <label className="text-sm font-bold text-ink">Tipo de transportador
        <select className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3" value={value.carrierType} onChange={(event) => onChange({ carrierType: event.target.value as "ETC" | "TAC" | "CTC" | "PROPRIO" })}>
          <option value="ETC">ETC</option><option value="TAC">TAC</option><option value="CTC">CTC</option><option value="PROPRIO">Próprio</option>
        </select>
      </label>
      <label className="text-sm font-bold text-ink">Modal
        <select className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3" value={value.modal} onChange={(event) => onChange({ modal: event.target.value as "RODOVIARIO" })}>
          <option value="RODOVIARIO">Rodoviário</option>
        </select>
      </label>
      <Input label="Produto predominante" value={value.predominantProduct ?? ""} onChange={(event) => onChange({ predominantProduct: event.target.value })} />
      <Input label="NCM predominante" value={value.predominantNcm ?? ""} onChange={(event) => onChange({ predominantNcm: event.target.value.replace(/\D/g, "").slice(0, 8) || null })} />
    </div>
  );
}

type MdfePayloadIssuer = "PRESTADOR_SERVICO_TRANSPORTE" | "TRANSPORTADOR_CARGA_PROPRIA";
