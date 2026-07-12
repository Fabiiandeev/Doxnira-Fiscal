import { BarChart3 } from "lucide-react";

import { FiscalModuleView } from "@/components/fiscal/fiscal-module-view";

export const metadata = { title: "SINTEGRA" };

export default function SintegraPage() {
  return (
    <FiscalModuleView
      eyebrow="Integracao estadual"
      title="SINTEGRA"
      description="Base inicial para registros, validacao e historico de arquivos SINTEGRA, pronta para conversa com o cadastro e o fechamento."
      icon={BarChart3}
      statusLabel="Estrutura base"
      statusVariant="warning"
      primaryAction={{ label: "Ver empresas", href: "/companies" }}
      secondaryAction={{ label: "Abrir hub fiscal", href: "/fiscal", variant: "outline" }}
      metrics={[
        { label: "Registros", value: "Basicos" },
        { label: "Validacao", value: "Preparada" },
        { label: "Historico", value: "Base pronta" },
        { label: "Exportacao", value: "Reservada" },
      ]}
      checklist={[
        { title: "Registros basicos", description: "A pagina reserva os registros principais para a geracao futura do arquivo estadual." },
        { title: "Validacao", description: "As regras de consistencia podem ser ligadas ao cadastro da empresa e ao motor de impostos." },
        { title: "Historico", description: "Cada arquivo gerado vai poder ser auditado sem mudar a estrutura da rota." },
        { title: "Conciliacao", description: "A saida pode dialogar com fechamento fiscal e com o financeiro sem reescrever a tela." },
      ]}
      highlights={[
        { title: "Conexao fiscal", description: "SINTEGRA fica pronto para a capa de integracao estadual." },
        { title: "Sem botao morto", description: "A tela explica que a geracao real entra quando o backend estiver conectado." },
        { title: "Base limpo", description: "A estrutura nao quebra o menu atual e nao altera o padrao visual." },
      ]}
    />
  );
}
