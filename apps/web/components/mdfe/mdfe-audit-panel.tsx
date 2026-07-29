import { Card } from "@/components/ui/card";

export function MdfeAuditPanel({ entries }: { entries: Array<Record<string, unknown>> }) {
  return <Card className="p-5"><h2 className="font-extrabold">Trilha de auditoria</h2><div className="mt-4 max-h-72 space-y-3 overflow-auto">{entries.length ? entries.map((entry, index) => <div key={String(entry.id ?? index)} className="text-sm"><p className="font-bold">{String(entry.action ?? "Ação")}</p><p className="text-xs text-subtle">{entry.createdAt ? new Date(String(entry.createdAt)).toLocaleString("pt-BR") : ""}</p></div>) : <p className="text-sm text-subtle">Nenhum registro disponível.</p>}</div></Card>;
}
