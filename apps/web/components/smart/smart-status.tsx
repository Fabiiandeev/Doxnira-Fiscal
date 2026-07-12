import { Badge } from "@/components/ui/badge";

export type SmartStatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "lime";

export function SmartStatus({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: SmartStatusTone;
}) {
  return <Badge variant={tone}>{label}</Badge>;
}
