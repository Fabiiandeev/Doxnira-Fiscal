"use client";

import { useMemo, useState } from "react";

type InboxItem = {
  id: string;
  priority: "Alta" | "Media" | "Baixa";
  company: string;
  problem: string;
  responsible: "Empresa" | "Contador" | "Sistema" | "FiscalAI" | "Suporte";
  status: "Aberto" | "Em andamento" | "Resolvido" | "Arquivado";
  impact: string;
};

const initialItems: InboxItem[] = [
  {
    id: "inbox-1",
    priority: "Alta",
    company: "Gama Tech Ltda.",
    problem: "Certificado vencendo",
    responsible: "Empresa",
    status: "Aberto",
    impact: "R$ 120.000,00/mes",
  },
  {
    id: "inbox-2",
    priority: "Media",
    company: "Delta Autopecas Ltda.",
    problem: "CT-e sem vinculo",
    responsible: "Contador",
    status: "Em andamento",
    impact: "SPED bloqueado",
  },
];

const priorityClass: Record<InboxItem["priority"], string> = {
  Alta: "bg-red-50 text-red-700 border-red-200",
  Media: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Baixa: "bg-blue-50 text-blue-700 border-blue-200",
};

export function FiscalInboxView() {
  const [items, setItems] = useState<InboxItem[]>(initialItems);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.company.toLowerCase().includes(normalized) || item.problem.toLowerCase().includes(normalized));
  }, [items, query]);

  function resolveItem(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status: "Resolvido" } : item)));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-ink">Doxnira Inbox Fiscal</h1>
        <p className="mt-2 text-sm text-subtle">Central Ãºnica de pendencias fiscais com dono, prazo e impacto.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pendÃªncia..."
          className="mt-4 w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4">
        {filtered.map((item) => (
          <div key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityClass[item.priority]}`}>
                    {item.priority}
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-subtle">{item.status}</span>
                </div>
                <h2 className="mt-3 font-semibold text-ink">{item.problem}</h2>
                <p className="mt-1 text-sm text-subtle">{item.company}</p>
                <p className="mt-1 text-xs text-subtle">ResponsÃ¡vel: {item.responsible} Â· Impacto: {item.impact}</p>
              </div>
              <button type="button" onClick={() => resolveItem(item.id)} className="rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-ink">
                Marcar resolvido
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FiscalInboxView;
