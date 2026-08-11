export type CommerceModuleStatus = "AVAILABLE" | "BETA" | "PLANNED" | "FUTURE";

export type CommerceModuleDefinition = {
  code: string;
  title: string;
  summary: string;
  details: string[];
  status: CommerceModuleStatus;
};

export const COMMERCE_MODULE_STATUS: Record<CommerceModuleStatus, string> = {
  AVAILABLE: "Disponível",
  BETA: "Beta",
  PLANNED: "Integração planejada",
  FUTURE: "Disponibilidade futura",
};

export const COMMERCE_MODULES: readonly CommerceModuleDefinition[] = [
  {
    code: "dashboard",
    title: "Dashboard Commerce",
    summary: "Visão consolidada de vendas, estoque e financeiro dos marketplaces.",
    details: [
      "Indicadores por canal e por SKU",
      "Alertas de ruptura e sobre-estoque",
      "Resultado financeiro consolidado e projeções",
    ],
    status: "AVAILABLE",
  },
  {
    code: "products",
    title: "Produtos Marketplace",
    summary: "Cadastro central de produtos sincronizado entre marketplaces.",
    details: ["Padronização de título e descrição", "NCM/CEST vinculado ao fiscal", "Histórico de variação"],
    status: "AVAILABLE",
  },
  {
    code: "ads",
    title: "Anúncios",
    summary: "Acompanhamento de anúncios ativos e performance por canal.",
    details: ["Visibilidade de SKUs anunciados", "Custo por canal", "Status de publicação"],
    status: "BETA",
  },
  {
    code: "orders",
    title: "Pedidos",
    summary: "Centralização de pedidos e debates fiscais integrados.",
    details: ["Status de emissão e conciliação", "Detalhamento por marketplace", "Rastreio integrado"],
    status: "AVAILABLE",
  },
  {
    code: "pricing",
    title: "Preços",
    summary: "Definição de preços por canal e política comercial.",
    details: ["Regras por marketplace", "Histórico de alterações", "Simulação de impacto"],
    status: "AVAILABLE",
  },
  {
    code: "margins",
    title: "Margens",
    summary: "Margem real considerando custos, taxas e impostos.",
    details: ["Cálculo por canal", "Mapeamento de taxas", "Alertas de erosão de margem"],
    status: "BETA",
  },
  {
    code: "competition",
    title: "Concorrência",
    summary: "Monitoramento competitivo por palavra-chave e categoria.",
    details: ["Posicionamento de preço", "Identificação de oportunidades", "Insights por competidor"],
    status: "PLANNED",
  },
  {
    code: "opportunities",
    title: "Oportunidades",
    summary: "Recomendações de assortment, preço e promoção por canal.",
    details: ["Priorização por potencial", "Sugestões com base em dados reais", "Tracking de adoção"],
    status: "PLANNED",
  },
  {
    code: "marketplaces",
    title: "Marketplaces",
    summary: "Conexão com os maiores marketplaces brasileiros.",
    details: ["Integrações nativas", "Sincronização de catálogo", "Configuração por canal"],
    status: "FUTURE",
  },
];
