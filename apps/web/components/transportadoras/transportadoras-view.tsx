"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  Plus,
  Trash2,
  Eye,
  Zap,
  RefreshCw,
  Search,
  AlertTriangle,
  Loader2,
  Truck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { notify } from "@/components/toast-viewport";
import { maskCnpj, maskCpf, formatPhone } from "@/lib/utils";
import { deleteTransportadora, listTransportadoras } from "@/lib/services/transportadora-service";
import type { Transportadora } from "@/lib/transportadora-types";

const SEARCH_DEBOUNCE_MS = 300;

export function TransportadorasView() {
  const router = useRouter();
  const [items, setItems] = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResponded, setSearchResponded] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Transportadora | null>(null);
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
      const data = await listTransportadoras(q);
      setItems(data);
    } catch {
      setError("Não foi possível carregar transportadoras. Tente novamente.");
      notify({ title: "Erro ao carregar transportadoras", tone: "error" });
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

  const displayNome = (t: Transportadora) => t.razaoSocial ?? t.nomeFantasia ?? t.nome ?? "";
  const displayDocumento = (t: Transportadora) =>
    t.tipoPessoa === "PJ" && t.cnpj ? maskCnpj(t.cnpj) : t.cpf ? maskCpf(t.cpf) : "";

  const formatDate = (d: string | null) => {
    if (!d) return <span className="text-xs text-subtle">--</span>;
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return <span className="text-xs text-subtle">--</span>; }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransportadora(deleteTarget.id);
      notify({ title: "Transportadora excluída com sucesso", tone: "success" });
      setDeleteTarget(null);
      fetchItems(search.trim() || undefined);
    } catch {
      notify({ title: "Erro ao excluir transportadora", tone: "error" });
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
          <h1 className="text-2xl font-extrabold text-ink">Transportadoras</h1>
          <p className="text-sm text-subtle">Cadastro de transportadoras para emissão de CT-e e NF-e</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchItems(search.trim() || undefined)} title="Atualizar lista">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Link href="/transportadoras/new">
            <Button variant="lime" size="sm"><Plus className="h-4 w-4" /> Nova transportadora</Button>
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
          <Truck className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhuma transportadora cadastrada</h2>
          <p className="text-sm text-subtle max-w-md mx-auto mb-4">
            Cadastre sua primeira transportadora informando o CNPJ.
          </p>
          <Link href="/transportadoras/new">
            <Button variant="lime"><Zap className="h-4 w-4" /> Nova transportadora</Button>
          </Link>
        </Card>
      )}

      {items.length === 0 && search && searchResponded && (
        <Card className="p-12 text-center">
          <Search className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhuma transportadora encontrada</h2>
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
                  <th className="px-4 py-3 text-left">Transportadora</th>
                  <th className="px-4 py-3 text-left">CNPJ/CPF</th>
                  <th className="px-4 py-3 text-left">IE</th>
                  <th className="px-4 py-3 text-left">ANTT</th>
                  <th className="px-4 py-3 text-left">Placa</th>
                  <th className="px-4 py-3 text-left">Telefone</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Atualizado</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition cursor-pointer group" onClick={() => router.push(`/transportadoras/${t.id}`)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{displayNome(t) || "Não informado"}</span>
                        {t.tipoPessoa === "PF" && <Badge variant="info">PF</Badge>}
                        {!t.ativo && <Badge variant="danger">Inativa</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-mono text-ink">{displayDocumento(t) || "--"}</td>
                    <td className="px-4 py-3.5 text-sm font-mono">{t.inscricaoEstadual || <Badge variant="outline">Sem IE</Badge>}</td>
                    <td className="px-4 py-3.5 text-sm">{t.antt || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm font-mono">{t.placaVeiculo || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm">{t.telefone ? formatPhone(t.telefone) : <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-ink truncate max-w-[180px]">{t.email || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-subtle">{formatDate(t.updatedAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/transportadoras/${t.id}`}><Button variant="ghost" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button></Link>
                        <Link href={`/transportadoras/${t.id}?edit=1`}><Button variant="ghost" size="icon" title="Editar"><Edit className="h-4 w-4" /></Button></Link>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)} title="Excluir"><Trash2 className="h-4 w-4 text-red-500 group-hover:text-red-600" /></Button>
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
                {search ? `${items.length} resultado${items.length !== 1 ? "s" : ""} para "${search}"` : `${items.length} transportadora${items.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          )}
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogTitle>Excluir transportadora</DialogTitle>
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
