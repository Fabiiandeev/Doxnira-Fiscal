import { ApiError } from "@/lib/api";
import type {
  BillingCycle,
  SubscriptionContext,
  SubscriptionPlan,
  UsageItem,
} from "@/lib/services/subscription-service";

const FEATURE_NAMES: Record<string, string> = {
  "documents.monthly.limit": "Documentos fiscais por mês",
  "nfe.monthly.limit": "NF-e por mês",
  "nfse.monthly.limit": "NFS-e por mês",
  "users.limit": "Usuários",
  "companies.limit": "Empresas",
  "branches.limit": "Filiais",
  "xml.retention.months": "Retenção de XML",
  "api.requests.monthly.limit": "Requisições de API por mês",
  "webhook.endpoints.limit": "Endpoints de webhook",
  "nfe.emission": "Emissão de NF-e",
  "nfse.emission": "Emissão de NFS-e",
  "nfe.inbound": "NF-e recebidas",
  "cte.inbound": "CT-e recebidos",
  "dfe.sync": "Sincronização de documentos fiscais",
  "fiscal_ai.basic": "FiscalAI básico",
  "fiscal_ai.correction": "Correção com FiscalAI",
  "fiscal_ai.batch_correction": "Correção em lote com FiscalAI",
  "webhooks.access": "Acesso a webhooks",
  "erp.integration": "Integração com ERP",
  "batch.actions": "Ações em lote",
  "exports.advanced": "Exportações avançadas",
  "portal.accounting": "Portal contábil",
  "support.priority": "Suporte prioritário",
  "api.access": "Acesso à API",
};

export type PlanAction = "CURRENT" | "UPGRADE" | "DOWNGRADE" | "CYCLE" | "UNAVAILABLE";

