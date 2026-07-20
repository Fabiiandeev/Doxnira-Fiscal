import Link from "next/link";
import { Route } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "MDF-e" };

export default function MdfePage() {
  return <div className="space-y-5"><PageHeader eyebrow="Documento de transporte" title="MDF-e" description="Gerencie os Manifestos Eletrônicos de Documentos Fiscais" icon={Route} action={<Button asChild variant="lime"><Link href="/mdfe/emitir">Emitir MDF-e</Link></Button>} /><Card className="p-6 text-sm text-subtle">A listagem de MDF-e será habilitada quando o serviço fiscal correspondente estiver configurado. Nenhuma emissão ou autorização é simulada.</Card></div>;
}
