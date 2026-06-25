"use client";

import { useState, useEffect } from "react";
import { Building2, CheckCircle2, CircleDollarSign, Edit, Plus, Search, Trash2, User, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate, maskCnpj } from "@/lib/utils";

interface Client { id: string; name: string; cnpj: string; email: string; phone: string; ie: string; address: string; active: boolean; }

const mockClients: Client[] = [
  { id: "cli-1", name: "Gama Tech LTDA", cnpj: "12.345.678/0001-90", email: "contato@gamatech.com", phone: "(11) 99999-9999", ie: "123.456.789.123", address: "Av. Paulista, 1000 - Sao Paulo/SP", active: true },
  { id: "cli-2", name: "Beta Comercio SA", cnpj: "98.765.432/0001-10", email: "vendas@betacomercio.com", phone: "(11) 88888-8888", ie: "987.654.321.987", address: "Rua Augusta, 500 - Sao Paulo/SP", active: true },
  { id: "cli-3", name: "Delta Distribuidora ME", cnpj: "11.222.333/0001-44", email: "comercial@deltadist.com", phone: "(11) 77777-7777", ie: "", address: "Av. Brasil, 2000 - Rio de Janeiro/RJ", active: false },
];

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", email: "", phone: "", ie: "", address: "" });

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search));

  const handleSubmit = () => {
    if (editing) {
      setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...form } : c));
      notify({ title: "Cliente atualizado" });
    } else {
      setClients(prev => [...prev, { ...form, id: "cli-" + Date.now(), active: true }]);
      notify({ title: "Cliente criado" });
    }
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", cnpj: "", email: "", phone: "", ie: "", address: "" });
  };

  const handleEdit = (c: Client) => { setEditing(c); setForm(c); setShowForm(true); };
  const handleDelete = (id: string) => { if (confirm("Excluir cliente?")) { setClients(prev => prev.filter(c => c.id !== id)); notify({ title: "Cliente excluido" }); } };
  const handleNew = () => { setEditing(null); setForm({ name: "", cnpj: "", email: "", phone: "", ie: "", address: "" }); setShowForm(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Clientes</h1><p className="text-sm text-subtle">Cadastro de clientes para emissao fiscal</p></div>
        <Button variant="lime" onClick={handleNew}><Plus className="h-4 w-4" /> Novo cliente</Button>
      </div>

      <Card className="p-4">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ, email..." className="max-w-sm" />
      </Card>

      {showForm && (
        <Card className="p-4">
          <h3 className="font-bold mb-3">{editing ? "Editar cliente" : "Novo cliente"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="CNPJ" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} />
            <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Telefone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input label="IE" value={form.ie} onChange={e => setForm(f => ({ ...f, ie: e.target.value }))} />
            <Input label="Endereco" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="md:col-span-2" />
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button><Button variant="lime" onClick={handleSubmit}>Salvar</Button></div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">CNPJ</th><th className="px-4 py-3">IE</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Acoes</th></tr></thead>
          <tbody className="divide-y divide-line">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{maskCnpj(c.cnpj)}</td>
                <td className="px-4 py-3">{c.ie || <Badge variant="outline">Sem IE</Badge>}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3"><Badge variant={c.active ? "success" : "neutral"}>{c.active ? "Ativo" : "Inativo"}</Badge></td>
                <td className="px-4 py-3"><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

