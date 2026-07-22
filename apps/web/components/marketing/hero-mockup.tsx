export function MarketingHeroMockup() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-lime-soft blur-3xl"
      />
      <div
        role="img"
        aria-label="Pré-visualização do painel Doxnira Fiscal com indicadores de risco fiscal, documentos recentes e score fiscal."
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-card lg:max-w-none"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-subtle">
              Painel fiscal
            </p>
            <p className="text-base font-extrabold text-ink">Visão geral</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-lime-soft px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Operacional
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Score fiscal", value: "92", suffix: "/100", tone: "success" },
            { label: "Docs do mês", value: "1.284", tone: "ink" },
            { label: "Rejeições", value: "3", tone: "danger" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-line bg-muted p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-subtle">
                {card.label}
              </p>
              <p className="mt-1.5 text-lg font-extrabold tracking-tight text-ink">
                {card.value}
                {card.suffix && <span className="ml-1 text-xs font-semibold text-subtle">{card.suffix}</span>}
              </p>
              <span
                className={
                  "mt-2 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold " +
                  (card.tone === "success"
                    ? "bg-emerald-100 text-emerald-700"
                    : card.tone === "danger"
                      ? "bg-red-100 text-red-700"
                      : "bg-white text-ink")
                }
              >
                {card.tone === "success" ? "Saudável" : card.tone === "danger" ? "Atenção" : "Estável"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">Documentos recentes</p>
            <p className="text-[10px] font-semibold text-subtle">NF-e recebidas</p>
          </div>
          <ul className="mt-3 space-y-2">
            {[
              { code: "NFe · 52.260", status: "Autorizada", tone: "success" },
              { code: "NFe · 52.261", status: "Pendente", tone: "warning" },
              { code: "CTe · 52.262", status: "Importado", tone: "ink" },
            ].map((row) => (
              <li key={row.code} className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-ink">{row.code}</span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 font-bold " +
                    (row.tone === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : row.tone === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-muted text-ink")
                  }
                >
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
            Inteligência fiscal ·.next
          </p>
          <p className="mt-1 text-sm font-bold leading-5">
            2 correções sugeridas pela IA podem evitar rejeições.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-[10px] font-extrabold text-ink">
            Aplicar correções sugeridas
          </div>
        </div>
      </div>
    </div>
  );
}
