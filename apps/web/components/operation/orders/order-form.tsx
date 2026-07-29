"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, getCompanyId } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/toast-viewport";
import { usePurchaseMutation } from "@/lib/services/operation/purchase-hooks";
import { useSalesMutation } from "@/lib/services/operation/sales-hooks";
import { inventoryService } from "@/lib/services/operation/inventory-service";

type Reference = { id: string; name?: string; code?: string; razaoSocial?: string; nome?: string; nomeFantasia?: string };
export function OrderForm({ kind }: { kind: "purchase" | "sale" }) {
  const router = useRouter(), purchase = usePurchaseMutation(), sales = useSalesMutation(), mutation = kind === "purchase" ? purchase : sales;
  const [form, setForm] = useState({ number: "", participantId: "", warehouseId: "", productId: "", quantity: "1", unitValue: "0", freight: "0", discount: "0", tax: "0", notes: "", externalKey: "" });
  const companyId = getCompanyId();
  const participants = useQuery({ queryKey: ["order-participants", kind, companyId], enabled: Boolean(companyId), queryFn: () => apiFetch<{ data: Reference[] }>(`/companies/${companyId}/${kind === "purchase" ? "fornecedores" : "clients"}?limit=100`) });
  const products = useQuery({ queryKey: ["order-products", companyId], enabled: Boolean(companyId), queryFn: () => apiFetch<{ data: Reference[] }>(`/companies/${companyId}/products?limit=100`) });
  const warehouses = useQuery({ queryKey: ["order-warehouses"], queryFn: () => inventoryService.warehouses({ page: 1, pageSize: 100, status: "ACTIVE" }) });
  const total = Number(form.quantity) * Number(form.unitValue) + Number(form.freight) - Number(form.discount) + Number(form.tax);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.number || !form.participantId || !form.warehouseId || !form.productId || total <= 0) return notify({ title: "Preencha os campos obrigatórios", tone: "error" });
    const common = { number: form.number, warehouseId: form.warehouseId, issueDate: new Date().toISOString(), totalAmount: total, freightAmount: Number(form.freight), discountAmount: Number(form.discount), taxAmount: Number(form.tax), notes: form.notes, items: [{ productId: form.productId, quantity: Number(form.quantity), unitValue: Number(form.unitValue), discountAmount: 0, taxAmount: 0 }] };
    const body = kind === "purchase" ? { ...common, supplierId: form.participantId, installments: [{ number: "1", dueDate: new Date().toISOString(), amount: total }], attachments: [] } : { ...common, clientId: form.participantId, origin: "MANUAL", externalKey: form.externalKey || null };
    mutation.mutate({ action: "create", body }, { onSuccess: (created) => { notify({ title: "Pedido criado", tone: "success" }); router.push(`/operacao/${kind === "purchase" ? "compras" : "vendas"}/${created.id}`); }, onError: (error) => notify({ title: "Erro ao criar pedido", description: error.message, tone: "error" }) });
  };
  const loading = participants.isLoading || products.isLoading || warehouses.isLoading;
  if (loading) return <div className="h-72 animate-pulse rounded-xl bg-muted" />;
  return <form onSubmit={submit} className="space-y-5"><div><h1 className="text-2xl font-extrabold">Nova {kind === "purchase" ? "compra" : "venda"}</h1><p className="text-sm text-subtle">Valores validados antes da gravação.</p></div><Card className="grid gap-4 p-5 md:grid-cols-2">
    <label className="text-sm">Número<Input value={form.number} onChange={(event) => set("number", event.target.value)} required /></label>
    <label className="text-sm">{kind === "purchase" ? "Fornecedor" : "Cliente"}<select className="mt-1 h-10 w-full rounded-lg border bg-background px-3" value={form.participantId} onChange={(event) => set("participantId", event.target.value)} required><option value="">Selecione</option>{participants.data?.data.map((item) => <option key={item.id} value={item.id}>{item.razaoSocial || item.nome || item.nomeFantasia || item.name}</option>)}</select></label>
    <label className="text-sm">Depósito<select className="mt-1 h-10 w-full rounded-lg border bg-background px-3" value={form.warehouseId} onChange={(event) => set("warehouseId", event.target.value)} required><option value="">Selecione</option>{warehouses.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-sm">Produto<select className="mt-1 h-10 w-full rounded-lg border bg-background px-3" value={form.productId} onChange={(event) => set("productId", event.target.value)} required><option value="">Selecione</option>{products.data?.data.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
    <label className="text-sm">Quantidade<Input type="number" min="0.0001" step="0.0001" value={form.quantity} onChange={(event) => set("quantity", event.target.value)} /></label><label className="text-sm">Valor unitário<Input type="number" min="0" step="0.01" value={form.unitValue} onChange={(event) => set("unitValue", event.target.value)} /></label>
    <label className="text-sm">Frete<Input type="number" min="0" step="0.01" value={form.freight} onChange={(event) => set("freight", event.target.value)} /></label><label className="text-sm">Desconto<Input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => set("discount", event.target.value)} /></label>
    <label className="text-sm">Impostos<Input type="number" min="0" step="0.01" value={form.tax} onChange={(event) => set("tax", event.target.value)} /></label>{kind === "sale" && <label className="text-sm">Chave externa<Input value={form.externalKey} onChange={(event) => set("externalKey", event.target.value)} /></label>}
    <label className="text-sm md:col-span-2">Observações<Input value={form.notes} onChange={(event) => set("notes", event.target.value)} /></label><p className="font-bold">Total: {total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><Button type="submit" disabled={mutation.isPending}>Salvar rascunho</Button>
  </Card></form>;
}
