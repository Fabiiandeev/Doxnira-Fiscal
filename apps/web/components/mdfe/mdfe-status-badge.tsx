import { Badge } from "@/components/ui/badge";
import type { MdfeStatus } from "@/lib/mdfe-types";

const meta: Record<MdfeStatus, { label: string; variant: "neutral" | "warning" | "danger" | "success" | "info" | "dark" | "lime" }> = {
  DRAFT: { label: "Rascunho", variant: "neutral" },
  VALIDATING: { label: "Validando", variant: "warning" },
  VALIDATION_FAILED: { label: "Com pendências", variant: "danger" },
  READY_TO_AUTHORIZE: { label: "Pronto para autorizar", variant: "lime" },
  SIGNING: { label: "Assinando", variant: "info" },
  SIGNED: { label: "Assinado", variant: "info" },
  AUTHORIZING: { label: "Autorizando", variant: "info" },
  AUTHORIZED: { label: "Autorizado", variant: "success" },
  IN_TRANSIT: { label: "Em trânsito", variant: "success" },
  REJECTED: { label: "Rejeitado", variant: "danger" },
  DENIED: { label: "Denegado", variant: "danger" },
  CANCELLING: { label: "Cancelando", variant: "warning" },
  CANCELLED: { label: "Cancelado", variant: "dark" },
  CLOSING: { label: "Encerrando", variant: "warning" },
  CLOSED: { label: "Encerrado", variant: "dark" },
  CONTINGENCY: { label: "Contingência", variant: "warning" },
  ERROR: { label: "Reconciliação necessária", variant: "danger" },
};

export function MdfeStatusBadge({ status }: { status: MdfeStatus }) {
  const value = meta[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={value.variant}>{value.label}</Badge>;
}
