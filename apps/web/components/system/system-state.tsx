import {
  AlertTriangle,
  Ban,
  Clock3,
  Construction,
  FileQuestion,
  LockKeyhole,
  RefreshCw,
  ShieldOff,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SystemStateKind =
  | "error"
  | "not-found"
  | "unauthorized"
  | "forbidden"
  | "maintenance"
  | "offline"
  | "placeholder";

const systemStateCopy: Record<
  SystemStateKind,
  {
    title: string;
    description: string;
    status: string;
    icon: typeof AlertTriangle;
  }
> = {
  error: {
    title: "Algo saiu do fluxo esperado",
    description: "A tela encontrou um erro de execução. Tente recarregar ou volte ao dashboard.",
    status: "Erro",
    icon: AlertTriangle,
  },
  "not-found": {
    title: "Página em preparação",
    description: "Esta rota está registrada e será conectada ao módulo definitivo nas próximas sprints.",
    status: "Rota registrada",
    icon: FileQuestion,
  },
  unauthorized: {
    title: "Sessão necessária",
    description: "Entre novamente para acessar os dados da sua empresa.",
    status: "Não autorizado",
    icon: LockKeyhole,
  },
  forbidden: {
    title: "Acesso restrito",
    description: "Seu perfil não possui permissão para executar esta ação neste momento.",
    status: "Sem permissão",
    icon: ShieldOff,
  },
  maintenance: {
    title: "Módulo em manutenção",
    description: "A área está preservada enquanto a equipe prepara a próxima atualização.",
    status: "Manutenção",
    icon: Construction,
  },
  offline: {
    title: "Conexão indisponível",
    description: "Não foi possível confirmar a conexão. Verifique a rede e tente novamente.",
    status: "Offline",
    icon: WifiOff,
  },
  placeholder: {
    title: "Módulo em desenvolvimento",
    description: "A arquitetura desta área já está preparada para receber a implementação completa.",
    status: "Em desenvolvimento",
    icon: Clock3,
  },
};

export function SystemState({
  kind,
  title,
  description,
  status,
  action,
  className,
  children,
}: {
  kind: SystemStateKind;
  title?: string;
  description?: string;
  status?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const copy = systemStateCopy[kind];
  const Icon = copy.icon;

  return (
    <Card className={cn("mx-auto max-w-3xl p-8 text-center", className)}>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-ink">
        <Icon className="h-6 w-6" />
      </div>
      <Badge className="mt-5" variant={kind === "error" ? "danger" : "lime"}>
        {status ?? copy.status}
      </Badge>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">{title ?? copy.title}</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-subtle">
        {description ?? copy.description}
      </p>
      {children}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {action}
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </Card>
  );
}

export function RetryButton({ onRetry }: { onRetry?: () => void }) {
  return (
    <Button variant="lime" onClick={onRetry ?? (() => window.location.reload())}>
      <RefreshCw className="h-4 w-4" />
      Tentar novamente
    </Button>
  );
}

export function ForbiddenAction() {
  return (
    <Button asChild variant="lime">
      <Link href="/accountant/requests">
        <Ban className="h-4 w-4" />
        Solicitar acesso
      </Link>
    </Button>
  );
}
