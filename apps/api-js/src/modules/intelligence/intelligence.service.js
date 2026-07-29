import {
  readAuditActions, readCommerceFacts, readCompanies, readFiscalFacts, writeAuditAction,
} from "./intelligence.repository.js";

const money = (value) => Number(value || 0);
const sum = (items, getter) => items.reduce((total, item) => total + getter(item), 0);
const isRejected = (status) => /reject|rejeit|deneg/i.test(status || "");

export function calculateFiscalMetrics(facts) {
  const active = facts.documents.filter((item) => !item.isCancelled);
  const count = (predicate) => active.filter(predicate).length;
  return {
    active,
    metrics: {
      nfeIssued: count((d) => d.documentType === "NFE" && d.operationDirection === "OUTBOUND"),
      nfeInbound: count((d) => d.documentType === "NFE" && d.operationDirection === "INBOUND"),
      cte: count((d) => d.documentType === "CTE"),
      mdfe: count((d) => d.documentType === "MDFE"),
      rejections: count((d) => isRejected(d.status)) + facts.validationIssues,
      pending: facts.alerts + count((d) => d.isSummary),
      estimatedTax: sum(active, (d) => money(d.taxAmount)),
      revenue: sum(active.filter((d) => d.operationDirection === "OUTBOUND"), (d) => money(d.totalAmount)),
    },
  };
}

export async function fiscalIntelligence(companyId, query) {
  const facts = await readFiscalFacts(companyId, query);
  const { active, metrics } = calculateFiscalMetrics(facts);
  const rankingMap = new Map();
  for (const document of active.filter((d) => d.operationDirection === "INBOUND")) {
    const name = document.issuerName || "Fornecedor não identificado";
    rankingMap.set(name, (rankingMap.get(name) || 0) + money(document.totalAmount));
  }
  return {
    period: { from: facts.start, to: facts.end },
    metrics,
    certificate: facts.certificate,
    closing: facts.closing,
    risk: Math.min(100, metrics.rejections * 8 + metrics.pending * 2 + (!facts.certificate ? 25 : 0)),
    ranking: [...rankingMap].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    documents: facts.documents.slice(0, 50).map((item) => ({ ...item, totalAmount: money(item.totalAmount) })),
  };
}

export async function commerceIntelligence(companyId, query) {
  const facts = await readCommerceFacts(companyId, query);
  const cancelled = facts.orders.filter((o) => /cancel/i.test(o.status));
  const sales = sum(facts.orders, (o) => money(o.totalAmount));
  const freight = sum(facts.orders, (o) => money(o.freightAmount));
  const discounts = sum(facts.orders, (o) => money(o.discountAmount));
  const productCost = new Map(facts.products.map((p) => [p.code, money(p.costPrice)]));
  const costs = sum(facts.orders, (o) => sum(o.items, (i) => (productCost.get(i.sku) || 0) * i.quantity));
  const profit = sales - freight - discounts - costs;
  return {
    period: { from: facts.start, to: facts.end },
    metrics: {
      orders: facts.orders.length, listings: facts.listings.length, products: facts.products.length,
      connectedAccounts: facts.connections, sales, costs, freight, discounts, profit,
      margin: sales ? (profit / sales) * 100 : 0, cancellations: cancelled.length,
    },
    syncFailures: facts.failedSyncs,
    orders: facts.orders.slice(0, 50).map((o) => ({
      id: o.id, providerOrderId: o.providerOrderId, status: o.status,
      totalAmount: money(o.totalAmount), orderedAt: o.orderedAt,
    })),
    listings: facts.listings.map((l) => ({ ...l, price: money(l.price) })).slice(0, 50),
  };
}

export async function buildInsights(companyId, query) {
  const [fiscal, commerce, facts, actions] = await Promise.all([
    fiscalIntelligence(companyId, query),
    commerceIntelligence(companyId, query),
    readCommerceFacts(companyId, query),
    readAuditActions(companyId, "INTELLIGENCE_INSIGHT"),
  ]);
  const latest = new Map(actions.map((a) => [a.metadata?.insightKey, a]));
  const candidates = [
    fiscal.metrics.rejections > 0 && { key: "fiscal-rejections", type: "FISCAL_REJECTION", severity: "critical", title: "Rejeições fiscais exigem análise", count: fiscal.metrics.rejections, href: "/rejections" },
    fiscal.certificate && new Date(fiscal.certificate.validUntil) < new Date(Date.now() + 30 * 864e5) && { key: "certificate-expiry", type: "CERTIFICATE_EXPIRING", severity: "warning", title: "Certificado próximo do vencimento", count: 1, href: "/settings/certificate" },
    fiscal.closing?.status && !/closed|conclu/i.test(fiscal.closing.status) && { key: "closing-pending", type: "CLOSING_PENDING", severity: "warning", title: "Fechamento fiscal pendente", count: 1, href: "/monthly-closing" },
    facts.products.filter((p) => money(p.stock) <= 0).length > 0 && { key: "low-stock", type: "LOW_STOCK", severity: "warning", title: "Produtos sem estoque", count: facts.products.filter((p) => money(p.stock) <= 0).length, href: "/stock" },
    commerce.syncFailures > 0 && { key: "sync-failure", type: "SYNC_FAILURE", severity: "critical", title: "Sincronizações falhando", count: commerce.syncFailures, href: "/marketplaces/sync" },
  ].filter(Boolean);
  return candidates.map((item) => ({
    ...item,
    status: latest.get(item.key)?.action?.replace("INSIGHT_", "") || "OPEN",
    assignee: latest.get(item.key)?.metadata?.assignee || null,
    justification: latest.get(item.key)?.metadata?.justification || null,
  }));
}

export async function decisionCenter(companyId, query) {
  const [insights, actions] = await Promise.all([
    buildInsights(companyId, query),
    readAuditActions(companyId, "INTELLIGENCE_DECISION"),
  ]);
  return {
    data: insights.map((item, index) => ({
      ...item, priority: item.severity === "critical" ? "HIGH" : "MEDIUM",
      evidence: `${item.count} ocorrência(s) encontrada(s) nos dados da empresa.`,
      timeline: actions.filter((a) => a.metadata?.insightKey === item.key).map((a) => ({
        action: a.action, at: a.createdAt, justification: a.metadata?.justification || null,
      })),
      order: index + 1,
    })),
  };
}

export async function benchmark(companyId, query) {
  const current = await fiscalIntelligence(companyId, query);
  const from = new Date(current.period.from);
  const to = new Date(current.period.to);
  const duration = to.getTime() - from.getTime();
  const previous = await fiscalIntelligence(companyId, {
    from: new Date(from.getTime() - duration - 1).toISOString().slice(0, 10),
    to: new Date(from.getTime() - 1).toISOString().slice(0, 10),
  });
  const companies = await readCompanies([companyId]);
  const compare = (key) => ({
    current: current.metrics[key], previous: previous.metrics[key],
    variation: previous.metrics[key] ? ((current.metrics[key] - previous.metrics[key]) / previous.metrics[key]) * 100 : null,
  });
  return {
    company: companies[0] || null,
    sufficientData: current.documents.length > 0 || previous.documents.length > 0,
    metrics: {
      revenue: compare("revenue"), rejections: compare("rejections"),
      pending: compare("pending"), fiscalScore: {
        current: Math.max(0, 100 - current.risk), previous: Math.max(0, 100 - previous.risk),
        variation: previous.risk !== current.risk ? previous.risk - current.risk : 0,
      },
    },
  };
}

export function recordAction(input) {
  return writeAuditAction(input);
}
