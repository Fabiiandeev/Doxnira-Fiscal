"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Calculator,
  Download,
  Edit,
  Eye,
  FileText,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { useConfirmDialog } from "@/components/providers/confirm-dialog-provider";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  autoFixProduct,
  deleteProduct,
  listProducts,
  validateProduct,
} from "@/lib/services/product-service";
import type { Product } from "@/lib/product-types";
import { cn, formatCurrency } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

function productSettings(product: Product) {
  return product.fiscalAi?.productSettings ?? {};
}

function productCategory(product: Product) {
  return product.grupoTributario || product.brand || "Sem categoria";
}

function fiscalPendingCount(product: Product) {
  let count = 0;
  if (!product.name) count += 1;
  if (!product.unit) count += 1;
  if (!product.ncm) count += 1;
  if (!product.origemMercadoria && product.origemMercadoria !== 0) count += 1;
  if (!product.cfopPreferencial) count += 1;
  if (!product.cstCsosnPadrao) count += 1;
  if (Number(product.price || 0) <= 0) count += 1;
  if (product.stockMin != null && product.stockMax != null && product.stockMin > product.stockMax) count += 1;
  return count;
}

function fiscalStatus(product: Product) {
  const pending = fiscalPendingCount(product);
  if (!product.active) return { label: "Inativo", tone: "neutral" as const, key: "inactive" };
  if (!product.ncm || !product.cstCsosnPadrao) return { label: "Bloqueado", tone: "danger" as const, key: "blocked" };
  if (pending > 0 || product.scoreProduto == null || product.scoreProduto < 80) return { label: "Com pendências", tone: "warning" as const, key: "attention" };
  return { label: "Pronto", tone: "success" as const, key: "ready" };
}

function stockStatus(product: Product) {
  if (product.stock < 0) return "negative";
  if (product.stockMin != null && product.stock <= product.stockMin) return "critical";
  return "ok";
}

function marketplaceLabel(product: Product) {
  const marketplace = productSettings(product).marketplace;
  if (!marketplace?.enabled) return "Não vinculado";
  if (marketplace.sku || marketplace.mercadoLivreSku || marketplace.shopeeSku) return "Vinculado";
  return "Pendente";
}

