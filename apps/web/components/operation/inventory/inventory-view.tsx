"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/toast-viewport";
import { useInventoryList, useInventoryMutation, useInventorySummary } from "@/lib/services/operation/inventory-hooks";
import type { Balance, Count, Movement, Reservation, Transfer, Warehouse } from "@/lib/services/operation/inventory-types";

type Mode = "balances" | "movements" | "reservations" | "transfers" | "counts";
const links = [
  ["/operacao/estoque", "Saldos"],
  ["/operacao/estoque/movimentos", "Movimentos"],
  ["/operacao/estoque/reservas", "Reservas"],
  ["/operacao/estoque/transferencias", "Transferências"],
  ["/operacao/estoque/inventarios", "Inventários"],
];
const number = (value: string | number | undefined) => Number(value || 0);
const money = (value: string | number | undefined) => number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const Skeleton = () => <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>;

export function InventoryView({ mode }: { mode: Mode }) {
  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const filters = { q, warehouseId, status, page, pageSize: 20 };
  const list = useInventoryList(mode, filters);
  const warehouses = useInventoryList("warehouses", { pageSize: 100, page: 1 });
  const balances = useInventoryList("balances", { warehouseId, pageSize: 100, page: 1 });
  const summary = useInventorySummary();
  const mutation = useInventoryMutation();
  const rows = (list.data?.data || []) as Array<Balance | Movement | Reservation | Transfer | Count>;
  const warehouseRows = (warehouses.data?.data || []) as Warehouse[];
  const balanceRows = balances.data?.data as Balance[] | undefined;
  const title = { balances: "Estoque", movements: "Movimentações", reservations: "Reservas", transfers: "Transferências", counts: "Inventários" }[mode];
  const execute = (action: string, id?: string, body?: unknown) => mutation.mutate({ action, id, body }, {
    onSuccess: () => notify({ title: "Estoque atualizado", tone: "success" }),
    onError: (error) => notify({ title: "Não foi possível concluir", description: error.message, tone: "error" }),
  });
  const products = (() => {
    const found = new Map<string, Balance>();
    (balanceRows || []).forEach((row) => found.set(row.productId, row));
    return [...found.values()];
  })();

  const createWarehouse = () => {
    const code = window.prompt("Código do depósito"); if (!code) return;
    const name = window.prompt("Nome do depósito"); if (!name) return;
    execute("warehouse.create", undefined, { code, name, isDefault: warehouseRows.length === 0 });
  };
  const adjust = () => {
    const row = products[0]; if (!row) return notify({ title: "Selecione um depósito com produto", tone: "error" });
    const raw = window.prompt(`Diferença para ${row.product.name} (use negativo para saída)`); if (!raw) return;
    const reason = window.prompt("Justificativa obrigatória"); if (!reason?.trim()) return notify({ title: "Informe a justificativa", tone: "error" });
    execute("adjust", undefined, { warehouseId: row.warehouseId, productId: row.productId, quantity: Number(raw), unitCost: number(row.averageCost), reason, idempotencyKey: crypto.randomUUID() });
  };
  const createReservation = () => {
    const row = products[0]; if (!row) return notify({ title: "Nenhum saldo disponível", tone: "error" });
    const raw = window.prompt(`Quantidade a reservar de ${row.product.name}`); if (!raw) return;
    execute("reservation.create", undefined, { warehouseId: row.warehouseId, productId: row.productId, quantity: Number(raw), sourceType: "MANUAL", externalKey: `manual:${crypto.randomUUID()}` });
  };
  const createTransfer = () => {
    if (warehouseRows.length < 2 || !products[0]) return notify({ title: "São necessários dois depósitos e um saldo", tone: "error" });
    const raw = window.prompt(`Quantidade de ${products[0].product.name}`); if (!raw) return;
    execute("transfer.create", undefined, { sourceWarehouseId: products[0].warehouseId, destinationWarehouseId: warehouseRows.find((item) => item.id !== products[0].warehouseId)!.id, reason: "Transferência manual", items: [{ productId: products[0].productId, quantity: Number(raw), unitCost: number(products[0].averageCost) }] });
  };
  const createCount = () => {
    const selected = warehouseId || warehouseRows[0]?.id; if (!selected) return notify({ title: "Cadastre um depósito", tone: "error" });
    execute("count.create", undefined, { warehouseId: selected, notes: "Contagem operacional" });
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold">{title}</h1><p className="text-sm text-subtle">Controle por depósito com histórico e rastreabilidade.</p></div>
      <div className="flex gap-2">
        {mode === "balances" && <><Button variant="outline" onClick={createWarehouse}>Novo depósito</Button><Button onClick={adjust}>Ajustar saldo</Button></>}
        {mode === "reservations" && <Button onClick={createReservation}>Criar reserva</Button>}
        {mode === "transfers" && <Button onClick={createTransfer}>Criar transferência</Button>}
        {mode === "counts" && <Button onClick={createCount}>Criar inventário</Button>}
        <Button variant="outline" onClick={() => list.refetch()} disabled={list.isFetching}>Atualizar</Button>
      </div>
    </div>
    <nav className="flex flex-wrap gap-2">{links.map(([href, label]) => <Link key={href} href={href} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted">{label}</Link>)}</nav>
    {mode === "balances" && <div className="grid gap-3 md:grid-cols-4">
      {[["Produtos", summary.data?.products], ["Valor em estoque", money(summary.data?.inventoryValue)], ["Abaixo do mínimo", summary.data?.belowMinimum], ["Sem estoque", summary.data?.outOfStock]].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-xs text-subtle">{label}</p><p className="mt-1 text-xl font-bold">{summary.isLoading ? "…" : value ?? 0}</p></Card>)}
    </div>}
    <Card className="grid gap-3 p-4 md:grid-cols-3">
      <Input aria-label="Pesquisar" placeholder="Pesquisar" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
      <select aria-label="Depósito" className="rounded-lg border bg-background px-3" value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setPage(1); }}>
        <option value="">Todos os depósitos</option>{warehouseRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select aria-label="Status" className="rounded-lg border bg-background px-3" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
        <option value="">Todos os status</option>{["ACTIVE", "CONFIRMED", "RELEASED", "COMPLETED", "CANCELED", "LOW", "OUT"].map((item) => <option key={item}>{item}</option>)}
      </select>
    </Card>
    {list.isLoading ? <Skeleton /> : list.isError ? <Card className="p-6"><p>Falha ao carregar dados reais.</p><Button className="mt-3" onClick={() => list.refetch()}>Tentar novamente</Button></Card> : rows.length === 0 ? <Card className="p-8 text-center text-subtle">Nenhum registro encontrado.</Card> :
      <div className="space-y-3">{rows.map((row) => <InventoryRow key={row.id} mode={mode} row={row} pending={mutation.isPending} execute={execute} />)}</div>}
    {!!list.data?.pagination.totalPages && list.data.pagination.totalPages > 1 && <div className="flex items-center justify-end gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><span className="text-sm">{page} / {list.data.pagination.totalPages}</span><Button variant="outline" disabled={page >= list.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div>}
  </div>;
}

function InventoryRow({ mode, row, pending, execute }: { mode: Mode; row: Balance | Movement | Reservation | Transfer | Count; pending: boolean; execute: (action: string, id?: string, body?: unknown) => void }) {
  if (mode === "balances") {
    const item = row as Balance; const available = number(item.physicalQuantity) - number(item.reservedQuantity);
    return <Card className="p-4"><div className="flex justify-between gap-4"><div><Link href={`/products/${item.productId}`} className="font-bold hover:underline">{item.product.code} · {item.product.name}</Link><p className="text-sm text-subtle">{item.warehouse.name} · atualizado {new Date(item.updatedAt).toLocaleString("pt-BR")}</p></div><div className="text-right"><p className="font-bold">Disponível {available}</p><p className="text-xs text-subtle">Físico {number(item.physicalQuantity)} · Reservado {number(item.reservedQuantity)} · Custo {money(item.averageCost)}</p><Link className="text-xs underline" href={`/operacao/estoque/movimentos?productId=${item.productId}`}>Ver histórico</Link></div></div></Card>;
  }
  if (mode === "movements") {
    const item = row as Movement;
    return <Card className="p-4"><div className="flex justify-between"><div><p className="font-bold">{item.type} · {item.product.name}</p><p className="text-sm text-subtle">{item.warehouse.name} · {item.sourceType || "MANUAL"} {item.sourceId || item.externalKey || ""}</p></div><div className="text-right"><p className={number(item.quantity) < 0 ? "font-bold text-red-600" : "font-bold text-green-600"}>{number(item.quantity)}</p><p className="text-xs text-subtle">{number(item.previousQuantity)} → {number(item.resultingQuantity)} · {money(item.totalCost)}</p><p className="text-xs text-subtle">{item.user?.name || "Sistema"} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p></div></div></Card>;
  }
  if (mode === "reservations") {
    const item = row as Reservation;
    return <Card className="p-4"><p className="font-bold">{item.product.name} · {item.quantity}</p><p className="text-sm text-subtle">{item.warehouse.name} · {item.sourceType} · {item.status}{item.expiresAt ? ` · expira ${new Date(item.expiresAt).toLocaleString("pt-BR")}` : ""}</p>{item.status === "ACTIVE" && <div className="mt-3 flex gap-2">{["confirm", "release", "cancel"].map((action) => <Button key={action} size="sm" variant={action === "confirm" ? "default" : "outline"} disabled={pending} onClick={() => { if (window.confirm(`Confirmar ação ${action}?`)) execute(`reservation.${action}`, item.id); }}>{action}</Button>)}</div>}</Card>;
  }
  if (mode === "transfers") {
    const item = row as Transfer;
    return <Card className="p-4"><p className="font-bold">{item.sourceWarehouse.name} → {item.destinationWarehouse.name}</p><p className="text-sm text-subtle">{item.status} · {item.items.map((part) => `${part.product.name}: ${part.quantity}`).join(", ")}</p>{["DRAFT", "PENDING"].includes(item.status) && <div className="mt-3 flex gap-2"><Button size="sm" disabled={pending} onClick={() => { if (window.confirm("Concluir transferência atomicamente?")) execute("transfer.complete", item.id); }}>Concluir</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => execute("transfer.cancel", item.id)}>Cancelar</Button></div>}</Card>;
  }
  const item = row as Count;
  const saveCounts = () => {
    const values = item.items?.map((part) => {
      const entered = window.prompt(`Contagem de ${part.product.name}`, part.countedQuantity ?? part.expectedQuantity);
      return entered === null ? null : { productId: part.productId, countedQuantity: Number(entered) };
    });
    if (values?.some((value) => value === null)) return;
    execute("count.save", item.id, values || []);
  };
  return <Card className="p-4"><p className="font-bold">{item.warehouse.name} · {item.status}</p><p className="text-sm text-subtle">{item.responsible.name} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p>{item.items?.map((part) => <p key={part.id} className="text-xs text-subtle">{part.product.name}: esperado {part.expectedQuantity}, contado {part.countedQuantity ?? "pendente"}, diferença {part.differenceQuantity ?? "—"}</p>)}{["DRAFT", "COUNTING"].includes(item.status) && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" disabled={pending || !item.items?.length} onClick={saveCounts}>Informar contagens</Button><Button size="sm" disabled={pending} onClick={() => { if (window.confirm("Concluir inventário e gerar ajustes?")) execute("count.complete", item.id); }}>Concluir</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => execute("count.cancel", item.id)}>Cancelar</Button></div>}</Card>;
}
