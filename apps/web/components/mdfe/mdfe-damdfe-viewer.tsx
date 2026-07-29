import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mdfeService } from "@/lib/services/mdfe-service";

export function MdfeDamdfeViewer({ id, enabled }: { id: string; enabled: boolean }) {
  return <Card className="p-5"><h2 className="font-extrabold">DAMDFE</h2><p className="my-3 text-sm text-subtle">Representação auxiliar para visualização e impressão.</p><Button asChild variant="outline" disabled={!enabled}><a href={enabled ? mdfeService.damdfeUrl(id) : undefined} target="_blank" rel="noreferrer"><FileDown className="h-4 w-4" /> Visualizar DAMDFE</a></Button></Card>;
}
