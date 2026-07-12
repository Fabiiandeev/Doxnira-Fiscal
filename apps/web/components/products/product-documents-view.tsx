"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Package, RefreshCw, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProduct, listProductDocuments } from "@/lib/services/product-service";
import type { Product, ProductFiscalDocumentItem } from "@/lib/product-types";
import { formatCurrency } from "@/lib/utils";

export function ProductDocumentsView({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [documents, setDocuments] = useState<ProductFiscalDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [productData, documentData] = await Promise.all([
        getProduct(productId),
        listProductDocuments(productId),
      ]);
      setProduct(productData);
      setDocuments(documentData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar documentos.");
      notify({ title: "Erro ao carregar documentos do produto", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-subtle" />
        <p className="text-sm text-subtle">Carregando documentos vinculados...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchData}>Tentar novamente</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="w-fit">
        <Link href={`/products/${productId}`}><ArrowLeft className="h-4 w-4" /> Voltar para produto</Link>
      </Button>

      <PageHeader
        eyebrow="Produtos"
        title="Documentos fiscais"
        description={product ? `Documentos vinculados a ${product.name}.` : "Documentos vinculados ao produto."}
        icon={FileText}
        action={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
            <Button variant="outline" onClick={() => notify({ title: "Importação XML em preparação", description: "Use XML Fiscal para importar e vincular itens ao produto." })}>
              <Upload className="h-4 w-4" /> Importar XML
            </Button>
          </div>
        )}
      />

      {documents.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="mx-auto mb-3 h-12 w-12 text-subtle" />
          <h2 className="text-xl font-bold text-ink">Nenhum documento vinculado.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-subtle">
            Importe XML fiscal ou emita notas com este produto para criar vínculos automáticos.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="lime"><Link href={`/emitir-nota?productId=${productId}`}>Usar na emissão</Link></Button>
            <Button variant="outline" onClick={() => notify({ title: "Importação XML em preparação" })}>Importar XML</Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase text-subtle">
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">NCM/CFOP</th>
                  <th className="px-4 py-3 text-right">Quantidade</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3.5">
                      {item.document ? (
                        <Link href={`/documents/${item.document.id}`} className="font-bold text-ink hover:underline">
                          {item.document.documentType} {item.document.invoiceNumber || "sem número"}
                        </Link>
                      ) : (
                        <span className="text-sm text-subtle">Documento indisponível</span>
                      )}
                      <p className="mt-1 text-xs text-subtle">{item.document?.issuerName || item.document?.recipientName || "Participante não informado"}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-bold text-ink">{item.description || product?.name || "Produto"}</p>
                      <p className="text-xs text-subtle">{item.productCode || item.ean || "Sem código"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-mono">{[item.ncm, item.cfop].filter(Boolean).join(" / ") || "--"}</td>
                    <td className="px-4 py-3.5 text-right text-sm">{item.quantity ?? "--"} {item.unit || ""}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-bold">{formatCurrency(Number(item.totalValue || 0))}</td>
                    <td className="px-4 py-3.5"><Badge variant="neutral">{item.document?.status || "Registrado"}</Badge></td>
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
