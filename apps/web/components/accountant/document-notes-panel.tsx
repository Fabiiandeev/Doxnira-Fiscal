"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createAccountantDocumentNote,
  deleteAccountantDocumentNote,
  listAccountantDocumentNotes,
  createAccountantTransportDocumentNote,
  deleteAccountantTransportDocumentNote,
  listAccountantTransportDocumentNotes,
} from "@/lib/services/accountant-documents-service";

type Props = { officeId: string; companyId: string; documentId: string; kind: "FISCAL" | "TRANSPORT" };

export function DocumentNotesPanel({ officeId, companyId, documentId, kind }: Props) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const key = ["accountant", officeId, companyId, kind, documentId, "notes"];
  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      kind === "FISCAL"
        ? listAccountantDocumentNotes({ officeId, companyId, documentId })
        : listAccountantTransportDocumentNotes({ officeId, companyId, documentId }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: () =>
      kind === "FISCAL"
        ? createAccountantDocumentNote({ officeId, companyId, documentId, content })
        : createAccountantTransportDocumentNote({ officeId, companyId, documentId, content }),
    onSuccess: () => { setContent(""); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (noteId: string) =>
      kind === "FISCAL"
        ? deleteAccountantDocumentNote({ officeId, companyId, documentId, noteId })
        : deleteAccountantTransportDocumentNote({ officeId, companyId, documentId, noteId }),
    onSuccess: refresh,
  });
  return (
    <Card className="p-5">
      <h2 className="font-extrabold">Observações contábeis</h2>
      <textarea
        className="mt-3 min-h-20 w-full rounded border p-2 text-sm"
        value={content}
        maxLength={5000}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Registrar observação"
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={!content.trim() || create.isPending} onClick={() => create.mutate()}>
          Adicionar
        </Button>
        {editing && (
          <Button size="sm" variant="outline" onClick={() => { setEditing(null); setContent(""); }}>
            Cancelar
          </Button>
        )}
      </div>
      {q.isError ? (
        <Button className="mt-3" size="sm" variant="outline" onClick={() => q.refetch()}>
          Tentar novamente
        </Button>
      ) : q.isLoading ? (
        <p className="mt-3 text-sm text-subtle">Carregando…</p>
      ) : !q.data?.length ? (
        <p className="mt-3 text-sm text-subtle">Nenhuma observação registrada.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {q.data.map((note) => (
            <li key={String(note.id)} className="rounded bg-muted p-3 text-sm">
              <p>{String(note.content)}</p>
              <div className="mt-2 flex justify-between text-xs text-subtle">
                <span>{String((note.author as { name?: string } | undefined)?.name || "Usuário")}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(String(note.id))}
                  disabled={remove.isPending}
                >
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
