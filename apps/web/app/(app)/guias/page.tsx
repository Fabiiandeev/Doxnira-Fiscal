import { BookOpen } from "lucide-react";

import { FiscalModuleView } from "@/components/fiscal/fiscal-module-view";

export const metadata = { title: "Guias" };

export default function GuiasPage() {
  return (
    <FiscalModuleView
      eyebrow="Obrigacoes e pagamentos"
      title="Guias"
      description="Central de DAS, DARF, GNRE, DARE, GARE, ISS, ICMS, PIS e COFINS com base pronta para vinculo financeiro."
      icon={BookOpen}
      statusLabel="Estrutura base"
      statusVariant="warning"
      primaryAction={{ label: "Abrir fechamento", href: "/monthly-closing" }}
      secondaryAction={{ label: "Solicitacoes", href: "/accountant/requests", variant: "outline" }}
      metrics={[
        { label: "Tipos", value: "9" },
        { label: "Vencimento", value: "Preparado" },
        { label: "PIX / codigo", value: "Base" },
        { label: "Anexos", value: "Reservados" },
      ]}
      checklist={[
        { title: "Tipos fiscais", description: "A estrutura considera os principais tipos de guia e obrigações recorrentes." },
        { title: "Baixa financeira", description: "O vinculo com contas a pagar e conciliacao bancaria entra sem refatorar a pagina." },
        { title: "Historico", description: "Cada guia pode carregar anexos, observacoes e eventos de baixa." },
        { title: "Vencimento e valor", description: "Campos essenciais ficam preparados para a automacao futura." },
      ]}
      highlights={[
        { title: "Integração contábil", description: "Guias podem conversar com o fluxo financeiro e com o fechamento mensal." },
        { title: "Transparente", description: "A tela nao finge que a emissao real ja esta pronta sem o backend." },
        { title: "Estrutura limpa", description: "A base segue o padrao visual global ja adotado pelo sistema." },
      ]}
    />
  );
}
