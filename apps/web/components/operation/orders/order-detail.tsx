"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/toast-viewport";
import { usePurchase, usePurchaseMutation } from "@/lib/services/operation/purchase-hooks";
import { useSale, useSalesMutation } from "@/lib/services/operation/sales-hooks";
import type { Purchase } from "@/lib/services/operation/purchase-types";
import type { Sale } from "@/lib/services/operation/sales-types";

export function OrderDetail({ kind, id }: { kind: "purchase" | "sale"; id: string }) {
  const purchaseQuery = usePurchase(kind === "purchase" ? id : undefined), saleQuery = useSale(kind === "sale" ? id : undefined);
  const purchaseMutation = usePurchaseMutation(), salesMutation = useSalesMutation();
  const query = kind === "purchase" ? purchaseQuery : saleQuery, mutation = kind === "purchase" ? purchaseMutation : salesMutation;
  const order = query.data;
  const act = (action: string, body: unknown = {}) => mutation.mutate({ id, action, body }, { onSuccess: (value) => notify({ title: "Operação concluída", description: "status" in value && value.status === "CONFIGURATION_REQUIRED" ? "Configuração fiscal necessária; documento mantido em preparação." : undefined, tone: "success" }), onError: (error) => notify({ title: "Operação não concluída", description: error.message, tone: "error" }) });
  if (query.isLoading) return <div className="space-y-3">{[1,2,3].map((value) => <div key={value} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>;
  if (query.isError) return <Card className="p-8 text-center"><p>Erro ao carregar detalhe.</p><Button className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></Card>;
  if (!order) return <Card className="p-8">Pedido não encontrado.</Card>;
  const reason = (action: string) => { const value = window.prompt("Justificativa obrigatória"); if (value?.trim() && window.confirm(`Confirmar ${action}?`)) act(action, { reason: value }); };
  const receive = () => {
    if (kind !== "purchase") return;
    const items = (order as Purchase).items?.map((item) => ({ purchaseOrderItemId: item.id, quantity: Number(item.quantity) - Number(item.receivedQuantity) })).filter((item) => item.quantity > 0) || [];
    if (items.length && window.confirm("Receber todas as quantidades pendentes?")) act("receive", { idempotencyKey: crypto.randomUUID(), items });
  };
  const invoice = () => {
    if (kind !== "sale") return;
    const items = (order as Sale).items?.map((item) => ({ salesOrderItemId: item.id, quantity: Number(item.quantity) - Number(item.invoicedQuantity) })).filter((item) => item.quantity > 0) || [];
    if (items.length) act("invoice", { documentType: "NFE", idempotencyKey: crypto.randomUUID(), items });
  };
  const salesReturn = () => {
    if (kind !== "sale") return;
    const item = (order as Sale).items?.find((candidate) => Number(candidate.invoicedQuantity) > Number(candidate.returnedQuantity));
    if (!item) return notify({ title: "Não há quantidade faturada disponível para devolução", tone: "error" });
    const raw = window.prompt(`Quantidade a devolver de ${item.product?.name}`, "1"), reasonValue = raw && window.prompt("Motivo da devolução");
    if (raw && reasonValue) act("returns", { reason: reasonValue, idempotencyKey: crypto.randomUUID(), adjustFinancial: true, items: [{ salesOrderItemId: item.id, quantity: Number(raw) }] });
  };
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold">{kind === "purchase" ? "Compra" : "Venda"} #{order.number}</h1><p className="text-sm text-subtle">{order.status} · {Number(order.totalAmount).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div>
    <Card className="flex flex-wrap gap-2 p-4">
      {order.status === "DRAFT" && <Button onClick={() => act("submit")}>Enviar para aprovação</Button>}
      {order.status === "PENDING_APPROVAL" && <><Button onClick={() => act("approve")}>Aprovar</Button><Button variant="outline" onClick={() => reason("reject")}>Rejeitar</Button></>}
      {kind === "purchase" && ["APPROVED","PARTIALLY_RECEIVED"].includes(order.status) && <Button onClick={receive}>Receber pendências</Button>}
      {kind === "sale" && order.status === "APPROVED" && <Button onClick={() => act("reserve")}>Reservar estoque</Button>}
      {kind === "sale" && order.status === "RESERVED" && <><Button onClick={invoice}>Faturar</Button><Button variant="outline" onClick={() => act("release")}>Liberar reserva</Button></>}
      {kind === "sale" && order.status === "PARTIALLY_INVOICED" && <Button onClick={invoice}>Continuar faturamento</Button>}
      {kind === "sale" && order.status === "INVOICED" && <Button onClick={() => act("ship")}>Registrar expedição</Button>}
      {kind === "sale" && ["INVOICED","SHIPPED","COMPLETED","RETURNED"].includes(order.status) && <Button variant="outline" onClick={salesReturn}>Registrar devolução</Button>}
      {!["RECEIVED","CANCELED","REJECTED","INVOICED","SHIPPED","COMPLETED","RETURNED"].includes(order.status) && <Button variant="outline" onClick={() => reason("cancel")}>Cancelar</Button>}
    </Card>
    <Card className="p-5"><h2 className="mb-3 font-bold">Itens</h2>{"items" in order && order.items?.map((item) => <div key={item.id} className="flex justify-between border-b py-3 text-sm"><span>{item.product?.code} · {item.product?.name}</span><span>Qtd. {item.quantity} · {"receivedQuantity" in item ? `Recebida ${item.receivedQuantity}` : `Reservada ${item.reservedQuantity} · Faturada ${item.invoicedQuantity} · Devolvida ${item.returnedQuantity}`}</span></div>)}</Card>
    <Card className="p-5"><h2 className="mb-3 font-bold">Timeline auditável</h2>{order.timeline?.length ? order.timeline.map((entry) => <div key={entry.id} className="border-l-2 pl-4 pb-4"><p className="font-semibold">{entry.action}</p><p className="text-xs text-subtle">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p></div>) : <p className="text-sm text-subtle">Nenhum evento adicional.</p>}</Card>
  </div>;
}
