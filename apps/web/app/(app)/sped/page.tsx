import { FileBarChart } from "lucide-react";

import { FiscalModuleView } from "@/components/fiscal/fiscal-module-view";

export const metadata = { title: "SPED" };

export default function SpedPage() {
  return (
    <FiscalModuleView
      eyebrow="Obrigacoes acessorias"
      title="SPED"
      description="Estrutura inicial para EFD ICMS/IPI e EFD Contribuicoes, com validação de pendencias e geração preparada para uso futuro."
      icon={FileBarChart}
      statusLabel="Estrutura base"
      statusVariant="warning"
      primaryAction={{ label: "Ver fechamento fiscal", href: "/fechamento-fiscal" }}
      secondaryAction={{ label: "Abrir XML Fiscal", href: "/xml-fiscal", variant: "outline" }}
      metrics={[
        { label: "EFD ICMS/IPI", value: "Base" },
        { label: "EFD Contribuicoes", value: "Base" },
        { label: "Validacao", value: "Preparada" },
        { label: "Arquivo", value: "Mock / preparado" },
      ]}
      checklist={[
        { title: "Blocos basicos", description: "O motor inicial recebe os blocos essenciais sem exigir implementacao final neste sprint." },
        { title: "Pendencias", description: "As validacoes futuras vao alimentar a tela com faltas e alertas por periodo." },
        { title: "Historico", description: "Arquivos gerados podem ser versionados e auditados em outra camada." },
        { title: "Exportacao", description: "A geracao de arquivo mock ou preparado fica reservada para a integracao real." },
      ]}
      highlights={[
        { title: "Evolucao segura", description: "A estrutura nao promete entrega falsa e pode receber gerador real depois." },
        { title: "Base fiscal", description: "SPED conversa com fechamento e validacao sem duplicar regra de negocio." },
        { title: "Preparado para banco", description: "A camada de persistencia pode entrar sem remodelar a rota." },
      ]}
    />
  );
}
