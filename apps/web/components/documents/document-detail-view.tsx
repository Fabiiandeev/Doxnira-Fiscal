"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Check,
  Clipboard,
  Download,
  FileText,
  Hash,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

import { AuditTimeline } from "@/components/audit-timeline";
import { ManifestationModal } from "@/components/manifestation-modal";
import { PageHeader } from "@/components/page-header";
import {
  FiscalStatusBadge,
  ManifestationBadge,
  XmlTypeBadge,
} from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notify } from "@/components/toast-viewport";
import { getDocument, getDocumentXml } from "@/lib/services/fiscal-service";
import { getLinkedCte } from "@/lib/services/cte-service";
import { formatCurrency, formatDate, maskCnpj } from "@/lib/utils";

const products = [
  {
    code: "CMP-8841",
    description: "Módulo controlador industrial X4",
    ncm: "85371090",
    quantity: 12,
    unit: "UN",
    total: 28680,
  },
  {
    code: "CAB-1032",
    description: "Conjunto de cabos blindados 2m",
    ncm: "85444200",
    quantity: 48,
    unit: "UN",
    total: 9360,
  },
  {
    code: "SUP-4420",
    description: "Suporte técnico de instalação",
    ncm: "00000000",
    quantity: 1,
    unit: "SV",
    total: 4200,
  },
];

const XmlViewer = dynamic(
  () => import("@/components/xml-viewer").then((module) => module.XmlViewer),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-2xl bg-ink/90" /> },
);

