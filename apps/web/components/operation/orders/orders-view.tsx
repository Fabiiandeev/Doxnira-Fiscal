"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePurchases } from "@/lib/services/operation/purchase-hooks";
import { useSales } from "@/lib/services/operation/sales-hooks";
import { Purchase } from "@/lib/services/operation/purchase-types";
import { Sale } from "@/lib/services/operation/sales-types";

export function OrdersView({ kind }: { kind: "purchases" | "sales" }) {
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1);
  const query = `q=${encodeURIComponent(search)}&status=${status}&page=${page}&pageSize=20`;
  const purchases = usePurchases(kind === "purchases" ? query : "disabled=1");
  const sales = useSales(kind === "sales" ? query : "disabled=1");
  const result = kind === "purchases" ? purchases : sales;
  const rows = result.data?.data || [];
  const base = kind === "purchases" ? "/operacao/compras" : "/operacao/vendas";
  return <div className="space-y-5">
    <div className="flex items-end justify-between"><div><h1 className="text-2xl font-extrabold">{kind === "purchases" ? "Compras" : "Vendas"}</h1><p className="text-sm text-subtle">Fluxo operacional integrado a estoque, fiscal e financeiro.</p></div><Link href={`${base}/nova`}><Button>Novo pedido</Button></Link></div>
    <Card className="grid gap-3 p-4 md:grid-cols-2"><Input placeholder="Buscar número ou participante" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><select className="rounded-lg border bg-background px-3" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Todos os status</option>{["DRAFT","PENDING_APPROVAL","APPROVED","PARTIALLY_RECEIVED","RECEIVED","RESERVED","PARTIALLY_INVOICED","INVOICED","SHIPPED","CANCELED","REJECTED","RETURNED"].map((value) => <option key={value}>{value}</option>)}</select></Card>
    {result.isLoading ? <div className="space-y-3">{[1,2,3].map((value) => <div key={value} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div> : result.isError ? <Card className="p-8 text-center"><p>Erro ao carregar pedidos.</p><Button className="mt-3" onClick={() => result.refetch()}>Tentar novamente</Button></Card> : !rows.length ? <Card className="p-8 text-center text-subtle">Nenhum pedido encontrado.</Card> : <div className="space-y-3">{rows.map((entry) => {
      const order = entry as Purchase | Sale;
      const participant = kind === "purchases" ? (order as Purchase).supplier?.razaoSocial || (order as Purchase).supplier?.nome || (order as Purchase).supplier?.nomeFantasia : (order as Sale).client?.razaoSocial || (order as Sale).client?.nome || (order as Sale).client?.nomeFantasia;
      return <Link key={order.id} href={`${base}/${order.id}`}><Card className="mb-3 flex items-center justify-between p-4 hover:bg-muted/50"><div><p className="font-bold">#{order.number} · {participant || "Sem nome"}</p><p className="text-sm text-subtle">{order.status} · {new Date(order.issueDate).toLocaleDateString("pt-BR")}</p></div><p className="font-bold">{Number(order.totalAmount).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></Card></Link>;
    })}</div>}
    {(result.data?.pagination.totalPages || 0) > 1 && <div className="flex justify-end gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span className="p-2 text-sm">{page}/{result.data?.pagination.totalPages}</span><Button variant="outline" disabled={page === result.data?.pagination.totalPages} onClick={() => setPage(page + 1)}>Próxima</Button></div>}
  </div>;
}
