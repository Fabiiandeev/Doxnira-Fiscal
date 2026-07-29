import { Card } from "@/components/ui/card";

export function MdfeEventsPanel({ events }: { events: Array<Record<string, unknown>> }) {
  return <Card className="p-5"><h2 className="font-extrabold">Eventos fiscais</h2><div className="mt-4 space-y-3">{events.length ? events.map((event, index) => <div key={String(event.id ?? index)} className="border-l-2 border-lime pl-3 text-sm"><p className="font-bold">{String(event.type ?? event.eventType ?? "Evento")}</p><p className="text-xs text-subtle">{String(event.statusReason ?? event.protocol ?? "")}</p></div>) : <p className="text-sm text-subtle">Nenhum evento registrado.</p>}</div></Card>;
}
