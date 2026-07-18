"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  downloadAccountantTransportXml,
  getAccountantTransportDetail,
  getAccountantTransportDocumentXml,
  reprocessAccountantTransportLinks,
} from "@/lib/services/accountant-documents-service";
import { DocumentNotesPanel } from "@/components/accountant/document-notes-panel";
import { DocumentTagsPanel } from "@/components/accountant/document-tags-panel";
import { DocumentReviewPanel } from "@/components/accountant/document-review-panel";
import { DocumentRequestsPanel } from "@/components/accountant/document-requests-panel";
import { formatCurrency } from "@/lib/utils";

type Detail = {
  identification: Record<string, string | boolean | null>;
  issuer: { name?: string; document?: string } | null;
  recipient: { name?: string; document?: string } | null;
  totals: Record<string, string | null>;
  xml: { availability: string; canDownload: boolean; canView: boolean };
  review: { status?: string; user?: { name?: string }; note?: string } | null;
  nfeLinks: Array<{
    id: string;
    accessKey: string;
    source: string;
    createdAt: string;
    xml: { availability: string; canDownload: boolean };
    document: { id: string; invoiceNumber: string | null; series: string | null; totalAmount: string | null };
  }>;
  pendingReferences: Array<{ id: string; accessKey: string; source: string; createdAt: string; status: string }>;
};