export function DocumentDetailView({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const { data: document } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument(id),
  });
  const linkedCte = useQuery({
    queryKey: ["document-linked-cte", id],
    queryFn: () => getLinkedCte(id),
  });

  if (!document) {
    return <div className="h-96 animate-pulse rounded-3xl bg-white/50" />;
  }

  const accessKey = document.accessKey;
  const documentId = document.id;

  async function copyAccessKey() {
    await navigator.clipboard.writeText(accessKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function downloadXml() {
    try {
      const result = await getDocumentXml(documentId, true);
      const url = URL.createObjectURL(new Blob([result.xml], { type: "application/xml" }));
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${result.accessKey}.xml`;
      link.click();
      URL.revokeObjectURL(url);
      notify({ title: "XML baixado", description: "A ação foi registrada na auditoria." });
    } catch (error) {
      notify({ title: "XML indisponível", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <>
      <Link
        href="/documents"
        className="mb-5 inline-flex items-center gap-2 text-[11px] font-extrabold text-subtle hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para documentos
      </Link>
      <PageHeader
        eyebrow={`NF-e · Série ${document.series}`}
        title={`Nota fiscal ${document.invoiceNumber}`}
        description={`Emitida por ${document.issuerName} em ${formatDate(document.emissionDate, true)}.`}
        icon={FileText}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadXml}>
              <Download className="h-4 w-4" />
              Baixar XML
            </Button>
            <ManifestationModal documentIds={[document.id]} />
          </div>
        }
      />

      <Card className="mb-5 overflow-hidden">
        <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCell
            label="Valor total"
            value={formatCurrency(document.totalAmount)}
            icon={PackageCheck}
          />
          <SummaryCell
            label="Situação"
            value={<FiscalStatusBadge status={document.status} />}
            icon={ShieldCheck}
          />
          <SummaryCell
            label="Disponibilidade"
            value={<XmlTypeBadge type={document.xmlType} />}
            icon={FileText}
          />
          <SummaryCell
            label="Manifestação"
            value={<ManifestationBadge status={document.manifestationStatus} />}
            icon={Check}
          />
        </div>
        <div className="border-t border-line bg-white px-5 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 text-subtle">
              <Hash className="h-4 w-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">
                Chave de acesso
              </span>
            </div>
            <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold text-ink lg:px-3">
              {document.accessKey}
            </code>
            <Button variant="ghost" size="sm" onClick={copyAccessKey}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copiada" : "Copiar chave"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-extrabold">CT-es vinculados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-[10px]">
            <thead className="bg-muted text-[9px] font-extrabold uppercase text-subtle">
              <tr><th className="px-5 py-3">Chave CT-e</th><th className="px-4 py-3">Número</th><th className="px-4 py-3">Série</th><th className="px-4 py-3">Emitente</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {(linkedCte.data?.data || []).map((link) => (
                <tr key={link.id} className="border-t border-line">
                  <td className="max-w-52 truncate px-5 py-4 font-mono">{link.cteDocument.accessKey}</td>
                  <td className="px-4 py-4 font-extrabold">{link.cteDocument.number || "—"}</td>
                  <td className="px-4 py-4">{link.cteDocument.series || "—"}</td>
                  <td className="px-4 py-4">{link.cteDocument.issuerName || "—"}</td>
                  <td className="px-4 py-4">{link.cteDocument.emissionDate ? formatDate(link.cteDocument.emissionDate) : "—"}</td>
                  <td className="px-4 py-4 font-extrabold">{formatCurrency(link.cteDocument.totalAmount)}</td>
                  <td className="px-4 py-4">{link.cteDocument.status || "—"}</td>
                  <td className="px-4 py-4"><Link href={`/cte/${link.cteDocument.id}`} className="font-extrabold underline">Ver CT-e</Link></td>
                </tr>
              ))}
              {!linkedCte.isLoading && !linkedCte.data?.data.length && <tr><td colSpan={8} className="px-5 py-8 text-center text-subtle">Nenhum CT-e vinculado.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <Tabs defaultValue="summary">
          <div className="scrollbar-none overflow-x-auto">
            <TabsList className="w-max">
              <TabsTrigger value="summary">Resumo</TabsTrigger>
              <TabsTrigger value="issuer">Emitente</TabsTrigger>
              <TabsTrigger value="recipient">Destinatário</TabsTrigger>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="taxes">Impostos</TabsTrigger>
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="xml">XML</TabsTrigger>
              <TabsTrigger value="audit">Auditoria</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="summary">
            <div className="grid gap-5 lg:grid-cols-2">
              <DetailSection title="Identificação do documento" icon={FileText}>
                <DetailRow label="Número" value={document.invoiceNumber} />
                <DetailRow label="Série" value={document.series} />
                <DetailRow label="Modelo" value="55 - NF-e" />
                <DetailRow label="Natureza da operação" value="Venda de mercadoria adquirida" />
                <DetailRow label="Protocolo" value={document.protocol} />
                <DetailRow label="NSU" value={document.nsu} />
              </DetailSection>
              <DetailSection title="Processamento fiscal" icon={ShieldCheck}>
                <DetailRow label="Schema" value={document.xmlType === "FULL" ? "procNFe_v4.00" : "resNFe_v1.01"} />
                <DetailRow label="CFOP principal" value={document.cfop} />
                <DetailRow label="Ambiente" value="Produção" />
                <DetailRow label="Hash SHA-256" value="8ab2••••••••••••••••••••e913" />
                <DetailRow label="Indexado em" value="18 jun 2026, 12:04" />
                <DetailRow label="Revisão interna" value="Pendente" />
              </DetailSection>
            </div>
          </TabsContent>

          <TabsContent value="issuer">
            <DetailSection title="Dados do emitente" icon={Building2}>
              <DetailRow label="Razão social" value={document.issuerName} />
              <DetailRow label="CNPJ" value={maskCnpj(document.issuerCnpj)} />
              <DetailRow label="UF" value={document.uf} />
              <DetailRow label="Inscrição estadual" value="143.882.019.114" />
              <DetailRow label="Município" value="São Paulo" />
              <DetailRow label="Fornecedor novo" value={document.isNewSupplier ? "Sim" : "Não"} />
            </DetailSection>
          </TabsContent>

          <TabsContent value="recipient">
            <DetailSection title="Dados do destinatário" icon={Building2}>
              <DetailRow label="Razão social" value={document.recipientName} />
              <DetailRow label="CNPJ" value={maskCnpj(document.recipientCnpj)} />
              <DetailRow label="Inscrição estadual" value="107.882.390.117" />
              <DetailRow label="UF" value="SP" />
              <DetailRow label="Ambiente fiscal" value="Produção" />
            </DetailSection>
          </TabsContent>

          <TabsContent value="products">
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-muted text-[9px] font-extrabold uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Produto / serviço</th>
                    <th className="px-4 py-3">NCM</th>
                    <th className="px-4 py-3">Quantidade</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.code} className="border-t border-line">
                      <td className="px-4 py-4 font-extrabold">{product.code}</td>
                      <td className="px-4 py-4 font-bold">{product.description}</td>
                      <td className="px-4 py-4 text-subtle">{product.ncm}</td>
                      <td className="px-4 py-4">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="px-4 py-4 font-extrabold">
                        {formatCurrency(product.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="taxes">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Base ICMS", "R$ 39.840,00"],
                ["Valor ICMS", "R$ 7.171,20"],
                ["Valor IPI", "R$ 1.206,40"],
                ["Total tributos", "R$ 10.884,90"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-muted p-5">
                  <p className="text-[10px] font-bold text-subtle">{label}</p>
                  <p className="mt-3 text-xl font-extrabold">{value}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="events">
            <div className="rounded-2xl bg-muted p-5">
              <p className="text-xs font-extrabold">Autorização de uso</p>
              <p className="mt-1 text-[10px] text-subtle">
                Protocolo {document.protocol} · 18 jun 2026, 08:19
              </p>
            </div>
          </TabsContent>

          <TabsContent value="xml">
            <XmlViewer documentId={document.id} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditTimeline />
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}

function SummaryCell({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof PackageCheck;
}) {
  return (
    <div className="flex items-center gap-4 bg-white p-5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-subtle">{label}</p>
        <div className="mt-1 text-sm font-extrabold">{value}</div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-subtle" />
        <h3 className="text-xs font-extrabold">{title}</h3>
      </div>
      <dl>{children}</dl>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-4 border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
      <dt className="text-[10px] font-bold text-subtle">{label}</dt>
      <dd className="text-[11px] font-extrabold text-ink">{value}</dd>
    </div>
  );
}
