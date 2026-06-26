"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { notify } from "@/components/toast-viewport";
import {
  getClientRequests,
  updateClientRequestStatus,
  resendClientRequest,
} from "@/lib/services/fiscal/accountant-service";
import type { ClientRequest, RequestChannel } from "@/lib/fiscal-types";

const STATUS_LABELS: Record<string, string> = {
  SENT: "Enviado",
  VIEWED: "Visualizado",
  ANSWERED: "Respondido",
  RESOLVED: "Resolvido",
  EXPIRED: "Vencido",
};

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  INTERNAL: "Notificacao",
  SECURE_LINK: "Link seguro",
};

export function AccountantRequestsView() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const data = await getClientRequests();
      setRequests(data);
    } catch {
      setError("Nao foi possivel carregar solicitacoes. Tente novamente.");
      notify({ title: "Erro ao carregar solicitacoes", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return requests;
    return requests.filter((r) =>
      r.companyName.toLowerCase().includes(normalized),
    );
  }, [query, requests]);

  const handleMarkAsResolved = async (id: string) => {
    try {
      await updateClientRequestStatus(id, "RESOLVED");
      notify({ title: "Solicitacao resolvida", tone: "success" });
      fetchRequests();
    } catch {
      notify({ title: "Erro ao resolver solicitacao", tone: "error" });
    }
  };

  const handleResend = async (id: string, channels: ClientRequest["channels"]) => {
    try {
      await resendClientRequest(id, channels);
      notify({ title: "Solicitacao reenviada", tone: "success" });
      fetchRequests();
    } catch {
      notify({ title: "Erro ao reenviar solicitacao", tone: "error" });
    }
  };

  if (loading) {
    return <div className="p-8 text-subtle">Carregando solicitacoes...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-ink">Solicitacoes ao cliente</h1>
          <p className="mt-4 text-sm text-red-600">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchRequests}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-ink">Solicitacoes ao cliente</h1>
        <p className="mt-2 text-sm text-subtle">Envie pendencias por WhatsApp, e-mail, notificacao interna ou link seguro.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar empresa..."
          className="mt-4 w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      {filteredRequests.length === 0 ? (
        <Card className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-subtle">Nenhuma solicitacao encontrada.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => (
            <div key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-ink">{request.companyName}</h2>
                  <p className="mt-1 text-sm text-subtle">{request.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.channels.map((channel: RequestChannel) => (
                      <span key={channel} className="rounded-full border px-3 py-1 text-xs text-subtle">
                        {CHANNEL_LABELS[channel] ?? channel}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-subtle">
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleResend(request.id, request.channels)}
                  className="rounded-xl border px-3 py-2 text-xs font-semibold"
                >
                  Reenviar
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkAsResolved(request.id)}
                  className="rounded-xl bg-lime px-3 py-2 text-xs font-semibold text-ink"
                >
                  Marcar resolvido
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AccountantRequestsView;
