"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  Plus,
  Trash2,
  Eye,
  Shield,
  Zap,
  RefreshCw,
  Download,
  Upload,
  Search,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { notify } from "@/components/toast-viewport";
import { maskCnpj, maskCpf, cn, formatPhone } from "@/lib/utils";
import { deleteClient, listClients } from "@/lib/services/cliente-service";
import type { IntelligentClient } from "@/lib/client-types";

const SEARCH_DEBOUNCE_MS = 300;

export function ClientsView() {
  const router = useRouter();
  const [clients, setClients] = useState<IntelligentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResponded, setSearchResponded] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<IntelligentClient | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClients = useCallback(async (q?: string) => {
    try {
      if (q) {
        setSearching(true);
        setSearchResponded(false);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await listClients(q);
      setClients(data);
    } catch {
      setError("Não foi possível carregar clientes. Tente novamente.");
      notify({ title: "Erro ao carregar clientes", tone: "error" });
    } finally {
      setLoading(false);
      setSearching(false);
      setSearchResponded(true);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchClients(value.trim() || undefined);
    }, SEARCH_DEBOUNCE_MS);
  }, [fetchClients]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const displayNome = (c: IntelligentClient) => c.razaoSocial ?? c.nomeFantasia ?? c.nome ?? "";
  const displayDocumento = (c: IntelligentClient) =>
    c.tipoPessoa === "PJ" && c.cnpj ? maskCnpj(c.cnpj) : c.cpf ? maskCpf(c.cpf) : "";

  const situacaoBadge = (s: string | null) => {
    if (!s) return <Badge variant="neutral">Pendente</Badge>;
    const lower = s.toLowerCase();
    if (lower.includes("ativa")) return <Badge variant="success">Ativa</Badge>;
    if (lower.includes("baixad")) return <Badge variant="danger">Baixada</Badge>;
    if (lower.includes("suspens")) return <Badge variant="warning">Suspensa</Badge>;
    if (lower.includes("inapt")) return <Badge variant="danger">Inapta</Badge>;
    if (lower.includes("nula")) return <Badge variant="danger">Nula</Badge>;
    return <Badge variant="neutral">{s}</Badge>;
  };

  const regimeBadge = (r: string | null) => {
    if (!r || r === "PENDENTE_CONFIRMACAO") return <Badge variant="neutral">Pendente</Badge>;
    if (r === "MEI") return <Badge variant="lime">MEI</Badge>;
    if (r.includes("Simples")) return <Badge variant="info">Simples Nacional</Badge>;
    if (r.includes("Lucro Presumido")) return <Badge variant="dark">Lucro Presumido</Badge>;
    if (r.includes("Lucro Real")) return <Badge variant="dark">Lucro Real</Badge>;
    return <Badge variant="neutral">{r}</Badge>;
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
      await deleteClient(deleteTarget.id);
      notify({ title: "Cliente excluído com sucesso", tone: "success" });
      setDeleteTarget(null);
      fetchClients(search.trim() || undefined);
    } catch {
      notify({ title: "Erro ao excluir cliente", tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return <span className="text-xs text-subtle">--</span>;
    try {
      return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return <span className="text-xs text-subtle">--</span>;
    }
  };

  if (loading && clients.length === 0) {
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

  if (error && clients.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => fetchClients()}>Tentar novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Clientes</h1>
          <p className="text-sm text-subtle">Cadastro inteligente fiscal com FiscalAI</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchClients(search.trim() || undefined)} title="Atualizar lista">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" title="Importar clientes" disabled>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" size="sm" title="Exportar CSV" disabled>
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Link href="/clients/new">
            <Button variant="lime" size="sm"><Plus className="h-4 w-4" /> Novo cliente</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por nome, CNPJ, CPF, IE, email, telefone..."
            className="max-w-md pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />
          )}
        </div>
      </Card>

      {clients.length === 0 && !search && (
        <Card className="p-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhum cliente cadastrado</h2>
          <p className="text-sm text-subtle max-w-md mx-auto mb-4">
            Cadastre seu primeiro cliente usando a busca inteligente. Informe apenas o CPF ou CNPJ.
          </p>
          <Link href="/clients/new">
            <Button variant="lime"><Zap className="h-4 w-4" /> Cadastro Inteligente</Button>
          </Link>
        </Card>
      )}

      {clients.length === 0 && search && searchResponded && (
        <Card className="p-12 text-center">
          <Search className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhum cliente encontrado</h2>
          <p className="text-sm text-subtle max-w-md mx-auto">
            Nenhum resultado para &ldquo;{search}&rdquo;. Verifique o termo ou tente buscar por apenas parte do documento.
          </p>
        </Card>
      )}

      {clients.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">CNPJ/CPF</th>
                  <th className="px-4 py-3 text-left">IE</th>
                  <th className="px-4 py-3 text-left">Regime</th>
                  <th className="px-4 py-3 text-center">Situação</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Telefone</th>
                  <th className="px-4 py-3 text-left">Atualizado</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-muted/30 transition cursor-pointer group"
                    onClick={() => router.push(`/clients/${c.id}`)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{displayNome(c) || "Não informado"}</span>
                        {c.tipoPessoa === "PF" && <Badge variant="info">PF</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-mono text-ink">{displayDocumento(c) || "--"}</td>
                    <td className="px-4 py-3.5 text-sm">
                      {c.inscricaoEstadual ? (
                        <span className="font-mono">{c.inscricaoEstadual}</span>
                      ) : (
                        <Badge variant="outline">Sem IE</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{regimeBadge(c.regimeTributario)}</td>
                    <td className="px-4 py-3.5 text-center">{situacaoBadge(c.situacaoCadastral)}</td>
                    <td className="px-4 py-3.5 text-center">{scoreRing(c.scoreCadastro)}</td>
                    <td className="px-4 py-3.5 text-sm text-ink truncate max-w-[180px]">{c.email || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-ink">{c.telefone ? formatPhone(c.telefone) : <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-subtle">{formatDate(c.updatedAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/clients/${c.id}`}>
                          <Button variant="ghost" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Link href={`/clients/${c.id}?edit=1`}>
                          <Button variant="ghost" size="icon" title="Editar"><Edit className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {clients.length > 0 && (
            <div className="border-t border-line bg-muted/30 px-4 py-2.5">
              <p className="text-xs text-subtle">
                {search
                  ? `${clients.length} resultado${clients.length !== 1 ? "s" : ""} para "${search}"`
                  : `${clients.length} cliente${clients.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          )}
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogTitle>Excluir cliente</DialogTitle>
          <DialogDescription>
            Deseja excluir <strong className="text-ink">{deleteTarget ? displayNome(deleteTarget) : ""}</strong>? Esta ação não pode ser desfeita.
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