export function TransportDocumentDetailView({ documentId }: { documentId: string }) {
  const params = useSearchParams();
  const companyId = params?.get("companyId") || "";
  const officeId = params?.get("officeId") || "";
  const client = useQueryClient();
  const [showXml, setShowXml] = useState(false);
  const key = ["accountant", officeId, companyId, "transport-document", documentId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => getAccountantTransportDetail({ officeId, companyId, documentId }),
    enabled: Boolean(companyId && officeId),
  });
  const xmlQuery = useQuery({
    queryKey: ["accountant", officeId, companyId, "transport-document-xml", documentId],
    queryFn: () => getAccountantTransportDocumentXml({ officeId, companyId, documentId }),
    enabled: showXml && Boolean(companyId && officeId),
  });
  const reprocess = useMutation({
    mutationFn: () => reprocessAccountantTransportLinks({ officeId, companyId, documentId }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: key });
      client.invalidateQueries({ queryKey: ["accountant", officeId, companyId, "transport-documents"] });
      client.invalidateQueries({ queryKey: ["accountant", officeId, companyId, "transport-documents-summary"] });
    },
  });
  const download = useMutation({
    mutationFn: async () => {
      const blob = await downloadAccountantTransportXml({ officeId, companyId, documentId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CTE-${documentId}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
  if (q.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  if (q.isError || !q.data) return <Card className="p-8"><p className="font-bold">CT-e não disponível neste contexto.</p></Card>;
  const d = q.data as Detail;
  return (
    <>
      <Link href={`/accountant/transport-documents?companyId=${companyId}&officeId=${officeId}`} className="text-sm underline">
        Voltar para CT-e
      </Link>
      <div className="my-5 flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs">CT-e</p>
          <h1 className="text-3xl font-extrabold">CT-e {String(d.identification.number || "—")}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(String(d.identification.accessKey || ""))}>Copiar chave</Button>
          <Button variant="outline" onClick={() => client.invalidateQueries({ queryKey: key })} disabled={q.isFetching}>
            Atualizar
          </Button>
        </div>
      </div>
      {d.identification.isCancelled && (
        <Card className="border-red-300 bg-red-50 p-4 text-red-800">CT-e cancelado.</Card>
      )}
      <div className="my-5 grid gap-4 md:grid-cols-2">
        <Section title="Identificação" values={d.identification} />
        <Section title="Emitente" values={d.issuer || {}} />
        <Section title="Destinatário" values={d.recipient || {}} />
        <Section
          title="Totais"
          values={Object.fromEntries(
            Object.entries(d.totals).map(([k, v]) => [k, v == null ? null : formatCurrency(Number(v))]),
          )}
        />
      </div>

      <Card className="my-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold">XML</h2>
            <p className="text-sm text-subtle">
              Disponibilidade: {d.xml.availability}. Visualização permitida conforme concessão do escritório.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!d.xml.canView}
              onClick={() => setShowXml((value) => !value)}
            >
              {showXml ? "Ocultar XML" : "Visualizar XML"}
            </Button>
            <Button
              variant="outline"
              disabled={!d.xml.canDownload || download.isPending}
              onClick={() => download.mutate()}
            >
              {download.isPending ? "Baixando…" : "Baixar XML"}
            </Button>
          </div>
        </div>
        {showXml && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-muted p-4 text-xs">
            {xmlQuery.isLoading ? "Carregando XML…" : xmlQuery.isError ? "XML não disponível para visualização." : xmlQuery.data?.xml || "XML ausente."}
          </pre>
        )}
      </Card>

      {d.review && (
        <div className="my-5">
          <DocumentReviewPanel
            officeId={officeId}
            companyId={companyId}
            documentId={documentId}
            status={d.review.status}
            kind="TRANSPORT"
          />
        </div>
      )}
      {!d.review && (
        <div className="my-5">
          <DocumentReviewPanel officeId={officeId} companyId={companyId} documentId={documentId} kind="TRANSPORT" />
        </div>
      )}

      <div className="my-5 grid gap-5 lg:grid-cols-2">
        <DocumentNotesPanel officeId={officeId} companyId={companyId} documentId={documentId} kind="TRANSPORT" />
        <DocumentTagsPanel officeId={officeId} companyId={companyId} documentId={documentId} kind="TRANSPORT" />
      </div>

      {(d.nfeLinks.length > 0 || d.pendingReferences.length > 0) && (
        <Card className="my-5 p-5">
          <h2 className="font-extrabold">Vínculos com NF-e</h2>
          {d.nfeLinks.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {d.nfeLinks.map((link) => (
                <li key={link.id} className="rounded bg-muted p-2">
                  <Link className="font-bold underline" href={`/accountant/documents/${link.document.id}?officeId=${officeId}&companyId=${companyId}`}>
                    NF-e {link.document.invoiceNumber || "—"} (série {link.document.series || "—"})
                  </Link>
                  <p className="text-subtle">Chave {link.accessKey}</p>
                  <p className="text-subtle">Origem: {link.source} · XML: {link.xml.availability}</p>
                </li>
              ))}
            </ul>
          )}
          {d.pendingReferences.length > 0 && (
            <div className="mt-3">
              <p className="font-bold text-subtle">Referências pendentes:</p>
              <ul className="mt-2 space-y-2 text-sm">
                {d.pendingReferences.map((ref) => (
                  <li key={ref.id} className="rounded bg-muted p-2">
                    Chave {ref.accessKey} · Status: {ref.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            disabled={reprocess.isPending}
            onClick={() => reprocess.mutate()}
          >
            {reprocess.isPending ? "Reprocessando…" : "Reprocessar vínculos"}
          </Button>
          {reprocess.isSuccess && (
            <p className="mt-2 text-sm text-green-700">
              Vínculos reprocessados: {String((reprocess.data as { created?: number })?.created ?? 0)} criados, {String((reprocess.data as { alreadyExisting?: number })?.alreadyExisting ?? 0)} existentes, {String((reprocess.data as { pending?: number })?.pending ?? 0)} pendentes.
            </p>
          )}
          {reprocess.isError && (
            <p className="mt-2 text-sm text-red-700">Falha ao reprocessar vínculos.</p>
          )}
        </Card>
      )}

      <div className="my-5">
        <DocumentRequestsPanel officeId={officeId} companyId={companyId} documentId={documentId} kind="TRANSPORT" />
      </div>
    </>
  );
}

function Section({ title, values }: { title: string; values: Record<string, unknown> }) {
  return (
    <Card className="p-5">
      <h2 className="font-extrabold">{title}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {Object.entries(values).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-subtle">{k}</dt>
            <dd>{String(v ?? "Não informado")}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
