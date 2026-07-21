import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SubscriptionView } from "@/components/subscription/subscription-view";
import { ApiError } from "@/lib/api";
import type { SubscriptionContext, SubscriptionPlan, UsageItem } from "@/lib/services/subscription-service";

const mocks = vi.hoisted(() => ({
  current: { data: undefined as SubscriptionContext | undefined, isLoading: false, error: null as unknown, refetch: vi.fn() },
  catalog: { data: undefined as { plans: SubscriptionPlan[] } | undefined, isLoading: false, error: null as unknown, refetch: vi.fn() },
  usage: { data: undefined as { items: UsageItem[] } | undefined, isLoading: false, error: null as unknown, refetch: vi.fn() },
  change: { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown },
  cancel: { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown },
  reactivate: { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown },
}));

vi.mock("@/lib/services/subscription-hooks", () => ({
  useSubscription: () => mocks.current,
  useSubscriptionCatalog: () => mocks.catalog,
  useSubscriptionUsage: () => mocks.usage,
  useSubscriptionActions: () => ({ change: mocks.change, cancel: mocks.cancel, reactivate: mocks.reactivate }),
  createSubscriptionIdempotencyKey: (operation: string) => `subscription-ui:${operation}:00000000-0000-4000-8000-000000000000`,
}));

vi.mock("@/components/providers/company-provider", () => ({
  useCompanyContext: () => ({
    activeCompanyId: "company-id",
    activeCompany: { id: "company-id" },
    isLoading: false,
    isSuccess: true,
  }),
}));

const price = (id: string, billingCycle: "MONTHLY" | "ANNUAL", amountCents: number) => ({ id, billingCycle, amountCents, currency: "BRL", discountPercentage: null });
const plans: SubscriptionPlan[] = [
  { id: "starter", code: "STARTER", name: "Starter + Portal Contábil", description: "Para começar", displayOrder: 1, features: { "documents.monthly.limit": 100, "api.access": false }, prices: [price("s-m", "MONTHLY", 4990), price("s-a", "ANNUAL", 49920)] },
  { id: "professional", code: "PROFESSIONAL", name: "Professional + Portal Contábil", description: "Para crescer", displayOrder: 2, features: { "documents.monthly.limit": 500, "api.access": true }, prices: [price("p-m", "MONTHLY", 9990), price("p-a", "ANNUAL", 99920)] },
  { id: "business", code: "BUSINESS", name: "Business + Portal Contábil", description: "Mais automação", displayOrder: 3, features: { "documents.monthly.limit": 1000, "api.access": true }, prices: [price("b-m", "MONTHLY", 19990), price("b-a", "ANNUAL", 199920)] },
  { id: "company", code: "COMPANY", name: "Empresa + Portal Contábil", description: "Operação avançada", displayOrder: 4, features: { "documents.monthly.limit": 5000, "api.access": true }, prices: [price("c-m", "MONTHLY", 39990), price("c-a", "ANNUAL", 399920)] },
];

const context: SubscriptionContext = {
  subscription: { id: "sub", status: "ACTIVE", provider: "MANUAL", billingCycle: "MONTHLY", currentPeriodStart: "2026-07-01T00:00:00.000Z", currentPeriodEnd: "2026-08-01T00:00:00.000Z", trialEndsAt: null, cancelAtPeriodEnd: false, canceledAt: null, endedAt: null, nextPlanEffectiveAt: null },
  plan: { id: "professional", code: "PROFESSIONAL", name: "Professional + Portal Contábil", displayOrder: 2 },
  price: { billingCycle: "MONTHLY", amountCents: 9990, currency: "BRL" },
  nextPlan: null,
  entitlements: { "documents.monthly.limit": 500, "api.access": true },
  usage: { "documents.monthly.limit": 95 },
  capabilities: { canUpgrade: true, canDowngrade: true, canChangeCycle: true, canCancel: true, canReactivate: false },
};

