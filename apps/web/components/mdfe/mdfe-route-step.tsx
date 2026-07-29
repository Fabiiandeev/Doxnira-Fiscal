import { Input } from "@/components/ui/input";
import type { MdfeStepProps } from "./mdfe-form-types";

export function MdfeRouteStep({ value, onChange }: MdfeStepProps) {
  const loading = value.loadingMunicipalities?.[0] ?? { stateCode: value.loadingState ?? "", cityCode: "", cityName: "" };
  const unloading = value.unloadingCities?.[0] ?? { stateCode: value.unloadingState ?? "", cityCode: "", cityName: "" };
  const updateLoading = (patch: Partial<typeof loading>) => {
    const next = { ...loading, ...patch };
    onChange({ loadingState: next.stateCode, loadingMunicipalities: [next] });
  };
  const updateUnloading = (patch: Partial<typeof unloading>) => {
    const next = { ...unloading, ...patch };
    onChange({ unloadingState: next.stateCode, unloadingCities: [next] });
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="UF de carregamento" value={loading.stateCode} onChange={(e) => updateLoading({ stateCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) })} />
        <Input label="Município de carregamento" value={loading.cityName} onChange={(e) => updateLoading({ cityName: e.target.value })} />
        <Input label="Código IBGE" value={loading.cityCode} onChange={(e) => updateLoading({ cityCode: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="UF de descarregamento" value={unloading.stateCode} onChange={(e) => updateUnloading({ stateCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) })} />
        <Input label="Município de descarregamento" value={unloading.cityName} onChange={(e) => updateUnloading({ cityName: e.target.value })} />
        <Input label="Código IBGE" value={unloading.cityCode} onChange={(e) => updateUnloading({ cityCode: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
      </div>
      <Input label="UFs do percurso, separadas por vírgula" value={(value.routeStates ?? []).join(", ")} onChange={(e) => onChange({ routeStates: e.target.value.toUpperCase().split(",").map((item) => item.trim()).filter(Boolean) })} />
    </div>
  );
}
