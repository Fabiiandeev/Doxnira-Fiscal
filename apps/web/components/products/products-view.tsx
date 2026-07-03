"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  Plus,
  Trash2,
  Eye,
  Zap,
  RefreshCw,
  Download,
  Upload,
  Search,
  AlertTriangle,
  Package,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, cn } from "@/lib/utils";
import { deleteProduct, listProducts } from "@/lib/services/product-service";
import type { Product } from "@/lib/product-types";

export function ProductsView() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listProducts();
      setProducts(data);
    } catch {
      setError("Não foi possível carregar produtos. Tente novamente.");
      notify({ title: "Erro ao carregar produtos", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const q = search.toLowerCase();
  const filtered = products.filter((p) => {
    if (!q) return true;
    const fields = [
      p.name, p.code, p.ncm, p.barcode, p.brand,
      p.cstCsosnPadrao, p.grupoTributario, p.ncmDescription,
    ];
    return fields.some((f) => f && String(f).toLowerCase().includes(q));
  });

  const regimeBadge = (p: Product) => {
    const cst = p.cstCsosnPadrao;
    if (!cst && !p.grupoTributario) return <Badge variant="neutral">Pendente</Badge>;
    if (p.grupoTributario?.includes("monofásico")) return <Badge variant="warning">Monofásico</Badge>;
    if (p.grupoTributario?.includes("ST")) return <Badge variant="danger">ST</Badge>;
    if (cst && ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"].includes(cst))
      return <Badge variant="info">Simples</Badge>;
    if (cst && ["00", "10", "20", "40", "41", "50", "51", "60", "70", "90"].includes(cst))
      return <Badge variant="dark">Lucro</Badge>;
    return <Badge variant="neutral">{p.grupoTributario ?? "Pendente"}</Badge>;
  };

  const scoreRing = (s: number | null) => {
    if (s === null) return <span className="text-xs text-subtle">--</span>;
    const color = s >= 70 ? "text-emerald-600" : s >= 40 ? "text-amber-600" : "text-red-600";
    const bg = s >= 70 ? "bg-emerald-50" : s >= 40 ? "bg-amber-50" : "bg-red-50";
    return (
      <span className={cn("inline-flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold", color, bg)}>
        {s}
      </span>
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      notify({ title: "Produto excluído com sucesso", tone: "success" });
      setDeleteTarget(null);
      fetchProducts();
    } catch {
      notify({ title: "Erro ao excluir produto", tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-1 h-4 w-56 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <Card className="h-64 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <Button variant="outline" className="mt-4" onClick={fetchProducts}>Tentar novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Produtos</h1>
          <p className="text-sm text-subtle">Cadastro com inteligência fiscal. Tributação calculada na emissão.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchProducts} title="Atualizar lista">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" title="Importar produtos" disabled>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" size="sm" title="Exportar CSV" disabled>
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Link href="/products/new">
            <Button variant="lime" size="sm"><Plus className="h-4 w-4" /> Novo produto</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, código, NCM, marca, EAN, grupo tributário..."
            className="max-w-md pl-9"
          />
        </div>
      </Card>

      {products.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhum produto cadastrado</h2>
          <p className="text-sm text-subtle max-w-md mx-auto mb-4">
            Cadastre seu primeiro produto com classificação fiscal inteligente.
          </p>
          <Link href="/products/new">
            <Button variant="lime"><Zap className="h-4 w-4" /> Cadastro Inteligente</Button>
          </Link>
        </Card>
      )}

      {products.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">NCM</th>
                  <th className="px-4 py-3 text-left">CEST</th>
                  <th className="px-4 py-3 text-left">Tributação</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-center">Estoque</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((p) => {
                  const stockLow = p.stockMin != null && p.stock <= (p.stockMin ?? 0);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition cursor-pointer group"
                      onClick={() => router.push(`/products/${p.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div>
                          <span className="font-medium text-ink">{p.name || "Não informado"}</span>
                          {p.brand && <p className="text-xs text-subtle">{p.brand}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <span className="text-sm font-mono text-ink">{p.code}</span>
                          {p.barcode && <p className="text-xs text-subtle font-mono">{p.barcode}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono">
                        {p.ncm || <Badge variant="outline">Sem NCM</Badge>}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono">
                        {p.cest || <span className="text-subtle">--</span>}
                      </td>
                      <td className="px-4 py-3.5">{regimeBadge(p)}</td>
                      <td className="px-4 py-3.5 text-center">{scoreRing(p.scoreProduto)}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-right">
                        {formatCurrency(Number(p.price))}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn("text-sm font-medium", stockLow ? "text-red-600" : "text-ink")}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant={p.active ? "success" : "neutral"}>
                          {p.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/products/${p.id}`}>
                            <Button variant="ghost" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button>
                          </Link>
                          <Link href={`/products/${p.id}?edit=1`}>
                            <Button variant="ghost" size="icon" title="Editar"><Edit className="h-4 w-4" /></Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && search && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-subtle">
                      Nenhum produto encontrado para &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {products.length > 0 && (
            <div className="border-t border-line bg-muted/30 px-4 py-2.5">
              <p className="text-xs text-subtle">
                {filtered.length === products.length
                  ? `${products.length} produto${products.length !== 1 ? "s" : ""}`
                  : `${filtered.length} de ${products.length} produtos`}
              </p>
            </div>
          )}
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogTitle>Excluir produto</DialogTitle>
          <DialogDescription>
            Deseja excluir <strong className="text-ink">{deleteTarget ? deleteTarget.name : ""}</strong>? Esta ação não pode ser desfeita.
          </DialogDescription>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
