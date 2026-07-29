import { Suspense } from "react";

import { PaymentReturn } from "@/components/subscription-plans/payment-return";

export const metadata = { title: "Retorno do pagamento" };

export default function PaymentReturnPage() {
  return <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-white/60" />}><PaymentReturn /></Suspense>;
}
