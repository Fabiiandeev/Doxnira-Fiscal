"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  mdfeOperationalService,
  type Driver,
} from "@/lib/services/mdfe-operational-service";

const emptyForm = { name: "", cpf: "", phone: "", license: "", licenseType: "" };

export function DriversView() {
  const [items, setItems] = useState<Driver[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await mdfeOperationalService.drivers()).data);
    } catch (error) {
      notify({ title: "Condutores não carregados", description: (error as Error).message, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    setSaving(true);
    try {
      await mdfeOperationalService.createDriver(form);
      setForm(emptyForm);
      await load();
      notify({ title: "Condutor cadastrado", tone: "success" });
    } catch (error) {
      notify({ title: "Condutor não salvo", description: (error as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Driver) {
    if (!window.confirm(`Excluir o condutor ${item.name}?`)) return;
    try {
      await mdfeOperationalService.deleteDriver(item.id);
      await load();
      notify({ title: "Condutor removido", tone: "success" });
    } catch (error) {
      notify({ title: "Condutor não removido", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cadastros"
        title="Condutores"
        description="Cadastro mestre usado nos padrões operacionais e nos snapshots do MDF-e."
        icon={Users}
      />
      <Card className="mb-5 grid gap-3 p-5 md:grid-cols-5">
        <Input label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input label="CPF" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} />
        <Input label="Telefone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Input label="CNH" value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} />
        <Input label="Categoria" value={form.licenseType} onChange={(event) => setForm({ ...form, licenseType: event.target.value })} />
        <div className="md:col-span-5">
          <Button variant="lime" disabled={saving || !form.name || !form.cpf} onClick={create}>
            <Plus className="h-4 w-4" />{saving ? "Salvando…" : "Cadastrar condutor"}
          </Button>
        </div>
      </Card>
      <Card className="overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr><th className="p-4">Condutor</th><th>CPF</th><th>CNH</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t" key={item.id}>
                <td className="p-4"><b>{item.name}</b><p className="text-xs text-subtle">{item.phone || "Sem telefone"}</p></td>
                <td>{item.cpf}</td>
                <td>{item.license || "—"} {item.licenseType ? `· ${item.licenseType}` : ""}</td>
                <td><Badge>{item.isActive ? "ATIVO" : "INATIVO"}</Badge></td>
                <td className="pr-4 text-right"><Button size="sm" variant="danger" onClick={() => remove(item)}><Trash2 className="h-4 w-4" />Excluir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !items.length && <p className="p-8 text-center text-sm text-subtle">Nenhum condutor cadastrado.</p>}
        {loading && <p className="p-8 text-center text-sm text-subtle">Carregando…</p>}
      </Card>
    </>
  );
}
