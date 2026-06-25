"use client";

import { useMemo, useState } from "react";

type Channel = "WhatsApp" | "E-mail" | "NotificaÃ§Ã£o" | "Link seguro";

type ClientRequest = {
  id: string;
  company: string;
  message: string;
  channels: Channel[];
  status: "Enviado" | "Visualizado" | "Respondido" | "Resolvido" | "Vencido";
};

const initialRequests: ClientRequest[] = [
  {
    id: "req-1",
    company: "Beta ServiÃ§os Ltda.",
    message: "Existem 3 XMLs de entrada pendentes e 2 produtos sem NCM.",
    channels: ["WhatsApp", "E-mail"],
    status: "Enviado",
  },
  {
    id: "req-2",
    company: "Gama Tech Ltda.",
    message: "Certificado digital vence em 8 dias.",
    channels: ["NotificaÃ§Ã£o", "Link seguro"],
    status: "Visualizado",
  },
];

export function AccountantRequestsView() {
  const [requests, setRequests] = useState<ClientRequest[]>(initialRequests);
  const [query, setQuery] = useState("");

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return requests;
    return requests.filter((request) => request.company.toLowerCase().includes(normalized));
  }, [query, requests]);

  function markAsResolved(id: string) {
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status: "Resolvido" } : request)),
    );
  }

  function resend(id: string) {
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status: "Enviado" } : request)),
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">SolicitaÃ§Ãµes ao cliente</h1>
        <p className="mt-2 text-sm text-slate-600">Envie pendÃªncias por WhatsApp, e-mail, notificaÃ§Ã£o interna ou link seguro.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar empresa..."
          className="mt-4 w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4">
        {filteredRequests.map((request) => (
          <div key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">{request.company}</h2>
                <p className="mt-1 text-sm text-slate-600">{request.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {request.channels.map((channel) => (
                    <span key={channel} className="rounded-full border px-3 py-1 text-xs text-slate-600">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{request.status}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => resend(request.id)} className="rounded-xl border px-3 py-2 text-xs font-semibold">
                Reenviar
              </button>
              <button type="button" onClick={() => markAsResolved(request.id)} className="rounded-xl bg-lime-300 px-3 py-2 text-xs font-semibold text-slate-950">
                Marcar resolvido
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AccountantRequestsView;
