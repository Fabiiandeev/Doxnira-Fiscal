import { Truck } from "lucide-react";

import { FiscalModuleView } from "@/components/fiscal/fiscal-module-view";

export const metadata = { title: "CT-e" };

export default function CtePage() {
  return (
    <FiscalModuleView
      eyebrow="Documento de transporte"
      title="CT-e"
      description="Base operacional para CT-e com vinculacao de NF-e, remessa, recebedor, veiculo, motorista, RNTRC e eventos fiscais."
      icon={Truck}
      statusLabel="Base operacional"
      statusVariant="warning"
      primaryAction={{ label: "Abrir documentos", href: "/documents" }}
      secondaryAction={{ label: "Ver XML Fiscal", href: "/xml-fiscal", variant: "outline" }}
      metrics={[
        { label: "Vinculo NF-e", value: "Preparado" },
        { label: "Transportadora", value: "Base pronta" },
        { label: "RNTRC", value: "Reservado" },
        { label: "Eventos", value: "Prontos" },
      ]}
      checklist={[
        { title: "Remetente e destinatario", description: "Os campos principais do fluxo de transporte entram no modelo da tela sem trabalho extra." },
        { title: "Expedidor e recebedor", description: "A pagina ja reserva o espaco para os atores adicionais do conhecimento de transporte." },
        { title: "Veiculo e motorista", description: "Os dados operacionais ficam preparados para validar a carga e o percurso." },
        { title: "Valores e percurso", description: "O resumo fiscal do frete pode evoluir com o backend sem mudar a estrutura base." },
      ]}
      highlights={[
        { title: "Vinculos", description: "CT-e pode apontar para NF-e entrada e saida quando o fluxo de relacao estiver conectado." },
        { title: "Auditoria", description: "Os logs ficam prontos para registrar importacao, emissao e consulta." },
        { title: "Fluxo futuro", description: "A lista operacional definitiva entra por cima dessa base sem quebra visual." },
      ]}
    />
  );
}
