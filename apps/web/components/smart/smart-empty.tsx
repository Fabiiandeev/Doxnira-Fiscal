import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SmartEmpty({
  title = "Nenhum dado encontrado.",
  description = "Cadastre, importe ou sincronize informações para gerar análise.",
  actions,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-8 text-center", className)}>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-subtle">
        <Inbox className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-extrabold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-subtle">{description}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </Card>
  );
}

export function SmartEmptyActions({
  onCreate,
  onImportXml,
  onSync,
  onConnectMarketplace,
  onDiagnostic,
}: {
  onCreate?: () => void;
  onImportXml?: () => void;
  onSync?: () => void;
  onConnectMarketplace?: () => void;
  onDiagnostic?: () => void;
}) {
  return (
    <>
      {onCreate && (
        <Button variant="lime" onClick={onCreate}>
          Cadastrar
        </Button>
      )}
      {onImportXml && (
        <Button variant="outline" onClick={onImportXml}>
          Importar XML
        </Button>
      )}
      {onSync && (
        <Button variant="outline" onClick={onSync}>
          Sincronizar
        </Button>
      )}
      {onConnectMarketplace && (
        <Button variant="outline" onClick={onConnectMarketplace}>
          Conectar marketplace
        </Button>
      )}
      {onDiagnostic && (
        <Button variant="outline" onClick={onDiagnostic}>
          Executar diagnóstico
        </Button>
      )}
    </>
  );
}
