import Link from "next/link";
import { Route } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Emitir MDF-e" };
const steps = ["Dados do Manifesto", "Percurso", "Veículo", "Condutor", "Documentos Fiscais", "Seguro", "Informações Adicionais", "Revisão e Validação", "Transmissão"];
export default function EmitirMdfePage() { return <div className="space-y-5"><PageHeader eyebrow="Emissão" title="Emitir MDF-e" description="Fluxo preparado para o Manifesto Eletrônico de Documentos Fiscais." icon={Route} action={<Button asChild variant="outline"><Link href="/mdfe">Voltar à listagem</Link></Button>} /><Card className="p-5"><ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{steps.map((step, index) => <li key={step} className="rounded-xl border border-line p-3 text-sm"><b>{index + 1}.</b> {step}</li>)}</ol><p className="mt-5 text-sm text-subtle">A transmissão permanece bloqueada até existir persistência, validação no backend e integração MDF-e configurada.</p></Card></div>; }