export function formatMoney(amountCents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export function formatCycle(cycle: BillingCycle) {
  return cycle === "MONTHLY" ? "Mensal" : "Anual";
}

export function featureName(code: string) {
  if (FEATURE_NAMES[code]) return FEATURE_NAMES[code];
  return code
    .replace(/\.limit$/, "")
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function statusPresentation(status: string, cancelAtPeriodEnd = false) {
  if (cancelAtPeriodEnd) {
    return { label: "Cancelamento programado", tone: "warning" as const };
  }
  const values = {
    ACTIVE: { label: "Ativo", tone: "success" as const },
    TRIALING: { label: "Período de teste", tone: "info" as const },
    CANCELED: { label: "Cancelado", tone: "danger" as const },
    EXPIRED: { label: "Expirado", tone: "danger" as const },
    PAST_DUE: { label: "Pagamento pendente", tone: "warning" as const },
    SUSPENDED: { label: "Suspenso", tone: "warning" as const },
  };
  return values[status as keyof typeof values] ?? { label: "Indisponível", tone: "neutral" as const };
}

export function planAction(
  plan: SubscriptionPlan,
  cycle: BillingCycle,
  context: SubscriptionContext | undefined,
): PlanAction {
  const price = plan.prices.find((item) => item.billingCycle === cycle);
  if (!price) return "UNAVAILABLE";
  if (!context?.subscription || !context.plan) return "UNAVAILABLE";
  if (plan.code === context.plan.code && cycle === context.subscription.billingCycle) return "CURRENT";
  if (plan.code === context.plan.code) {
    return context.capabilities.canChangeCycle ? "CYCLE" : "UNAVAILABLE";
  }
  if (plan.displayOrder > context.plan.displayOrder) {
    return context.capabilities.canUpgrade ? "UPGRADE" : "UNAVAILABLE";
  }
  return context.capabilities.canDowngrade ? "DOWNGRADE" : "UNAVAILABLE";
}

export function planActionCopy(action: PlanAction) {
  return {
    CURRENT: "Plano atual",
    UPGRADE: "Fazer upgrade",
    DOWNGRADE: "Agendar downgrade",
    CYCLE: "Alterar ciclo",
    UNAVAILABLE: "Indisponível",
  }[action];
}

export function annualSavings(plan: SubscriptionPlan) {
  const monthly = plan.prices.find((item) => item.billingCycle === "MONTHLY");
  const annual = plan.prices.find((item) => item.billingCycle === "ANNUAL");
  if (!monthly || !annual) return 0;
  return Math.max(0, monthly.amountCents * 12 - annual.amountCents);
}

export function usagePresentation(item: UsageItem) {
  if (item.unlimited || item.limit === null) {
    return { percentage: 0, label: "Ilimitado", tone: "normal" as const };
  }
  if (item.limit <= 0) {
    return { percentage: 100, label: "Indisponível no plano", tone: "blocked" as const };
  }
  const percentage = Math.min(100, Math.round((item.used / item.limit) * 100));
  if (percentage >= 100) return { percentage, label: "Limite atingido", tone: "limit" as const };
  if (percentage >= 90) return { percentage, label: "Próximo do limite", tone: "near" as const };
  if (percentage >= 70) return { percentage, label: "Atenção ao consumo", tone: "attention" as const };
  return { percentage, label: "Dentro do limite", tone: "normal" as const };
}

export function isEnabledFeature(value: boolean | number | string | null) {
  return value === true || (typeof value === "number" && value > 0) || (typeof value === "string" && value.length > 0);
}

export function errorPresentation(error: unknown) {
  if (!(error instanceof ApiError)) {
    return {
      title: "Não foi possível concluir",
      message: "Verifique sua conexão e tente novamente.",
      requestId: null,
    };
  }
  const details = (error.details && typeof error.details === "object" ? error.details : {}) as Record<string, unknown>;
  const messages: Record<string, { title: string; message: string }> = {
    SUBSCRIPTION_FEATURE_NOT_AVAILABLE: {
      title: "Recurso não disponível",
      message: `O recurso ${featureName(String(details.featureCode ?? "solicitado"))} não está disponível no plano atual. Compare os planos para liberar o acesso.`,
    },
    SUBSCRIPTION_USAGE_LIMIT_EXCEEDED: {
      title: "Limite de uso atingido",
      message: `Você utilizou ${String(details.used ?? "todo o limite")} de ${String(details.limit ?? "recursos disponíveis")} neste período. Compare os planos para continuar.`,
    },
    SUBSCRIPTION_IDEMPOTENCY_CONFLICT: {
      title: "Operação já utilizada",
      message: "Esta confirmação pertence a outra alteração. Feche o diálogo e inicie a ação novamente.",
    },
    SUBSCRIPTION_CONCURRENT_MODIFICATION: {
      title: "Assinatura atualizada em outra sessão",
      message: "Atualize os dados antes de tentar novamente.",
    },
    SUBSCRIPTION_PLAN_NOT_FOUND: {
      title: "Plano não encontrado",
      message: "O plano selecionado não está mais disponível. Atualize o catálogo.",
    },
    SUBSCRIPTION_PROVIDER_CONFIGURATION_ERROR: {
      title: "Serviço temporariamente indisponível",
      message: "A configuração comercial não está disponível agora. Tente novamente em alguns instantes.",
    },
    COMPANY_CONTEXT_REQUIRED: {
      title: "Selecione uma empresa",
      message: "Escolha uma empresa para consultar planos, assinatura e uso.",
    },
    COMPANY_ACCESS_DENIED: {
      title: "Acesso negado",
      message: "Você não possui acesso à empresa selecionada.",
    },
  };
  const mapped = messages[error.code];
  if (mapped) return { ...mapped, requestId: error.requestId ?? null };
  if (error.status === 400) return { title: "Revise os dados informados", message: error.message, requestId: error.requestId ?? null };
  if (error.status === 401) return { title: "Sessão expirada", message: "Entre novamente para continuar.", requestId: error.requestId ?? null };
  if (error.status === 403) return { title: "Acesso negado", message: error.message, requestId: error.requestId ?? null };
  if (error.status === 409) return { title: "Não foi possível aplicar a alteração", message: error.message, requestId: error.requestId ?? null };
  if (error.status === 503) return { title: "Serviço temporariamente indisponível", message: "Tente novamente em alguns instantes.", requestId: error.requestId ?? null };
  return { title: "Não foi possível concluir", message: error.message, requestId: error.requestId ?? null };
}
