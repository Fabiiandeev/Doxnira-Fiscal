import { ReceiptText } from "lucide-react";

import { FiscalModuleView } from "@/components/fiscal/fiscal-module-view";

export const metadata = { title: "NFC-e" };

export default function NfcePage() {
  return (
    <FiscalModuleView
      eyebrow="Modelo 65"
      title="NFC-e"
      description="Estrutura base para emissao rapida no varejo, com consumidor final, indPres, pagamento obrigatorio, QR Code e contingencia."
      icon={ReceiptText}
      statusLabel="Estrutura base"
      statusVariant="warning"
      primaryAction={{ label: "Voltar ao hub", href: "/fiscal", variant: "outline" }}
      secondaryAction={{ label: "Ver XML Fiscal", href: "/xml-fiscal", variant: "outline" }}
      metrics={[
        { label: "Consumidor final", value: "Obrigatorio" },
        { label: "indPres", value: "Preparado" },
        { label: "Pagamento", value: "Obrigatorio" },
        { label: "QR Code", value: "Pronto" },
      ]}
      checklist={[
        { title: "Modelo 65", description: "A pagina ja esta separada para o fluxo NFC-e e pode receber o emissor dedicado nas proximas sprints." },
        { title: "CSC / token", description: "O identificador de seguranca fica reservado para a transmissao e consulta em homologacao e producao." },
        { title: "Contingencia", description: "O caminho de contingencia sera acoplado ao adapter SEFAZ quando o backend definitivo entrar." },
        { title: "Autorizacao mock", description: "O retorno autorizado fica preparado para integracao com DANFE NFC-e." },
      ]}
      highlights={[
        { title: "Emissao rapida", description: "Tela pronta para o wizard enxuto de venda no balcao." },
        { title: "Base segura", description: "Nenhum botao promete transmissao real sem o adapter correspondente." },
        { title: "Integracao futura", description: "O fluxo pode consumir cliente, produto e empresa ativa sem reestruturar a nave." },
      ]}
    />
  );
}
