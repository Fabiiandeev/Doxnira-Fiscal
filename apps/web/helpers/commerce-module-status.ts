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
    summary: "Visão consolidada de receita, pedidos, lucro e performance dos marketplaces.",
    details: [
      "Receita, pedidos e lucro em tempo real",
      "Performance por marketplace",
      "Alertas e oportunidades inteligentes",
      "Gráficos e indicadores completos",
    ],
    status: "AVAILABLE",
  },
  {
    code: "products",
    title: "Produtos Marketplace",
    summary: "Catálogo unificado com estoque e dados fiscais sincronizados entre canais.",
    details: [
      "Catálogo unificado de produtos",
      "Estoque sincronizado entre canais",
      "Dados fiscais, NCM, CEST e origem",
      "Curva ABC e previsão de ruptura",
    ],
    status: "AVAILABLE",
  },
  {
    code: "ads",
    title: "Anúncios",
    summary: "Gestão e otimização inteligente dos anúncios publicados em cada canal.",
    details: [
      "Gestão de anúncios por canal",
      "Score de qualidade com IA (0 a 100)",
      "Otimização automática de títulos",
      "Teste A/B e melhorias sugeridas",
    ],
    status: "BETA",
  },
  {
    code: "orders",
    title: "Pedidos",
    summary: "Central de pedidos com fluxo operacional e emissão fiscal integrada.",
    details: [
      "Central de pedidos de todos os canais",
      "Fluxo completo do pedido ao envio",
      "Emissão automática de NF-e",
      "Impressão de etiquetas e picking",
    ],
    status: "AVAILABLE",
  },
  {
    code: "pricing",
    title: "Preços",
    summary: "Precificação inteligente com regras, margem e automação por canal.",
    details: [
      "Precificação inteligente e dinâmica",
      "Regras por canal, produto e categoria",
      "Simulador de preço e margem",
      "Reprecificação automática",
    ],
    status: "AVAILABLE",
  },
  {
    code: "margins",
    title: "Margens",
    summary: "Margem real calculada com custos, taxas, comissões e impostos.",
    details: [
      "Margem real por pedido e produto",
      "Impostos, comissões e custos incluídos",
      "Relatórios de lucratividade detalhados",
      "Análise por SKU, canal e período",
    ],
    status: "BETA",
  },
  {
    code: "competition",
    title: "Concorrência",
    summary: "Monitoramento de preços, estoque e posicionamento dos concorrentes.",
    details: [
      "Monitoramento de concorrentes",
      "Preços, estoque e posição na busca",
      "Histórico de variações e tendências",
      "Alertas de mudanças importantes",
    ],
    status: "PLANNED",
  },
  {
    code: "opportunities",
    title: "Oportunidades",
    summary: "Identificação de produtos e ações com maior potencial comercial.",
    details: [
      "Produtos em tendência",
      "Análise de demanda e sazonalidade",
      "Score de oportunidade com IA",
      "Simulação de margem e risco",
    ],
    status: "PLANNED",
  },
  {
    code: "marketplaces",
    title: "Marketplaces",
    summary: "Conexão, sincronização e acompanhamento das contas integradas.",
    details: [
      "Conexão e gestão de contas",
      "Sincronizações automáticas",
      "Webhooks e integrações",
      "Logs e histórico de operações",
    ],
    status: "FUTURE",
  },
];
