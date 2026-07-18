"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAccountantRequests, transitionAccountantDocumentRequest } from "@/lib/services/accountant-documents-service";

const statuses = ["OPEN", "IN_PROGRESS", "ANSWERED", "RESOLVED", "CANCELLED"];
export function AccountantRequestsView() {
  const params = useSearchParams() ?? new URLSearchParams(); const qc = useQueryClient();
  const companyId = params.get("companyId") || ""; const officeId = params.get("officeId") || "";
  const [status, setStatus] = useState(""); const [reason, setReason] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["accountant-requests", officeId, companyId, status], enabled: Boolean(companyId && officeId), queryFn: () => listAccountantRequests({ officeId, companyId, filters: status ? { status } : {} }) });
  const change = useMutation({ mutationFn: ({ id, next }: { id: string; next: string }) => transitionAccountantDocumentRequest({ officeId, companyId, requestId: id, status: next, responseMessage: reason[id], reason: reason[id] } as never), onSuccess: () => qc.invalidateQueries({ queryKey: ["accountant-requests", officeId, companyId] }) });
  const counts = statuses.reduce<Record<string, number>>((all, item) => ({ ...all, [item]: query.data?.filter((r) => r.status === item).length || 0 }), {});
  if (!companyId || !officeId) return <Card className="p-6">Selecione empresa e escritório para visualizar pendências.</Card>;
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">Pendências contábeis</h1><p className="text-sm text-subtle">Acompanhe solicitações de NF-e e CT-e.</p></div><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{statuses.map((item) => <Card key={item} className="p-3"><p className="text-xs text-subtle">{item}</p><p className="text-2xl font-bold">{counts[item]}</p></Card>)}</div><select className="rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>{query.isLoading ? <p>Carregando...</p> : query.isError ? <Button onClick={() => query.refetch()}>Tentar novamente</Button> : !query.data?.length ? <Card className="p-6">Nenhuma pendência encontrada.</Card> : <div className="space-y-3">{query.data.map((item) => <Card key={String(item.id)} className="p-4"><p className="font-bold">{String(item.type)} · {String(item.priority)} · {String(item.status)}</p><p className="text-sm text-subtle">{String(item.description || "")}</p><textarea className="mt-2 w-full rounded border p-2" placeholder="Justificativa ou nota" value={reason[String(item.id)] || ""} onChange={(e) => setReason({ ...reason, [String(item.id)]: e.target.value })}/><div className="mt-2 flex gap-2">{item.status === "ANSWERED" && <><Button size="sm" onClick={() => change.mutate({ id: String(item.id), next: "RESOLVED" })}>Resolver</Button><Button size="sm" variant="outline" onClick={() => change.mutate({ id: String(item.id), next: "IN_PROGRESS" })}>Devolver</Button></>}{item.status === "RESOLVED" && <Button size="sm" onClick={() => change.mutate({ id: String(item.id), next: "IN_PROGRESS" })}>Reabrir</Button>}{["OPEN", "IN_PROGRESS", "ANSWERED"].includes(String(item.status)) && <Button size="sm" variant="outline" onClick={() => change.mutate({ id: String(item.id), next: "CANCELLED" })}>Cancelar</Button>}</div></Card>)}</div>}</div>;
}
