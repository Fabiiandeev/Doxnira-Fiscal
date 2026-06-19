import { Badge } from "@/components/ui/badge";
import type {
  DocumentStatus,
  ManifestationStatus,
  XmlType,
} from "@/lib/types";

const statusLabels: Record<DocumentStatus, string> = {
  AUTHORIZED: "Autorizada",
  CANCELLED: "Cancelada",
  EVENT: "Evento",
};

export function FiscalStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge
      variant={
        status === "AUTHORIZED" ? "success" : status === "CANCELLED" ? "danger" : "info"
      }
    >
      {statusLabels[status]}
    </Badge>
  );
}

export function XmlTypeBadge({ type }: { type: XmlType }) {
  return (
    <Badge variant={type === "FULL" ? "dark" : "warning"}>
      {type === "FULL" ? "Completo" : "Resumo"}
    </Badge>
  );
}

const manifestationLabels: Record<ManifestationStatus, string> = {
  PENDING: "Pendente",
  AWARE: "Ciência",
  CONFIRMED: "Confirmada",
  UNKNOWN: "Desconhecida",
  NOT_PERFORMED: "Não realizada",
};

export function ManifestationBadge({ status }: { status: ManifestationStatus }) {
  return (
    <Badge
      variant={
        status === "CONFIRMED"
          ? "success"
          : status === "PENDING"
            ? "warning"
            : status === "UNKNOWN"
              ? "danger"
              : "info"
      }
    >
      {manifestationLabels[status]}
    </Badge>
  );
}

