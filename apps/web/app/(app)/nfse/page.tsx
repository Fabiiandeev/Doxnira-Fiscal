import { Signature } from "lucide-react";

import { FiscalModuleView } from "@/components/fiscal/fiscal-module-view";

export const metadata = { title: "NFS-e" };

export default function NfsePage() {
  return (
    <FiscalModuleView
      eyebrow="Provider factory"
      title="NFS-e"
      description="Base extensivel por provider e municipio, com a pagina preparada para Nacional, ABRASF, GINFES, Betha, IPM e DSF."
      icon={Signature}
      statusLabel="Arquitetura base"
      statusVariant="warning"
      primaryAction={{ label: "Abrir checklist nacional", href: "/nfse-national" }}
      secondaryAction={{ label: "Configurar empresas", href: "/companies", variant: "outline" }}
      metrics={[
        { label: "Providers", value: "6" },
        { label: "RPS / XML", value: "Pronto" },
        { label: "ISS", value: "Base fiscal" },
        { label: "PDF", value: "Preparado" },
      ]}
      checklist={[
        { title: "Factory por municipio", description: "A estrutura fica separada para o provider correto ser escolhido sem acoplar regra em tela." },
        { title: "ISS e retencoes", description: "Os campos fiscais principais ja tem espaco reservado para a camada de calculo." },
        { title: "Inscricao municipal", description: "A validacao futura pode usar o cadastro da empresa e o provider selecionado." },
        { title: "Retorno e cancelamento", description: "Os eventos de retorno, cancelamento e substituicao entram sem refatorar a base visual." },
      ]}
      highlights={[
        { title: "Nacional", description: "Conexao pronta com o checklist atual de adequacao NFS-e Nacional." },
        { title: "Escalavel", description: "Cada provider pode evoluir com seu proprio adapter sem quebrar a nave." },
        { title: "Transparente", description: "A tela deixa claro que a emissao real ainda depende do provider integrado." },
      ]}
    />
  );
}
