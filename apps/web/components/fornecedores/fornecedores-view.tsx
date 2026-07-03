"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Search,
  AlertTriangle,
  Loader2,
  Package,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { notify } from "@/components/toast-viewport";
import { maskCnpj, maskCpf, formatPhone } from "@/lib/utils";
import { deleteFornecedor, listFornecedores } from "@/lib/services/fornecedor-service";
import type { Fornecedor } from "@/lib/fornecedor-types";

const SEARCH_DEBOUNCE_MS = 300;

export function FornecedoresView() {
  const router = useRouter();
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResponded, setSearchResponded] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Fornecedor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchItems = useCallback(async (q?: string) => {
    try {
      if (q) {
        setSearching(true);
        setSearchResponded(false);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await listFornecedores(q);
      setItems(data);
    } catch {
      setError("Não foi possível carregar fornecedores. Tente novamente.");
      notify({ title: "Erro ao carregar fornecedores", tone: "error" });
    } finally {
      setLoading(false);
      setSearching(false);
      setSearchResponded(true);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchItems(value.trim() || undefined), SEARCH_DEBOUNCE_MS);
  }, [fetchItems]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const displayNome = (f: Fornecedor) => f.razaoSocial ?? f.nomeFantasia ?? f.nome ?? "";
  const displayDocumento = (f: Fornecedor) =>
    f.tipoPessoa === "PJ" && f.cnpj ? maskCnpj(f.cnpj) : f.cpf ? maskCpf(f.cpf) : "";

  const formatDate = (d: string | null) => {
    if (!d) return <span className="text-xs text-subtle">--</span>;
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return <span className="text-xs text-subtle">--</span>; }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFornecedor(deleteTarget.id);
      notify({ title: "Fornecedor excluído com sucesso", tone: "success" });
      setDeleteTarget(null);
      fetchItems(search.trim() || undefined);
    } catch {
      notify({ title: "Erro ao excluir fornecedor", tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div><div className="h-7 w-40 animate-pulse rounded bg-muted" /><div className="mt-1 h-4 w-64 animate-pulse rounded bg-muted" /></div>
        </div>
        <Card className="h-64 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-red-600"><AlertTriangle className="h-5 w-5 shrink-0" /><p className="text-sm">{error}</p></div>
          <Button variant="outline" className="mt-4" onClick={() => fetchItems()}>Tentar novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Fornecedores</h1>
          <p className="text-sm text-subtle">Cadastro de fornecedores para compras e notas fiscais</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchItems(search.trim() || undefined)} title="Atualizar lista">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Link href="/fornecedores/new">
            <Button variant="lime" size="sm"><Plus className="h-4 w-4" /> Novo fornecedor</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por nome, CNPJ, CPF, IE, email..."
            className="max-w-md pl-9"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />}
        </div>
      </Card>

      {items.length === 0 && !search && (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhum fornecedor cadastrado</h2>
          <p className="text-sm text-subtle max-w-md mx-auto mb-4">
            Cadastre seu primeiro fornecedor informando o CNPJ.
          </p>
          <Link href="/fornecedores/new">
            <Button variant="lime"><Plus className="h-4 w-4" /> Novo fornecedor</Button>
          </Link>
        </Card>
      )}

      {items.length === 0 && search && searchResponded && (
        <Card className="p-12 text-center">
          <Search className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhum fornecedor encontrado</h2>
          <p className="text-sm text-subtle max-w-md mx-auto">
            Nenhum resultado para &ldquo;{search}&rdquo;.
          </p>
        </Card>
      )}

      {items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-left">CNPJ/CPF</th>
                  <th className="px-4 py-3 text-left">IE</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-left">Telefone</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Atualizado</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/30 transition cursor-pointer group" onClick={() => router.push(`/fornecedores/${f.id}`)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{displayNome(f) || "Não informado"}</span>
                        {f.tipoPessoa === "PF" && <Badge variant="info">PF</Badge>}
                        {!f.ativo && <Badge variant="danger">Inativo</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-mono text-ink">{displayDocumento(f) || "--"}</td>
                    <td className="px-4 py-3.5 text-sm font-mono">{f.inscricaoEstadual || <Badge variant="outline">Sem IE</Badge>}</td>
                    <td className="px-4 py-3.5 text-sm">{f.categoria || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm">{f.telefone ? formatPhone(f.telefone) : <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-ink truncate max-w-[180px]">{f.email || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-subtle">{formatDate(f.updatedAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/fornecedores/${f.id}`}><Button variant="ghost" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button></Link>
                        <Link href={`/fornecedores/${f.id}?edit=1`}><Button variant="ghost" size="icon" title="Editar"><Edit className="h-4 w-4" /></Button></Link>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(f)} title="Excluir"><Trash2 className="h-4 w-4 text-red-500 group-hover:text-red-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div className="border-t border-line bg-muted/30 px-4 py-2.5">
              <p className="text-xs text-subtle">
                {search ? `${items.length} resultado${items.length !== 1 ? "s" : ""} para "${search}"` : `${items.length} fornecedor${items.length !== 1 ? "es" : ""}`}
              </p>
            </div>
          )}
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogTitle>Excluir fornecedor</DialogTitle>
          <DialogDescription>
            Deseja excluir <strong className="text-ink">{deleteTarget ? displayNome(deleteTarget) : ""}</strong>? Esta ação não pode ser desfeita.
          </DialogDescription>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
