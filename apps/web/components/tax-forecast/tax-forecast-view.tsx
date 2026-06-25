"use client";

const taxes = [
  { name: "DAS previsto", value: "R$ 8.430,90" },
  { name: "ISS previsto", value: "R$ 2.120,40" },
  { name: "ICMS previsto", value: "R$ 1.870,30" },
  { name: "PIS/COFINS previsto", value: "R$ 419,10" },
  { name: "RetenÃ§Ãµes", value: "R$ 610,00" },
  { name: "Reserva diÃ¡ria sugerida", value: "R$ 610,00" },
];

export function TaxForecastView() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-lime-700">PrevisÃ£o de impostos</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Alerta de caixa fiscal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Imposto previsto no mÃªs: R$ 12.840,70 Â· ProjeÃ§Ã£o atÃ© fim do mÃªs: R$ 18.300,00 Â· Risco de caixa: MÃ©dio.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {taxes.map((tax) => (
          <div key={tax.name} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">{tax.name}</p>
            <p className="mt-2 text-xl font-bold text-slate-950">{tax.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">AÃ§Ãµes</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950">
            Reservar imposto
          </button>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">
            Marcar como pago
          </button>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">
            Anexar guia
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaxForecastView;
