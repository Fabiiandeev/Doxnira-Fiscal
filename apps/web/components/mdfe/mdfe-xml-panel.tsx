import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mdfeService } from "@/lib/services/mdfe-service";

export function MdfeXmlPanel({ id, enabled }: { id: string; enabled: boolean }) {
  return <Card className="p-5"><h2 className="font-extrabold">XML fiscal</h2><p className="my-3 text-sm text-subtle">O download retorna o último artefato assinado/processado preservado pelo backend.</p><Button asChild variant="outline" disabled={!enabled}><a href={enabled ? mdfeService.xmlUrl(id) : undefined}><Download className="h-4 w-4" /> Baixar XML</a></Button></Card>;
}
