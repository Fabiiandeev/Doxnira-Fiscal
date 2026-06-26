"use client";

const impacts = [
  { label: "Empresas analisadas", value: "28" },
  { label: "Produtos impactados", value: "1.284" },
  { label: "ServiÃ§os impactados", value: "342" },
  { label: "Regras pendentes", value: "76" },
  { label: "Empresas com risco alto", value: "6" },
];

export function TaxReformView() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-lime-700">Radar IBS/CBS</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">PreparaÃ§Ã£o para Reforma TributÃ¡ria</h1>
        <p className="mt-2 text-sm text-subtle">SimulaÃ§Ã£o mockada de impacto fiscal para adequaÃ§Ã£o aos novos campos e regras.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {impacts.map((item) => (
          <div key={item.label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-subtle">{item.label}</p>
            <p className="mt-2 text-xl font-bold text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Plano de adequaÃ§Ã£o</h2>
        <p className="mt-2 text-sm text-subtle">Existem produtos sem classificaÃ§Ã£o futura, serviÃ§os sem revisÃ£o e empresas com risco alto.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-ink">
            Gerar plano de adequaÃ§Ã£o
          </button>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold text-subtle">
            Enviar para contador
          </button>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold text-subtle">
            Aplicar regras mockadas
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaxReformView;
