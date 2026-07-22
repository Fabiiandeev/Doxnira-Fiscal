const metrics = [
  ["Notas emitidas", "1.254", "↑ 18%", "text-lime-strong"],
  ["Documentos", "2.856", "↑ 15%", "text-lime-strong"],
  ["Economia fiscal", "R$ 4.320", "↑ 11%", "text-lime-strong"],
  ["Pendências", "23", "↓ 5%", "text-red-500"],
];

export function MarketingHeroMockup() {
  return (
    <div role="img" aria-label="Pré-visualização do dashboard Doxnira Fiscal" className="overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_24px_60px_rgba(20,24,20,0.13)]">
      <div className="grid min-h-[270px] grid-cols-[110px_1fr] sm:grid-cols-[130px_1fr]">
        <aside className="border-r border-line bg-[#fbfbf8] p-2">
          <div className="mb-3 flex items-center gap-1.5 text-[10px] font-extrabold text-ink"><span className="grid h-5 w-5 place-items-center rounded-md bg-lime text-xs">D</span>Doxnira</div>
          <nav className="space-y-0.5 text-[7px] font-bold text-ink-soft">
            {["Dashboard", "Inteligência Fiscal", "Documentos", "Pedidos", "Produtos", "Relatórios", "Financeiro", "Portal Contábil", "Configurações"].map((item, index) => <div key={item} className={`rounded-md px-2 py-1.5 ${index === 0 ? "bg-lime text-ink" : ""}`}>{item}</div>)}
          </nav>
        </aside>
        <div className="min-w-0 p-3">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold text-ink">Dashboard</h3><span className="rounded-full border border-line px-3 py-1 text-[8px] font-bold text-ink-soft">Empresa Exemplo Ltda.</span></div>
          <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {metrics.map(([label, value, change, tone]) => <div key={label} className="rounded-xl border border-line bg-white p-2.5"><p className="text-[8px] font-bold text-subtle">{label}</p><p className="mt-1 text-base font-extrabold text-ink">{value}</p><p className={`mt-1 text-[8px] font-bold ${tone}`}>{change} este mês</p></div>)}
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-line p-2"><div className="flex justify-between text-[8px] font-bold text-ink"><span>Emissões por mês</span><span className="text-subtle">Últimos 6 meses</span></div><div className="mt-2 flex h-16 items-end justify-between gap-2">{[35, 50, 65, 55, 84, 67, 91, 75, 88, 100].map((height, index) => <span key={index} className="w-full rounded-t bg-lime" style={{ height: `${height}%` }} />)}</div><div className="mt-1 flex justify-between text-[6px] text-subtle"><span>Jan</span><span>Fev</span><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span></div></div>
            <div className="rounded-xl border border-line p-3"><p className="text-[9px] font-extrabold text-ink">Alertas inteligentes</p>{["CFOP incompatível detectado", "NCM sem benefício fiscal", "Retenção de imposto pendente"].map((item, index) => <div key={item} className="mt-3 flex items-center justify-between gap-2 text-[8px]"><span className="font-semibold text-ink">⚠ {item}</span><span className={`rounded-full px-1.5 py-0.5 font-bold ${index === 1 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500"}`}>{index === 1 ? "Médio" : "Alto"}</span></div>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
