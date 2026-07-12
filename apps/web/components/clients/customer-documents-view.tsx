"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getClient,
  listClientDocuments,
  type CustomerFiscalDocument,
} from "@/lib/services/cliente-service";
import type { IntelligentClient } from "@/lib/client-types";
import { maskCnpj, maskCpf } from "@/lib/utils";

function clientName(client: IntelligentClient | null) {
  return client?.razaoSocial || client?.nomeFantasia || client?.nome || "Cliente";
}

function documentLabel(client: IntelligentClient | null) {
  if (!client) return "";
  if (client.tipoPessoa === "PJ" && client.cnpj) return maskCnpj(client.cnpj);
  if (client.cpf) return maskCpf(client.cpf);
  return "Documento não informado";
}

export function CustomerDocumentsView({ customerId }: { customerId: string }) {
  const [client, setClient] = useState<IntelligentClient | null>(null);
  const [documents, setDocuments] = useState<CustomerFiscalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [nextClient, nextDocuments] = await Promise.all([
          getClient(customerId),
          listClientDocuments(customerId),
        ]);
        if (!active) return;
        setClient(nextClient);
        setDocuments(nextDocuments);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar documentos.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [customerId]);

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-subtle" />
        <p className="text-sm text-subtle">Carregando documentos fiscais do cliente...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-bold text-red-600">{error}</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/customers">Voltar para clientes</Link></Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Link href={`/customers/${customerId}`} className="inline-flex items-center gap-2 text-[11px] font-extrabold text-subtle">
        <ArrowLeft className="h-4 w-4" />
        Voltar para o cliente
      </Link>
      <PageHeader
        eyebrow="Documentos fiscais"
        title={clientName(client)}
        description={documentLabel(client)}
        icon={FileText}
        action={(
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`/documents?customerId=${customerId}`}>Abrir central fiscal</Link></Button>
            <Button variant="lime" onClick={() => notify({ title: "Importação XML", description: "Use a central fiscal para importar XMLs e vincular por CNPJ." })}>
              <Upload className="h-4 w-4" /> Importar XML
            </Button>
          </div>
        )}
      />

      {documents.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-subtle" />
          <h2 className="text-xl font-bold text-ink">Nenhum documento fiscal vinculado.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-subtle">
            Importe XMLs ou emita notas para que os documentos deste cliente apareçam aqui automaticamente.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="lime"><Link href={`/emitir-nota?customerId=${customerId}`}>Emitir nota</Link></Button>
            <Button asChild variant="outline"><Link href={`/documents?customerId=${customerId}`}>Importar XML</Link></Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase text-subtle">
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Chave</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Emissão</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((document) => (
                  <tr key={document.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3.5 text-sm font-bold text-ink">
                      {document.documentType} {document.invoiceNumber || "--"} {document.series ? `· Série ${document.series}` : ""}
                    </td>
                    <td className="px-4 py-3.5 max-w-[360px] truncate font-mono text-xs text-subtle">{document.accessKey || "--"}</td>
                    <td className="px-4 py-3.5"><Badge variant={document.status === "authorized" ? "success" : "neutral"}>{document.status || "Pendente"}</Badge></td>
                    <td className="px-4 py-3.5 text-sm text-subtle">{document.emissionDate ? new Date(document.emissionDate).toLocaleDateString("pt-BR") : "--"}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-bold text-ink">{document.totalAmount == null ? "--" : document.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="px-4 py-3.5 text-center"><Button asChild variant="outline" size="sm"><Link href={`/documents/${document.id}`}>Abrir</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
