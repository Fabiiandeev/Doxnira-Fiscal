"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { checkoutInvoiceKey } from "./plan-catalog";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { subscriptionPaymentService } from "@/lib/services/subscription-payment-service";

export function PaymentReturn() {
  const params = useSearchParams();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  useEffect(() => setInvoiceId(window.sessionStorage.getItem(checkoutInvoiceKey)), []);
  const invoice = useQuery({
    queryKey: ["subscription-invoice", invoiceId],
    queryFn: () => subscriptionPaymentService.getInvoice(invoiceId || ""),
    enabled: Boolean(invoiceId),
  });
  const check = useMutation({
    mutationFn: () => subscriptionPaymentService.checkPayment(invoiceId || "", {
      transactionNsu: params?.get("transaction_nsu") || undefined,
      invoiceSlug: params?.get("slug") || undefined,
      receiptUrl: params?.get("receipt_url") || undefined,
    }),
    onSuccess: () => {
      notify({ title: "Pagamento confirmado", tone: "success" });
      void invoice.refetch();
    },
    onError: (error) => notify({ title: "Pagamento ainda não confirmado", description: error.message, tone: "error" }),
  });

  if (!invoiceId) return <Card className="p-8 text-center"><p className="font-bold">Não encontramos a fatura desta sessão.</p><Button asChild className="mt-4"><Link href="/settings/subscription">Voltar aos planos</Link></Button></Card>;
  if (invoice.isLoading) return <div className="h-72 animate-pulse rounded-2xl bg-white/60" />;
  if (invoice.isError || !invoice.data) return <Card className="p-8 text-center"><p className="font-bold">Não foi possível carregar a fatura.</p><Button className="mt-4" onClick={() => invoice.refetch()}>Tentar novamente</Button></Card>;

  const paid = invoice.data.status === "PAID";
  return (
    <Card className="mx-auto max-w-2xl p-8 text-center">
      <CheckCircle2 className={`mx-auto h-12 w-12 ${paid ? "text-emerald-600" : "text-amber-500"}`} />
      <h1 className="mt-4 text-2xl font-extrabold">{paid ? "Pagamento confirmado" : "Confirme seu pagamento"}</h1>
      <p className="mt-2 text-sm text-subtle">{invoice.data.planNameSnapshot} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: invoice.data.currency }).format(invoice.data.amountCents / 100)}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {!paid && <Button variant="lime" disabled={check.isPending} onClick={() => check.mutate()}><RefreshCw className="h-4 w-4" />Verificar pagamento</Button>}
        {invoice.data.receiptUrl && <Button asChild variant="outline"><a href={invoice.data.receiptUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Visualizar comprovante</a></Button>}
        <Button asChild variant="outline"><Link href="/dashboard">Retornar ao sistema</Link></Button>
      </div>
    </Card>
  );
}