const usageItems: UsageItem[] = [
  { featureCode: "documents.monthly.limit", featureName: "documents.monthly.limit", limit: 100, used: 95, remaining: 5, unlimited: false, periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z" },
  { featureCode: "api.calls.limit", featureName: "api.calls.limit", limit: null, used: 20, remaining: null, unlimited: true, periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z" },
];

function setReady(current = context) {
  Object.assign(mocks.current, { data: current, isLoading: false, error: null });
  Object.assign(mocks.catalog, { data: { plans }, isLoading: false, error: null });
  Object.assign(mocks.usage, { data: { items: usageItems }, isLoading: false, error: null });
}

beforeEach(() => {
  setReady();
  for (const query of [mocks.current, mocks.catalog, mocks.usage]) query.refetch.mockReset();
  for (const mutation of [mocks.change, mocks.cancel, mocks.reactivate]) Object.assign(mutation, { isPending: false, error: null });
});

afterEach(cleanup);

describe("página de assinatura", () => {
  it("renderiza plano, catálogo, BRL, consumo e ilimitado", () => {
    render(<SubscriptionView />);
    expect(screen.getByRole("heading", { name: "Assinatura e plano" })).toBeInTheDocument();
    expect(screen.getAllByText("Professional + Portal Contábil").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*99,90/).length).toBeGreaterThan(0);
    expect(screen.getByText("Próximo do limite")).toBeInTheDocument();
    expect(screen.getByText("Ilimitado")).toBeInTheDocument();
    expect(screen.getByText("Empresa + Portal Contábil")).toBeInTheDocument();
  });

  it("alterna preços mensais e anuais", async () => {
    render(<SubscriptionView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Anual" })[0]);
    expect(screen.getAllByText(/R\$\s*1\.999,20/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Economize/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Alterar ciclo" })).toBeInTheDocument();
  });

  it("abre upgrade e envia somente plano, ciclo e chave idempotente", async () => {
    render(<SubscriptionView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Fazer upgrade" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Confirmar upgrade" });
    expect(dialog).toHaveTextContent("Nenhuma cobrança será realizada automaticamente nesta etapa");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar upgrade" }));
    const payload = mocks.change.mutate.mock.calls[0][0];
    expect(payload).toMatchObject({ targetPlanCode: "BUSINESS", targetBillingCycle: "MONTHLY" });
    expect(payload.idempotencyKey).toMatch(/^subscription-ui:change-business-monthly:/);
    expect(payload).not.toHaveProperty("companyId");
    expect(payload).not.toHaveProperty("amountCents");
  });

  it("agenda downgrade sem substituir o plano atual", async () => {
    render(<SubscriptionView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Agendar downgrade" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Agendar downgrade" });
    expect(within(dialog).getByText(/01\/08\/2026/)).toBeInTheDocument();
    expect(screen.getAllByText("Professional + Portal Contábil").length).toBeGreaterThan(0);
  });

  it("exige confirmação adicional no cancelamento imediato", async () => {
    render(<SubscriptionView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Cancelar assinatura" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Cancelar assinatura" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /Cancelar imediatamente/ }));
    const submit = within(dialog).getByRole("button", { name: "Cancelar imediatamente" });
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Digite CANCELAR para confirmar"), "CANCELAR");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(mocks.cancel.mutate.mock.calls[0][0]).toMatchObject({ mode: "IMMEDIATE", idempotencyKey: expect.stringMatching(/^subscription-ui:cancel-immediate:/) });
  });

  it("mostra banners e permite reativar quando autorizado", async () => {
    setReady({ ...context, subscription: { ...context.subscription!, status: "TRIALING", trialEndsAt: "2026-07-28T00:00:00.000Z", cancelAtPeriodEnd: true }, nextPlan: { id: "starter", code: "STARTER", name: "Starter + Portal Contábil", billingCycle: "MONTHLY", amountCents: 4990, effectiveAt: "2026-08-01T00:00:00.000Z" }, capabilities: { ...context.capabilities, canReactivate: true } });
    render(<SubscriptionView />);
    expect(screen.getByText(/Seu período de teste termina/)).toBeInTheDocument();
    expect(screen.getByText(/Seu plano será alterado/)).toBeInTheDocument();
    expect(screen.getByText(/Sua assinatura será encerrada/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Manter assinatura" })[0]);
    await userEvent.click(within(screen.getByRole("dialog", { name: "Manter assinatura" })).getByRole("button", { name: "Manter assinatura" }));
    expect(mocks.reactivate.mutate.mock.calls[0][0].idempotencyKey).toMatch(/^subscription-ui:reactivate:/);
  });

  it("renderiza loading, ausência e erro com retry", () => {
    Object.assign(mocks.current, { isLoading: true });
    const { rerender } = render(<SubscriptionView />);
    expect(screen.getByLabelText("Carregando plano atual")).toBeInTheDocument();
    setReady({ ...context, subscription: null, plan: null, price: null, capabilities: { canUpgrade: false, canDowngrade: false, canChangeCycle: false, canCancel: false, canReactivate: false } });
    rerender(<SubscriptionView />);
    expect(screen.getByText("Sua empresa ainda não possui uma assinatura")).toBeInTheDocument();
    Object.assign(mocks.current, { error: new ApiError("Falha", "API_ERROR", 500, [], null, null, null, null, "req-123") });
    rerender(<SubscriptionView />);
    expect(screen.getByText("Identificador da solicitação: req-123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(mocks.current.refetch).toHaveBeenCalled();
  });

  it("mantém plano e catálogo quando usage falha", () => {
    Object.assign(mocks.usage, { data: undefined, error: new ApiError("Falha de uso", "INTERNAL_ERROR", 500, {}, null, null, null, null, "usage-500") });
    render(<SubscriptionView />);
    expect(screen.getAllByText("Professional + Portal Contábil").length).toBeGreaterThan(0);
    expect(screen.getByText("Não foi possível carregar o uso no período")).toBeInTheDocument();
    expect(screen.getByText("Empresa + Portal Contábil")).toBeInTheDocument();
  });

  it("mantém plano atual quando o catálogo falha", () => {
    Object.assign(mocks.catalog, { data: undefined, error: new ApiError("Catálogo indisponível", "INTERNAL_ERROR", 500) });
    render(<SubscriptionView />);
    expect(screen.getByRole("heading", { name: "Professional + Portal Contábil" })).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar o catálogo de planos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uso no período atual" })).toBeInTheDocument();
  });

  it("mantém catálogo e usage quando current falha", () => {
    Object.assign(mocks.current, { data: undefined, error: new ApiError("Current falhou", "INTERNAL_ERROR", 500) });
    render(<SubscriptionView />);
    expect(screen.getByText("Não foi possível carregar sua assinatura")).toBeInTheDocument();
    expect(screen.getByText("Empresa + Portal Contábil")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uso no período atual" })).toBeInTheDocument();
  });

  it("retry executa refetch real das três queries", async () => {
    Object.assign(mocks.usage, { data: undefined, error: new ApiError("Falha de uso", "INTERNAL_ERROR", 500) });
    render(<SubscriptionView />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(mocks.current.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.catalog.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.usage.refetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, "AUTH_REQUIRED", "Sessão expirada"],
    [403, "COMPANY_ACCESS_DENIED", "Acesso negado"],
  ])("traduz erro HTTP %s no bloco afetado", (status, code, title) => {
    Object.assign(mocks.current, { data: undefined, error: new ApiError("Falha", code, status) });
    render(<SubscriptionView />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("mantém erro no diálogo e bloqueia clique duplicado", async () => {
    Object.assign(mocks.change, { error: new ApiError("Conflito", "SUBSCRIPTION_CONCURRENT_MODIFICATION", 409), isPending: true });
    render(<SubscriptionView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Fazer upgrade" })[0]);
    expect(screen.getByText("Assinatura atualizada em outra sessão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Processando/ })).toBeDisabled();
  });
});
