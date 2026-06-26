"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
} from "@/lib/services/product-service";

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    ncm: "",
    cest: "",
    unit: "UN",
    price: 0,
    stock: 0,
  });

  const fetchProducts = useCallback(async () => {
    try {
      setError(null);
      const data = await listProducts();
      setProducts(data);
    } catch {
      setError("Nao foi possivel carregar produtos. Tente novamente.");
      notify({ title: "Erro ao carregar produtos", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSubmit = async () => {
    try {
      const payload = {
        name: form.name,
        code: form.code,
        ncm: form.ncm || null,
        cest: form.cest || null,
        unit: form.unit,
        price: form.price,
        stock: form.stock,
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        notify({ title: "Produto atualizado" });
      } else {
        await createProduct({ ...payload, active: true });
        notify({ title: "Produto criado" });
      }
      setShowForm(false);
      setEditing(null);
      setForm({
        name: "",
        code: "",
        ncm: "",
        cest: "",
        unit: "UN",
        price: 0,
        stock: 0,
      });
      fetchProducts();
    } catch {
      notify({ title: "Erro ao salvar produto", tone: "error" });
    }
  };

  const handleEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      ncm: p.ncm ?? "",
      cest: p.cest ?? "",
      unit: p.unit,
      price: Number(p.price),
      stock: p.stock,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    try {
      await deleteProduct(id);
      notify({ title: "Produto excluido" });
      fetchProducts();
    } catch {
      notify({ title: "Erro ao excluir produto", tone: "error" });
    }
  };

  const handleNew = () => {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      ncm: "",
      cest: "",
      unit: "UN",
      price: 0,
      stock: 0,
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="p-8 text-subtle">Carregando produtos...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchProducts}>Tentar novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Produtos</h1>
          <p className="text-sm text-subtle">
            Cadastro de produtos com NCM, CEST e tributacao
          </p>
        </div>
        <Button variant="lime" onClick={handleNew}>
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </div>

      <Card className="p-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, codigo, NCM..."
          className="max-w-sm"
        />
      </Card>

      {showForm && (
        <Card className="p-4">
          <h3 className="font-bold mb-3">
            {editing ? "Editar produto" : "Novo produto"}
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="Nome"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <Input
              label="Codigo"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <Input
              label="NCM"
              value={form.ncm}
              onChange={(e) => setForm((f) => ({ ...f, ncm: e.target.value }))}
            />
            <Input
              label="CEST"
              value={form.cest}
              onChange={(e) =>
                setForm((f) => ({ ...f, cest: e.target.value }))
              }
            />
            <Input
              label="Unidade"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
            <Input
              label="Preco"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: parseFloat(e.target.value) }))
              }
            />
            <Input
              label="Estoque"
              type="number"
              value={form.stock}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  stock: parseInt(e.target.value),
                }))
              }
              className="md:col-span-2"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="lime" onClick={handleSubmit}>
              Salvar
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-muted/50 text-xs font-bold uppercase text-subtle">
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Codigo</th>
              <th className="px-4 py-3">NCM</th>
              <th className="px-4 py-3">CEST</th>
              <th className="px-4 py-3">Un</th>
              <th className="px-4 py-3">Preco</th>
              <th className="px-4 py-3">Estoque</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.code}</td>
                <td className="px-4 py-3">
                  {p.ncm || <Badge variant="outline">Sem NCM</Badge>}
                </td>
                <td className="px-4 py-3">{p.cest || "-"}</td>
                <td className="px-4 py-3">{p.unit}</td>
                <td className="px-4 py-3 font-bold">
                  {formatCurrency(Number(p.price))}
                </td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.active ? "success" : "neutral"}>
                    {p.active ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(p)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