export function ProductsView() {
  const { confirm } = useConfirmDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ncmFilter, setNcmFilter] = useState("all");
  const [cestFilter, setCestFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [fiscalFilter, setFiscalFilter] = useState("all");
  const [marketplaceFilter, setMarketplaceFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchProducts = useCallback(async (q?: string) => {
    try {
      if (q) setSearching(true);
      else setLoading(true);
      setError(null);
      const data = await listProducts(q);
      setProducts(data);
    } catch {
      setError("Não foi possível carregar produtos. Tente novamente.");
      notify({ title: "Erro ao carregar produtos", tone: "error" });
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchProducts(search.trim() || undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, search]);

  const categories = useMemo(
    () => Array.from(new Set(products.map(productCategory))).sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const status = fiscalStatus(product);
      const settings = productSettings(product);
      const hasNcm = Boolean(product.ncm);
      const hasCest = Boolean(product.cest);
      const stock = stockStatus(product);
      const hasFiscalPending = fiscalPendingCount(product) > 0;
      const marketplace = marketplaceLabel(product);
      const supplier = settings.supplier;
      if (statusFilter === "active" && !product.active) return false;
      if (statusFilter === "inactive" && product.active) return false;
      if (categoryFilter !== "all" && productCategory(product) !== categoryFilter) return false;
      if (ncmFilter === "with" && !hasNcm) return false;
      if (ncmFilter === "without" && hasNcm) return false;
      if (cestFilter === "with" && !hasCest) return false;
      if (cestFilter === "without" && hasCest) return false;
      if (stockFilter !== "all" && stock !== stockFilter) return false;
      if (fiscalFilter !== "all" && status.key !== fiscalFilter && !(fiscalFilter === "pending" && hasFiscalPending)) return false;
      if (marketplaceFilter === "linked" && marketplace !== "Vinculado") return false;
      if (marketplaceFilter === "pending" && marketplace !== "Pendente") return false;
      if (marketplaceFilter === "none" && marketplace !== "Não vinculado") return false;
      if (supplierFilter === "linked" && !supplier?.code) return false;
      if (supplierFilter === "missing" && supplier?.code) return false;
      return true;
    });
  }, [categoryFilter, cestFilter, fiscalFilter, marketplaceFilter, ncmFilter, products, statusFilter, stockFilter, supplierFilter]);

  const metrics = useMemo(() => {
    const total = products.length;
    const active = products.filter((product) => product.active).length;
    const withFiscalPending = products.filter((product) => fiscalPendingCount(product) > 0).length;
    const withoutNcm = products.filter((product) => !product.ncm).length;
    const withoutCest = products.filter((product) => !product.cest).length;
    const criticalStock = products.filter((product) => stockStatus(product) === "critical" || stockStatus(product) === "negative").length;
    const marketplaceLinked = products.filter((product) => marketplaceLabel(product) === "Vinculado").length;
    return { total, active, withFiscalPending, withoutNcm, withoutCest, criticalStock, marketplaceLinked };
  }, [products]);

  async function handleValidate(product: Product) {
    setActionId(product.id);
    try {
      const result = await validateProduct(product.id);
      notify({
        title: "Produto validado",
        description: `Score ${result.scoreCadastro}% · ${result.pendencias.length} pendência(s).`,
        tone: result.pendencias.length ? "info" : "success",
      });
      await fetchProducts(search.trim() || undefined);
    } catch (error) {
      notify({ title: "Validação indisponível", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setActionId(null);
    }
  }

  async function handleAutoFix(product: Product) {
    setActionId(product.id);
    try {
      const result = await autoFixProduct(product.id);
      notify({
        title: result.corrected ? "Correções aplicadas" : "Nenhuma correção segura disponível",
        description: result.corrected ? `${result.corrections.length} ajuste(s) aplicado(s).` : "Revise NCM, CST/CSOSN e CFOP manualmente.",
        tone: result.corrected ? "success" : "info",
      });
      await fetchProducts(search.trim() || undefined);
    } catch (error) {
      notify({ title: "Correção automática indisponível", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = await confirm({
      title: "Inativar produto",
      description: `Confirma remover ${product.name} do cadastro ativo? Documentos fiscais já importados serão preservados.`,
      confirmLabel: "Inativar",
      tone: "danger",
    });
    if (!confirmed) return;
    setActionId(product.id);
    try {
      await deleteProduct(product.id);
      notify({ title: "Produto inativado", tone: "success" });
      await fetchProducts(search.trim() || undefined);
    } catch (error) {
      notify({ title: "Erro ao inativar produto", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setActionId(null);
    }
  }

  const selectClass = "h-10 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink outline-none";

  if (loading && products.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-3xl bg-white/60" />
        <Card className="h-72 animate-pulse bg-muted/40" />
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
        <Button variant="outline" className="mt-4" onClick={() => fetchProducts()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cadastros"
        title="Produtos"
        description="Gerencie produtos, estoque, tributação e integrações comerciais."
        icon={Package}
        action={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchProducts(search.trim() || undefined)}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" onClick={() => notify({ title: "Importação XML em preparação", description: "Use o XML Fiscal para importar documentos e vincular produtos." })}>
              <Upload className="h-4 w-4" /> Importar XML
            </Button>
            <Button variant="outline" onClick={() => notify({ title: "Importação de planilha em preparação", description: "O cadastro manual e XML fiscal já estão disponíveis." })}>
              <Upload className="h-4 w-4" /> Importar planilha
            </Button>
            <Button variant="outline" onClick={() => notify({ title: "Exportação em preparação", description: "A exportação será conectada aos relatórios comerciais." })}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button asChild variant="lime">
              <Link href="/products/new"><Plus className="h-4 w-4" /> Novo produto</Link>
            </Button>
          </div>
        )}
      />

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["Total de produtos", metrics.total],
          ["Ativos", metrics.active],
          ["Com pendência fiscal", metrics.withFiscalPending],
          ["Sem NCM", metrics.withoutNcm],
          ["Sem CEST", metrics.withoutCest],
          ["Estoque crítico", metrics.criticalStock],
          ["Marketplace", metrics.marketplaceLinked],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-[10px] font-bold uppercase text-subtle">{label}</p>
            <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_repeat(8,auto)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, SKU, código interno, EAN/GTIN, NCM ou categoria"
              className="pl-9"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />}
          </div>
          <select className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <select className={selectClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Categoria</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select className={selectClass} value={ncmFilter} onChange={(event) => setNcmFilter(event.target.value)}>
            <option value="all">NCM</option>
            <option value="with">Com NCM</option>
            <option value="without">Sem NCM</option>
          </select>
          <select className={selectClass} value={cestFilter} onChange={(event) => setCestFilter(event.target.value)}>
            <option value="all">CEST</option>
            <option value="with">Com CEST</option>
            <option value="without">Sem CEST</option>
          </select>
          <select className={selectClass} value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
            <option value="all">Estoque</option>
            <option value="ok">Normal</option>
            <option value="critical">Crítico</option>
            <option value="negative">Negativo</option>
          </select>
          <select className={selectClass} value={fiscalFilter} onChange={(event) => setFiscalFilter(event.target.value)}>
            <option value="all">Fiscal</option>
            <option value="ready">Prontos</option>
            <option value="pending">Com pendência</option>
            <option value="blocked">Bloqueados</option>
          </select>
          <select className={selectClass} value={marketplaceFilter} onChange={(event) => setMarketplaceFilter(event.target.value)}>
            <option value="all">Marketplace</option>
            <option value="linked">Vinculado</option>
            <option value="pending">Pendente</option>
            <option value="none">Não vinculado</option>
          </select>
          <select className={selectClass} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
            <option value="all">Fornecedor</option>
            <option value="linked">Vinculado</option>
            <option value="missing">Sem vínculo</option>
          </select>
        </div>
      </Card>

      {products.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="mx-auto mb-3 h-12 w-12 text-subtle" />
          <h2 className="text-xl font-bold text-ink">Nenhum produto cadastrado.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-subtle">
            Cadastre seu primeiro produto para emitir notas, controlar estoque e integrar marketplaces.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild variant="lime"><Link href="/products/new">Novo produto</Link></Button>
            <Button variant="outline" onClick={() => notify({ title: "Importação XML em preparação" })}>Importar XML</Button>
            <Button variant="outline" onClick={() => notify({ title: "Importação de planilha em preparação" })}>Importar planilha</Button>
            <Button variant="outline" onClick={() => notify({ title: "Sincronização marketplace em preparação" })}>Sincronizar marketplace</Button>
          </div>
        </Card>
      )}

      {products.length > 0 && filteredProducts.length === 0 && (
        <Card className="p-10 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-subtle" />
          <h2 className="text-lg font-bold text-ink">Nenhum produto encontrado.</h2>
          <p className="mt-2 text-sm text-subtle">Ajuste a busca ou os filtros para visualizar outros produtos.</p>
        </Card>
      )}

      {filteredProducts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">EAN/GTIN</th>
                  <th className="px-4 py-3 text-left">NCM</th>
                  <th className="px-4 py-3 text-left">CEST</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-center">Estoque</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-left">Status fiscal</th>
                  <th className="px-4 py-3 text-left">Marketplace</th>
                  <th className="px-4 py-3 text-left">Última atualização</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredProducts.map((product) => {
                  const status = fiscalStatus(product);
                  const pendencies = fiscalPendingCount(product);
                  const stock = stockStatus(product);
                  const busy = actionId === product.id;
                  return (
                    <tr key={product.id} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3.5">
                        <Link href={`/products/${product.id}`} className="font-bold text-ink hover:underline">
                          {product.name || "Produto sem nome"}
                        </Link>
                        <p className="mt-1 max-w-[260px] truncate text-xs text-subtle">{product.brand || product.ncmDescription || "Sem marca/descrição fiscal"}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-sm text-ink">{product.code}</td>
                      <td className="px-4 py-3.5 font-mono text-sm text-ink">{product.barcode || "--"}</td>
                      <td className="px-4 py-3.5">{product.ncm ? <span className="font-mono text-sm">{product.ncm}</span> : <Badge variant="danger">Sem NCM</Badge>}</td>
                      <td className="px-4 py-3.5">{product.cest ? <span className="font-mono text-sm">{product.cest}</span> : <Badge variant="outline">Sem CEST</Badge>}</td>
                      <td className="px-4 py-3.5 text-sm">{productCategory(product)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn("inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-xs font-extrabold", stock === "ok" ? "bg-emerald-100 text-emerald-700" : stock === "critical" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold">{formatCurrency(Number(product.price || 0))}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Badge variant={status.tone}>{status.label}</Badge>
                          {pendencies > 0 && <span className="text-xs font-bold text-amber-600">{pendencies}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><Badge variant={marketplaceLabel(product) === "Vinculado" ? "success" : marketplaceLabel(product) === "Pendente" ? "warning" : "neutral"}>{marketplaceLabel(product)}</Badge></td>
                      <td className="px-4 py-3.5 text-sm text-subtle">{new Date(product.updatedAt).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <Button asChild variant="ghost" size="icon" title="Ver detalhes"><Link href={`/products/${product.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="icon" title="Editar"><Link href={`/products/${product.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                          <Button variant="ghost" size="icon" title="Validar fiscalmente" onClick={() => handleValidate(product)} disabled={busy}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" title="Corrigir pendências" onClick={() => handleAutoFix(product)} disabled={busy}>
                            <Sparkles className="h-4 w-4" />
                          </Button>
                          <Button asChild variant="ghost" size="icon" title="Ver estoque"><Link href={`/products/${product.id}/stock`}><Boxes className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="icon" title="Ver precificação"><Link href={`/products/${product.id}/pricing`}><Calculator className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="icon" title="Ver marketplace"><Link href={`/products/${product.id}/marketplace`}><ShoppingCart className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="icon" title="Ver documentos"><Link href={`/products/${product.id}/documents`}><FileText className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="icon" title="Salvar e usar na emissão"><Link href={`/emitir-nota?productId=${product.id}`}><Zap className="h-4 w-4" /></Link></Button>
                          <Button variant="ghost" size="icon" title="Inativar" onClick={() => handleDelete(product)} disabled={busy}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line bg-muted/30 px-4 py-2.5 text-xs text-subtle">
            {filteredProducts.length} produto(s) exibido(s)
          </div>
        </Card>
      )}
    </div>
  );
}
