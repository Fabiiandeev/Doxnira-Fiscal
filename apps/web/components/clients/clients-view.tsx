"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Edit, Plus, Trash2, Eye, Shield, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { maskCnpj, maskCpf, cn } from "@/lib/utils";
import { deleteClient, listClients } from "@/lib/services/cliente-service";
import type { IntelligentClient } from "@/lib/client-types";

export function ClientsView() {
  const [clients, setClients] = useState<IntelligentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchClients = useCallback(async () => {
    try {
      setError(null);
      const data = await listClients();
      setClients(data);
    } catch {
      setError("Nao foi possivel carregar clientes. Tente novamente.");
      notify({ title: "Erro ao carregar clientes", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filtered = clients.filter(
    (c) =>
      (c.razaoSocial ?? c.nome ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.cnpj ?? "").includes(search) ||
      (c.cpf ?? "").includes(search),
  );

  const displayNome = (c: IntelligentClient) => c.razaoSocial ?? c.nome ?? "";
  const displayDocumento = (c: IntelligentClient) =>
    c.tipoPessoa === "PJ" && c.cnpj ? maskCnpj(c.cnpj) : c.cpf ? maskCpf(c.cpf) : "";
  const displayIe = (c: IntelligentClient) => c.inscricaoEstadual ?? "";
  const displayEmail = (c: IntelligentClient) => c.email ?? "";
  const displayPhone = (c: IntelligentClient) => c.telefone ?? "";

  const scoreColor = (s: number | null) =>
    s === null ? "text-subtle" : s >= 70 ? "text-emerald-600" : s >= 40 ? "text-amber-600" : "text-red-600";

  const scoreBg = (s: number | null) =>
    s === null ? "bg-muted" : s >= 70 ? "bg-emerald-100" : s >= 40 ? "bg-amber-100" : "bg-red-100";

  const situacaoBadge = (s: string | null) => {
    if (!s) return <Badge variant="neutral">--</Badge>;
    const lower = s.toLowerCase();
    if (lower.includes("ativa") || lower.includes("ativa")) return <Badge variant="success">Ativa</Badge>;
    if (lower.includes("baixad")) return <Badge variant="danger">Baixada</Badge>;
    if (lower.includes("suspens")) return <Badge variant="warning">Suspensa</Badge>;
    if (lower.includes("inapt")) return <Badge variant="danger">Inapta</Badge>;
    return <Badge variant="neutral">{s}</Badge>;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir cliente?")) return;
    try {
      await deleteClient(id);
      notify({ title: "Cliente excluido" });
      fetchClients();
    } catch {
      notify({ title: "Erro ao excluir cliente", tone: "error" });
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-white/60" />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchClients}>Tentar novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Clientes</h1>
          <p className="text-sm text-subtle">Cadastro inteligente fiscal com FiscalAI</p>
        </div>
        <Link href="/clients/new">
          <Button variant="lime"><Plus className="h-4 w-4" /> Novo cliente</Button>
        </Link>
      </div>

      <Card className="p-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CNPJ, CPF, email..."
          className="max-w-sm"
        />
      </Card>

      {clients.length === 0 && (
        <Card className="p-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhum cliente cadastrado</h2>
          <p className="text-sm text-subtle max-w-md mx-auto mb-4">
            Cadastre clientes informando apenas o CPF ou CNPJ. A FiscalAI buscara, validara e completara todos os dados automaticamente.
          </p>
          <Link href="/clients/new">
            <Button variant="lime"><Zap className="h-4 w-4" /> Cadastro Inteligente</Button>
          </Link>
        </Card>
      )}

      {clients.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase text-subtle">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">{clients.some(c => c.tipoPessoa === "PF") ? "CPF/CNPJ" : "CNPJ"}</th>
                  <th className="px-4 py-3">IE</th>
                  <th className="px-4 py-3">Situacao</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayNome(c)}</span>
                        {c.tipoPessoa === "PF" && <Badge variant="info">PF</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{displayDocumento(c)}</td>
                    <td className="px-4 py-3">
                      {displayIe(c) || <Badge variant="outline">Sem IE</Badge>}
                    </td>
                    <td className="px-4 py-3">{situacaoBadge(c.situacaoCadastral)}</td>
                    <td className="px-4 py-3">
                      {c.scoreCadastro !== null ? (
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", scoreBg(c.scoreCadastro), scoreColor(c.scoreCadastro))}>
                          {c.scoreCadastro}%
                        </span>
                      ) : (
                        <span className="text-xs text-subtle">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{displayEmail(c) || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3 text-sm">{displayPhone(c) || <span className="text-subtle">--</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link href={`/clients/${c.id}`}>
                          <Button variant="ghost" size="icon" title="Ver cadastro inteligente"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Link href={`/clients/${c.id}`}>
                          <Button variant="ghost" size="icon" title="Editar"><Edit className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
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
