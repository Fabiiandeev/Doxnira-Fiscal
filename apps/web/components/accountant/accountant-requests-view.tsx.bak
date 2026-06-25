"use client";

import { useState, useEffect } from "react";
import { Building2, CheckCircle2, Mail, MessageCircle, Send, Shield, User, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClientRequests, sendClientRequest, updateClientRequestStatus, resendClientRequest } from "@/lib/services/fiscal/accountant-service";
import type { ClientRequest } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors = { SENT: "bg-blue-50 text-blue-700", VIEWED: "bg-purple-50 text-purple-700", ANSWERED: "bg-yellow-50 text-yellow-700", RESOLVED: "bg-green-50 text-green-700", EXPIRED: "bg-red-50 text-red-700" };
const channelIcons = { WHATSAPP: MessageCircle, EMAIL: Mail, INTERNAL: Shield, SECURE_LINK: Send };

export function AccountantRequestsView() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newRequest, setNewRequest] = useState({ companyId: "", message: "", channels: ["WHATSAPP", "EMAIL"] as any });

  useEffect(() => {
    const load = async () => { setLoading(true); const data = await getClientRequests(); setRequests(data); setLoading(false); };
    load();
  }, []);

  const handleSend = async () => {
    const req = await sendClientRequest(newRequest);
    setRequests(prev => [req, ...prev]);
    setShowNew(false);
    setNewRequest({ companyId: "", message: "", channels: ["WHATSAPP", "EMAIL"] });
    notify({ title: "Solicitacao enviada" });
  };

  if (loading) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Solicitacoes ao Cliente</h1><p className="text-sm text-subtle">Centralize solicitacoes e documentos pendentes das empresas</p></div>
        <Button variant="lime" onClick={() => setShowNew(true)}><Send className="h-4 w-4" /> Nova solicitacao</Button>
      </div>

      {showNew && (
        <Card className="p-4">
          <h3 className="font-bold mb-3">Nova solicitacao</h3>
          <div className="space-y-3">
            <select value={newRequest.companyId} onChange={e => setNewRequest(p => ({ ...p, companyId: e.target.value }))} className="h-10 rounded-xl border border-line bg-white px-3 w-full"><option value="">Selecione empresa</option><option value="comp-1">Gama Tech LTDA</option><option value="comp-2">Beta Servicos ME</option><option value="comp-3">Delta Autopecas SA</option></select>
            <textarea value={newRequest.message} onChange={e => setNewRequest(p => ({ ...p, message: e.target.value }))} placeholder="Mensagem para o cliente..." className="h-32 rounded-xl border border-line bg-white px-3 w-full" />
            <div className="flex flex-wrap gap-2">
              {["WHATSAPP", "EMAIL", "INTERNAL", "SECURE_LINK"].map(ch => (
                <label key={ch} className="flex items-center gap-2"><input type="checkbox" checked={newRequest.channels.includes(ch)} onChange={e => setNewRequest(p => ({ ...p, channels: e.target.checked ? [...p.channels, ch] : p.channels.filter(c => c !== ch) }))} className="h-4 w-4 accent-ink" /><span className="flex items-center gap-1"><channelIcons[ch] className="h-4 w-4" />{ch}</span></label>
              ))}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button><Button variant="lime" onClick={handleSend} disabled={!newRequest.companyId || !newRequest.message}>Enviar</Button></div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-bold mb-3">Solicitacoes ({requests.length})</h3>
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="p-4 rounded-xl border border-line bg-white">
              <div className="flex items-start justify-between mb-3">
                <div><Building2 className="h-4 w-4 inline mr-1" />{req.companyName}</div>
                <Badge className={statusColors[req.status]}>{req.status}</Badge>
              </div>
              <p className="text-sm mb-3">{req.message}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {req.channels.map(ch => <Badge key={ch} variant="outline"><channelIcons[ch] className="h-3 w-3 mr-1" />{ch}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-subtle mb-3">
                <span>Enviado: {formatDate(req.sentAt)}</span>
                {req.viewedAt && <span>Visto: {formatDate(req.viewedAt)}</span>}
                {req.answeredAt && <span>Respondido: {formatDate(req.answeredAt)}</span>}
                {req.resolvedAt && <span>Resolvido: {formatDate(req.resolvedAt)}</span>}
                <span>Expira: {formatDate(req.expiresAt)}</span>
              </div>
              <div className="flex gap-2">
                {req.status !== "RESOLVED" && <Button variant="outline" size="sm" onClick={() => { resendClientRequest(req.id, req.channels); notify({ title: "Reenviado" }); }}>Reenviar</Button>}
                {req.status === "SENT" && <Button variant="outline" size="sm" onClick={() => { updateClientRequestStatus(req.id, "VIEWED"); notify({ title: "Marcado como visto" }); }}>Marcar visto</Button>}
                {req.status === "VIEWED" && <Button variant="outline" size="sm" onClick={() => { updateClientRequestStatus(req.id, "ANSWERED"); notify({ title: "Marcado como respondido" }); }}>Marcar respondido</Button>}
                <Button variant={req.status === "RESOLVED" ? "outline" : "default"} size="sm" onClick={() => { updateClientRequestStatus(req.id, req.status === "RESOLVED" ? "SENT" : "RESOLVED"); notify({ title: req.status === "RESOLVED" ? "Reaberto" : "Resolvido" }); }}>{req.status === "RESOLVED" ? "Reabrir" : "Resolver"}</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

