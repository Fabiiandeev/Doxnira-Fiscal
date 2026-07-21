import { afterEach, describe, expect, it, vi } from "vitest";

import {
  annualSavings,
  errorPresentation,
  formatCycle,
  formatDate,
  formatMoney,
  planAction,
  statusPresentation,
  usagePresentation,
} from "@/components/subscription/subscription-ui";
import { ApiError, primeSession } from "@/lib/api";
import { subscriptionService, unwrapSubscriptionResponse } from "@/lib/services/subscription-service";
import type { SubscriptionContext, SubscriptionPlan, UsageItem } from "@/lib/services/subscription-service";

const plan: SubscriptionPlan = {
  id: "business",
  code: "BUSINESS",
  name: "Business + Portal Contábil",
  description: null,
  displayOrder: 3,
  features: {},
  prices: [
    { id: "monthly", billingCycle: "MONTHLY", amountCents: 19990, currency: "BRL", discountPercentage: null },
    { id: "annual", billingCycle: "ANNUAL", amountCents: 199920, currency: "BRL", discountPercentage: 16 },
  ],
};

const context = {
  subscription: { billingCycle: "MONTHLY" },
  plan: { code: "PROFESSIONAL", displayOrder: 2 },
  capabilities: { canUpgrade: true, canDowngrade: true, canChangeCycle: true },
} as SubscriptionContext;

describe("apresentação da assinatura", () => {
  it("formata moeda, data, ciclo e status para pt-BR", () => {
    expect(formatMoney(4990)).toBe("R$ 49,90");
    expect(formatDate("2026-07-21T00:00:00.000Z")).toBe("21/07/2026");
    expect(formatCycle("ANNUAL")).toBe("Anual");
    expect(statusPresentation("TRIALING").label).toBe("Período de teste");
    expect(statusPresentation("ACTIVE", true).label).toBe("Cancelamento programado");
  });

  it("classifica upgrade, downgrade, ciclo e plano atual", () => {
    expect(planAction(plan, "MONTHLY", context)).toBe("UPGRADE");
    expect(planAction({ ...plan, code: "STARTER", displayOrder: 1 }, "MONTHLY", context)).toBe("DOWNGRADE");
    expect(planAction({ ...plan, code: "PROFESSIONAL", displayOrder: 2 }, "ANNUAL", context)).toBe("CYCLE");
    expect(planAction({ ...plan, code: "PROFESSIONAL", displayOrder: 2 }, "MONTHLY", context)).toBe("CURRENT");
  });

  it("calcula economia anual somente com preços do catálogo", () => {
    expect(annualSavings(plan)).toBe(39960);
  });

  it.each([
    [69, "Dentro do limite"],
    [70, "Atenção ao consumo"],
    [90, "Próximo do limite"],
    [100, "Limite atingido"],
  ])("classifica %s%% de uso como %s", (used, label) => {
    const item = { used, limit: 100, unlimited: false } as UsageItem;
    expect(usagePresentation(item).label).toBe(label);
  });

  it("representa ilimitado sem números artificiais", () => {
    expect(usagePresentation({ unlimited: true, limit: null } as UsageItem).label).toBe("Ilimitado");
  });

  it.each([
    ["SUBSCRIPTION_FEATURE_NOT_AVAILABLE", "Recurso não disponível"],
    ["SUBSCRIPTION_USAGE_LIMIT_EXCEEDED", "Limite de uso atingido"],
    ["SUBSCRIPTION_IDEMPOTENCY_CONFLICT", "Operação já utilizada"],
    ["SUBSCRIPTION_CONCURRENT_MODIFICATION", "Assinatura atualizada em outra sessão"],
    ["SUBSCRIPTION_PLAN_NOT_FOUND", "Plano não encontrado"],
    ["SUBSCRIPTION_PROVIDER_CONFIGURATION_ERROR", "Serviço temporariamente indisponível"],
  ])("traduz o erro %s", (code, title) => {
    expect(errorPresentation(new ApiError("erro", code, code.includes("NOT_AVAILABLE") ? 403 : 409)).title).toBe(title);
  });
});

describe("integração HTTP da assinatura", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    primeSession({ token: null, companyId: null, user: null });
  });

  it("chama catalog, current e usage no prefixo oficial com autenticação e contexto", async () => {
    const emptyContext = {
      subscription: null,
      plan: null,
      price: null,
      nextPlan: null,
      entitlements: {},
      usage: {},
      capabilities: { canUpgrade: false, canDowngrade: false, canChangeCycle: false, canCancel: false, canReactivate: false },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ plans: [plan, plan, plan, plan] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: emptyContext }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    primeSession({ token: "signed-test-token", companyId: "00000000-0000-4000-8000-000000000001" });

    const [catalog, current, usage] = await Promise.all([
      subscriptionService.catalog(),
      subscriptionService.current(),
      subscriptionService.usage(),
    ]);

    expect(catalog.plans).toHaveLength(4);
    expect(current.subscription).toBeNull();
    expect(usage.items).toEqual([]);
    expect(fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/api/, "/api"))).toEqual([
      "/api/subscription/catalog",
      "/api/subscription/current",
      "/api/subscription/usage",
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      const headers = new Headers(init.headers);
      expect(headers.get("authorization")).toBe("Bearer signed-test-token");
      expect(headers.get("x-company-id")).toBe("00000000-0000-4000-8000-000000000001");
    }
  });

  it("interpreta payload envelopado em data em uma única camada", () => {
    expect(unwrapSubscriptionResponse({ data: { items: [] } })).toEqual({ items: [] });
    expect(unwrapSubscriptionResponse({ items: [] })).toEqual({ items: [] });
  });
});
