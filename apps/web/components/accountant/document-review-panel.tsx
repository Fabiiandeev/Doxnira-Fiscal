"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  listAccountantDocumentReviewHistory,
  updateAccountantDocumentReview,
  listAccountantTransportDocumentReviewHistory,
  updateAccountantTransportDocumentReview,
} from "@/lib/services/accountant-documents-service";

type Props = { officeId: string; companyId: string; documentId: string; status?: string; kind: "FISCAL" | "TRANSPORT" };
const actions = ["REVIEWED", "WITH_ISSUES", "IGNORED", "REOPENED"];

export function DocumentReviewPanel({ officeId, companyId, documentId, status = "PENDING", kind }: Props) {
  const client = useQueryClient();
  const [next, setNext] = useState("REVIEWED");
  const [note, setNote] = useState("");
  const key = ["accountant", officeId, companyId, kind, documentId, "review-history"];
  const history = useQuery({
    queryKey: key,
    queryFn: () =>
      kind === "FISCAL"
        ? listAccountantDocumentReviewHistory({ officeId, companyId, documentId })
        : listAccountantTransportDocumentReviewHistory({ officeId, companyId, documentId }),
  });
  const save = useMutation({
    mutationFn: () =>
      kind === "FISCAL"
        ? updateAccountantDocumentReview({
            officeId, companyId, documentId,
            status: next, note,
            reopenReason: next === "REOPENED" ? note : undefined,
            category: next === "WITH_ISSUES" ? "OTHER" : undefined,
            priority: next === "WITH_ISSUES" ? "MEDIUM" : undefined,
          })
        : updateAccountantTransportDocumentReview({
            officeId, companyId, documentId,
            status: next, note,
            reopenReason: next === "REOPENED" ? note : undefined,
            category: next === "WITH_ISSUES" ? "OTHER" : undefined,
            priority: next === "WITH_ISSUES" ? "MEDIUM" : undefined,
          }),
    onSuccess: () => {
      setNote("");
      client.invalidateQueries({ queryKey: ["accountant", officeId, companyId, "fiscal-document", documentId] });
      client.invalidateQueries({ queryKey: ["accountant", officeId, companyId, "transport-document", documentId] });
      client.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <Card className="p-5">
      <h2 className="font-extrabold">Conferência</h2>
      <p className="mt-1 text-sm text-subtle">Status atual: {status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((item) => (
          <Button key={item} size="sm" variant={next === item ? "default" : "outline"} onClick={() => setNext(item)}>
            {item}
          </Button>
        ))}
      </div>
      <textarea
        className="mt-3 min-h-20 w-full rounded-lg border border-line bg-background p-3 text-sm"
        value={note}
        maxLength={5000}
        onChange={(event) => setNote(event.target.value)}
        placeholder={next === "REVIEWED" ? "Observação opcional" : "Justificativa obrigatória"}
      />
      <Button className="mt-3" disabled={save.isPending || (next !== "REVIEWED" && !note.trim())} onClick={() => save.mutate()}>
        {save.isPending ? "Salvando…" : "Atualizar conferência"}
      </Button>
      {save.isError && (
        <p className="mt-2 text-sm text-red-700">Não foi possível atualizar a conferência. Verifique a transição e as permissões.</p>
      )}
      <h3 className="mt-5 font-bold">Histórico</h3>
      {history.isLoading ? (
        <p className="text-sm text-subtle">Carregando…</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {history.data?.map((entry) => (
            <li key={String(entry.id)} className="rounded bg-muted p-2">
              {String(entry.previousStatus || "PENDING")} → {String(entry.status)} · {String((entry.user as { name?: string } | undefined)?.name || "Usuário")}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
