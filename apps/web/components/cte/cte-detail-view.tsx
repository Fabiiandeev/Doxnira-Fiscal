"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileArchive, Link2 } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCte, getCteXml, getLinkedNfe } from "@/lib/services/cte-service";
import { formatCurrency, formatDate, maskCnpj } from "@/lib/utils";

export function CteDetailView({ id }: { id: string }) {
  const cte = useQuery({ queryKey: ["cte", id], queryFn: () => getCte(id) });
  const links = useQuery({ queryKey: ["cte-linked-nfe", id], queryFn: () => getLinkedNfe(id) });
  const xml = useQuery({ queryKey: ["cte-xml", id], queryFn: () => getCteXml(id), enabled: false });
  if (!cte.data) return <div className="h-96 animate-pulse rounded-3xl bg-white/50" />;
  return (
    <>
      <Link href="/documents" className="mb-5 inline-flex items-center gap-2 text-[11px] font-extrabold text-subtle">
        <ArrowLeft className="h-4 w-4" />Voltar para documentos
      </Link>
      <PageHeader eyebrow="Documento de transporte" title={`CT-e ${cte.data.number || "sem número"}`} description={cte.data.issuerName || "Emitente não informado"} icon={FileArchive} />
      <Card className="p-5">
        <Tabs defaultValue="data">
          <TabsList><TabsTrigger value="data">Dados do CT-e</TabsTrigger><TabsTrigger value="links">NF-es vinculadas</TabsTrigger><TabsTrigger value="xml" onClick={() => xml.refetch()}>XML</TabsTrigger></TabsList>
          <TabsContent value="data">
            <div className="grid gap-4 md:grid-cols-2">
              <Item label="Chave" value={cte.data.accessKey} /><Item label="Série" value={cte.data.series || "—"} />
              <Item label="Emissão" value={cte.data.emissionDate ? formatDate(cte.data.emissionDate, true) : "—"} /><Item label="Valor" value={formatCurrency(cte.data.totalAmount)} />
              <Item label="Emitente" value={`${cte.data.issuerName || "—"} · ${cte.data.issuerCnpj ? maskCnpj(cte.data.issuerCnpj) : "—"}`} /><Item label="Status" value={cte.data.status || "—"} />
            </div>
          </TabsContent>
          <TabsContent value="links">
            <div className="space-y-2">{(links.data?.data || []).map((link) => (
              <div key={link.id} className="flex items-center gap-3 rounded-xl bg-muted p-4">
                <Link2 className="h-4 w-4" /><div className="min-w-0 flex-1"><p className="truncate font-mono text-[10px]">{link.nfeAccessKey}</p><p className="mt-1 text-xs font-extrabold">{link.nfeDocument ? `NF-e ${link.nfeDocument.invoiceNumber}` : "NF-e ainda não sincronizada"}</p></div>
                {link.nfeDocument && <Link href={`/documents/${link.nfeDocument.id}`} className="text-[10px] font-extrabold underline">Ver NF-e</Link>}
              </div>
            ))}</div>
          </TabsContent>
          <TabsContent value="xml">
            <pre className="max-h-[480px] overflow-auto rounded-2xl bg-ink p-5 font-mono text-[10px] leading-5 text-emerald-200">{xml.data?.xml || "Carregando XML..."}</pre>
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted p-4"><p className="text-[9px] font-bold uppercase text-subtle">{label}</p><p className="mt-2 break-all text-xs font-extrabold">{value}</p></div>;
}
