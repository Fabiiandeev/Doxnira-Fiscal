"use client";

const reportItems = [
  "32 documentos validados",
  "18 produtos classificados",
  "7 rejeiÃ§Ãµes corrigidas",
  "4 CT-e vinculados",
  "2 guias conferidas",
  "R$ 48.000,00 em notas destravadas",
];

export function AccountantValueReportView() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-lime-700">RelatÃ³rio de valor</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">O que a contabilidade fez por vocÃª</h1>
        <p className="mt-2 text-sm text-slate-600">Resumo mockado do valor entregue pela contabilidade no mÃªs atual.</p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <ul className="grid gap-3 md:grid-cols-2">
          {reportItems.map((item) => (
            <li key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950">
            Gerar PDF mockado
          </button>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">
            Enviar ao cliente
          </button>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">
            Exportar CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountantValueReportView;
