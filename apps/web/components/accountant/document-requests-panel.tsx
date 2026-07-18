"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createAccountantDocumentRequest,
  listAccountantDocumentRequests,
  createAccountantTransportDocumentRequest,
  listAccountantTransportDocumentRequests,
  transitionAccountantDocumentRequest,
} from "@/lib/services/accountant-documents-service";

type Props = { officeId: string; companyId: string; documentId: string; kind: "FISCAL" | "TRANSPORT" };
const STATUSES = ["OPEN", "IN_PROGRESS", "ANSWERED", "RESOLVED", "CANCELLED"];

export function DocumentRequestsPanel({ officeId, companyId, documentId, kind }: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState("ADDITIONAL_INFORMATION_REQUIRED");
  const [description, setDescription] = useState("");
  const [responseBy, setResponseBy] = useState<Record<string, string>>({});
  const key = ["accountant", officeId, companyId, kind, documentId, "requests"];
  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      kind === "FISCAL"
        ? listAccountantDocumentRequests({ officeId, companyId, documentId })
        : listAccountantTransportDocumentRequests({ officeId, companyId, documentId }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: () =>
      kind === "FISCAL"
        ? createAccountantDocumentRequest({ officeId, companyId, documentId, type, priority: "NORMAL", description })
        : createAccountantTransportDocumentRequest({ officeId, companyId, documentId, type, priority: "NORMAL", description }),
    onSuccess: () => { setDescription(""); refresh(); },
  });
  const transition = useMutation({
    mutationFn: (vars: { requestId: string; status: string }) =>
      transitionAccountantDocumentRequest({
        officeId, companyId, requestId: vars.requestId,
        status: vars.status,
        responseMessage: responseBy[vars.requestId] || undefined,
      }),
    onSuccess: (_data, vars) => {
      setResponseBy((prev) => {
        const next = { ...prev };
        delete next[vars.requestId];
        return next;
      });
      refresh();
    },
  });
  return (
    <Card className="p-5">
      <h2 className="font-extrabold">Solicitações à empresa</h2>
      <select
        className="mt-3 h-9 rounded border px-2 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option>ADDITIONAL_INFORMATION_REQUIRED</option>
        <option>XML_MISSING</option>
        <option>CFOP_INCORRECT</option>
        <option>NCM_MISSING</option>
        <option>OTHER</option>
      </select>
      <textarea
        className="mt-2 min-h-20 w-full rounded border p-2 text-sm"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descreva a pendência"
      />
      <Button
        className="mt-2"
        size="sm"
        disabled={!description.trim() || create.isPending}
        onClick={() => create.mutate()}
      >
        Enviar pendência para a empresa
      </Button>
      {create.isError && (
        <p className="mt-2 text-sm text-red-700">
          Já existe uma solicitação aberta desse tipo ou você não tem permissão.
        </p>
      )}
      {!q.isLoading && !q.data?.length ? (
        <p className="mt-3 text-sm text-subtle">Nenhuma solicitação vinculada a este documento.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {q.data?.map((item) => (
            <li key={String(item.id)} className="rounded bg-muted p-3">
              <div className="font-bold">{String(item.type)} · {String(item.priority)} · {String(item.status)}</div>
              <p className="mt-1 text-subtle">{String(item.description || "")}</p>
              {Boolean(item.responseMessage) && (
                <p className="mt-2 rounded border border-subtle p-2">
                  Resposta: {String(item.responseMessage)}
                </p>
              )}
              {(item.status === "OPEN" || item.status === "IN_PROGRESS" || item.status === "ANSWERED") && (
                <div className="mt-2 space-y-2">
                  <textarea
                    className="min-h-16 w-full rounded border p-2 text-sm"
                    placeholder="Resposta ou justificativa da transição"
                    value={responseBy[String(item.id)] || ""}
                    onChange={(e) => setResponseBy((prev) => ({ ...prev, [String(item.id)]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.filter((s) => s !== item.status).map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant="outline"
                        disabled={(status === "ANSWERED" || status === "RESOLVED") && !(responseBy[String(item.id)] || "").trim()}
                        onClick={() => transition.mutate({ requestId: String(item.id), status })}
                      >
                        {status === "IN_PROGRESS" ? "Assumir" : status}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
