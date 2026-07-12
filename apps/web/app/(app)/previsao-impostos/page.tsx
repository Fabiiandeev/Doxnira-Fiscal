import { CircleDollarSign } from "lucide-react";

import { FiscalModuleView } from "@/components/fiscal/fiscal-module-view";

export const metadata = { title: "Previsao de Impostos" };

export default function PrevisaoImpostosPage() {
  return (
    <FiscalModuleView
      eyebrow="Gestao tributaria"
      title="Previsao de Impostos"
      description="Visao gerencial para ICMS, IPI, PIS, COFINS, ISS, DAS, IRPJ, CSLL e INSS, com simulacao e comparacao mensal."
      icon={CircleDollarSign}
      statusLabel="Pronto"
      statusVariant="success"
      primaryAction={{ label: "Abrir fechamento fiscal", href: "/fechamento-fiscal" }}
      secondaryAction={{ label: "Ver SPED", href: "/sped", variant: "outline" }}
      metrics={[
        { label: "ICMS", value: "Projecao" },
        { label: "IPI", value: "Projecao" },
        { label: "PIS / COFINS", value: "Consolidado" },
        { label: "ISS / DAS", value: "Comparado" },
      ]}
      checklist={[
        { title: "Simulacao", description: "O fluxo pode projetar o resultado atual e o cenario de faturamento sem refazer a rota." },
        { title: "Comparacao mensal", description: "A analise de mes contra mes encaixa na base sem interferir nos outros modulos." },
        { title: "Consolidacao de documentos", description: "NF-e, NFC-e, NFS-e e CT-e podem alimentar a previsao conforme o backend evoluir." },
        { title: "Cenario atual", description: "A tela ja fica preparada para destacar o valor esperado e o valor realizado." },
      ]}
      highlights={[
        { title: "Painel gerencial", description: "A pagina nao e apenas um cartao simples; ela ja organiza a visao tributaria para o usuario final." },
        { title: "Integracao fiscal", description: "Os dados podem vir do fechamento mensal e do motor de calculo compartilhado." },
        { title: "Base futura", description: "Quando a simulacao ganhar backend, a estrutura de rota continua valendo." },
      ]}
    />
  );
}
