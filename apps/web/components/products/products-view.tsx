"use client";

import { useState, useEffect } from "react";
import { Box, CheckCircle2, Edit, Package, Plus, Search, Trash2, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

interface Product { id: string; name: string; code: string; ncm: string; cest: string; unit: string; price: number; stock: number; active: boolean; }

const mockProducts: Product[] = [
  { id: "prod-1", name: "Smartphone Samsung Galaxy S24", code: "SM-S24-128", ncm: "8517.12.00", cest: "28.038.00", unit: "UN", price: 2499.00, stock: 45, active: true },
  { id: "prod-2", name: "Notebook Dell Inspiron 15", code: "NB-DELL-I15", ncm: "8471.30.12", cest: "28.038.00", unit: "UN", price: 3299.00, stock: 12, active: true },
  { id: "prod-3", name: "Capa Protetora Transparente", code: "CAPA-S24-TR", ncm: "3926.90.90", cest: "", unit: "UN", price: 29.90, stock: 200, active: true },
  { id: "prod-4", name: "Carregador USB-C 65W", code: "CARG-USBC-65", ncm: "8504.40.10", cest: "", unit: "UN", price: 89.90, stock: 50, active: true },
];

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", code: "", ncm: "", cest: "", unit: "UN", price: 0, stock: 0 });

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = () => {
    if (editing) { setProducts(prev => prev.map(p => p.id === editing.id ? { ...p, ...form } : p)); notify({ title: "Produto atualizado" }); }
    else { setProducts(prev => [...prev, { ...form, id: "prod-" + Date.now(), active: true }]); notify({ title: "Produto criado" }); }
    setShowForm(false); setEditing(null); setForm({ name: "", code: "", ncm: "", cest: "", unit: "UN", price: 0, stock: 0 });
  };

  const handleEdit = (p: Product) => { setEditing(p); setForm(p); setShowForm(true); };
  const handleDelete = (id: string) => { if (confirm("Excluir produto?")) { setProducts(prev => prev.filter(p => p.id !== id)); notify({ title: "Produto excluido" }); } };
  const handleNew = () => { setEditing(null); setForm({ name: "", code: "", ncm: "", cest: "", unit: "UN", price: 0, stock: 0 }); setShowForm(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold">Produtos</h1><p className="text-sm text-subtle">Cadastro de produtos com NCM, CEST e tributacao</p></div><Button variant="lime" onClick={handleNew}><Plus className="h-4 w-4" /> Novo produto</Button></div>
      <Card className="p-4"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, codigo, NCM..." className="max-w-sm" /></Card>

      {showForm && <Card className="p-4"><h3 className="font-bold mb-3">{editing ? "Editar produto" : "Novo produto"}</h3><div className="grid gap-3 md:grid-cols-3"><Input label="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /><Input label="Codigo" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /><Input label="NCM" value={form.ncm} onChange={e => setForm(f => ({ ...f, ncm: e.target.value }))} /><Input label="CEST" value={form.cest} onChange={e => setForm(f => ({ ...f, cest: e.target.value }))} /><Input label="Unidade" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} /><Input label="Preco" type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) }))} /><Input label="Estoque" type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) }))} className="md:col-span-2" /></div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button><Button variant="lime" onClick={handleSubmit}>Salvar</Button></div></Card>}

      <Card className="overflow-hidden"><table className="w-full"><thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Codigo</th><th className="px-4 py-3">NCM</th><th className="px-4 py-3">CEST</th><th className="px-4 py-3">Un</th><th className="px-4 py-3">Preco</th><th className="px-4 py-3">Estoque</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Acoes</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((p) => (<tr key={p.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{p.code}</td><td className="px-4 py-3">{p.ncm || <Badge variant="outline">Sem NCM</Badge>}</td><td className="px-4 py-3">{p.cest || "-"}</td><td className="px-4 py-3">{p.unit}</td><td className="px-4 py-3 font-bold">{formatCurrency(p.price)}</td><td className="px-4 py-3">{p.stock}</td><td className="px-4 py-3"><Badge variant={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>))}</tbody></table></Card></div>
  );
}

