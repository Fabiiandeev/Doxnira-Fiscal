"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, ClipboardCheck, Edit, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

interface Service { id: string; name: string; code: string; cityCode: string; nationalCode: string; issRetention: boolean; price: number; active: boolean; }

const mockServices: Service[] = [
  { id: "serv-1", name: "Consultoria Fiscal", code: "CONS-FISC", cityCode: "01.01", nationalCode: "01.01", issRetention: true, price: 500.00, active: true },
  { id: "serv-2", name: "Desenvolvimento de Software", code: "DEV-SW", cityCode: "01.02", nationalCode: "01.02", issRetention: false, price: 1500.00, active: true },
  { id: "serv-3", name: "Manutencao de Equipamentos", code: "MANUT-EQP", cityCode: "01.03", nationalCode: "01.03", issRetention: true, price: 300.00, active: true },
];

export function ServicesView() {
  const [services, setServices] = useState<Service[]>(mockServices);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", code: "", cityCode: "", nationalCode: "", issRetention: false, price: 0 });

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = () => {
    if (editing) { setServices(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s)); notify({ title: "Servico atualizado" }); }
    else { setServices(prev => [...prev, { ...form, id: "serv-" + Date.now(), active: true }]); notify({ title: "Servico criado" }); }
    setShowForm(false); setEditing(null); setForm({ name: "", code: "", cityCode: "", nationalCode: "", issRetention: false, price: 0 });
  };

  const handleEdit = (s: Service) => { setEditing(s); setForm(s); setShowForm(true); };
  const handleDelete = (id: string) => { if (confirm("Excluir servico?")) { setServices(prev => prev.filter(s => s.id !== id)); notify({ title: "Servico excluido" }); } };
  const handleNew = () => { setEditing(null); setForm({ name: "", code: "", cityCode: "", nationalCode: "", issRetention: false, price: 0 }); setShowForm(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold">Servicos</h1><p className="text-sm text-subtle">Cadastro de servicos para NFS-e com codigos nacionais</p></div><Button variant="lime" onClick={handleNew}><Plus className="h-4 w-4" /> Novo servico</Button></div>
      <Card className="p-4"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, codigo, codigo nacional..." className="max-w-sm" /></Card>

      {showForm && <Card className="p-4"><h3 className="font-bold mb-3">{editing ? "Editar servico" : "Novo servico"}</h3><div className="grid gap-3 md:grid-cols-3"><Input label="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /><Input label="Codigo" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /><Input label="Codigo municipal" value={form.cityCode} onChange={e => setForm(f => ({ ...f, cityCode: e.target.value }))} /><Input label="Codigo nacional NFS-e" value={form.nationalCode} onChange={e => setForm(f => ({ ...f, nationalCode: e.target.value }))} /><label className="flex items-center gap-2"><input type="checkbox" checked={form.issRetention} onChange={e => setForm(f => ({ ...f, issRetention: e.target.checked }))} className="h-4 w-4 accent-ink" />Retencao ISS</label><Input label="Preco" type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) }))} /></div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button><Button variant="lime" onClick={handleSubmit}>Salvar</Button></div></Card>}

      <Card className="overflow-hidden"><table className="w-full"><thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Servico</th><th className="px-px-px-4 py-3">Codigo</th><th className="px-4 py-3">Cod. Municipal</th><th className="px-4 py-3">Cod. Nacional</th><th className="px-4 py-3">Ret. ISS</th><th className="px-4 py-3">Preco</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Acoes</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((s) => (<tr key={s.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-medium">{s.name}</td><td className="px-4 py-3">{s.code}</td><td className="px-4 py-3">{s.cityCode}</td><td className="px-4 py-3">{s.nationalCode || <Badge variant="outline">Pendente</Badge>}</td><td className="px-4 py-3"><Badge variant={s.issRetention ? "default" : "outline"}>{s.issRetention ? "Sim" : "Nao"}</Badge></td><td className="px-4 py-3 font-bold">{formatCurrency(s.price)}</td><td className="px-4 py-3"><Badge variant={s.active ? "success" : "neutral"}>{s.active ? "Ativo" : "Inativo"}</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>))}</tbody></table></Card></div>
  );
}

