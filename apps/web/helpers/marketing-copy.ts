export const marketingCopy = {
  brand: {
    name: "Doxnira Fiscal",
    tagline: "Gestão fiscal inteligente para empresas que querem crescer.",
    secondary:
      "Automatize sua operação, reduza erros e tenha mais controle com inteligência fiscal, documentos centralizados e Portal Contábil.",
  },
  hero: {
    eyebrow: "PLATAFORMA FISCAL INTELIGENTE",
    title: "Gestão fiscal inteligente para empresas que querem crescer.",
    description:
      "Automatize sua operação fiscal, reduza erros, centralize documentos e tenha mais controle com inteligência artificial e integração nativa com sua contabilidade.",
    primaryCta: { label: "Começar agora", href: "/register" },
    secondaryCta: { label: "Ver planos", href: "#planos" },
    microBenefits: [
      "100% em nuvem",
      "Seguro e confiável",
      "Suporte especializado",
      "Portal Contábil incluído",
    ],
  },
  socialProof: {
    title: "Empresas e escritórios que confiam na Doxnira Fiscal",
    disclaimer:
      "Nomes e logos ilustrativos enquanto formalizamos parcerias oficiais.",
  },
  benefits: [
    {
      id: "inteligencia-fiscal",
      title: "Inteligência Fiscal",
      description:
        "IA que identifica riscos, sugere correções e ajuda a reduzir rejeições.",
      anchor: "#recursos",
    },
    {
      id: "documentos-centralizados",
      title: "Documentos Centralizados",
      description: "NF-e, CT-e, NFS-e e MDF-e organizados em um único ambiente.",
      anchor: "#recursos",
    },
    {
      id: "portal-contabil",
      title: "Portal Contábil Completo",
      description:
        "Compartilhamento de documentos, pendências, fechamentos e informações entre empresa e contador.",
      anchor: "#portal-contabil",
    },
    {
      id: "seguranca-conformidade",
      title: "Segurança e Conformidade",
      description:
        "Permissões, isolamento por empresa, auditoria e rastreabilidade.",
      anchor: "#recursos",
    },
  ] as const,
  plans: {
    eyebrow: "PLANOS",
    title: "Planos que acompanham o seu crescimento",
    description:
      "Preços reais do catálogo oficial. Sem hardcoding: quando um plano muda, a landing reflete automaticamente.",
    monthlyLabel: "Mensal",
    annualLabel: "Anual",
    savingsLabel: "Economize",
    fallback: {
      title: "Não foi possível carregar os planos",
      description:
        "Tente novamente em instantes ou fale com nosso time comercial.",
      retry: "Tentar novamente",
    },
    recommendedBadge: "Recomendado",
    customPlanBadge: "Personalizado",
    contactCta: "Falar com um especialista",
    checkoutCta: "Assinar agora",
    emptyDisclaimer:
      "Nenhum plano disponível no catálogo no momento. Fale com nosso time comercial.",
  },
  commerce: {
    eyebrow: "MÓDULO COMMERCE",
    title: "Módulo Commerce",
    subtitle:
      "Inteligência, operação e lucro para escalar suas vendas nos maiores marketplaces.",
    chips: ["Dados reais", "IA", "Automação", "Fiscal", "Integrado ao Doxnira Fiscal"],
    metrics: [
      { label: "Módulos", value: "9" },
      { label: "Marketplaces", value: "3+" },
      { label: "Visão", value: "Completa" },
      { label: "Plataforma", value: "Unificada" },
    ],
  },
  accountantPortal: {
    eyebrow: "PORTAL CONTÁBIL",
    title: "Portal Contábil que aproxima e simplifica",
    description:
      "Documentos compartilhados, pendências, comunicação, fechamento mensal, SPED/SINTEGRA, histórico, permissões e auditoria em um só lugar.",
    benefits: [
      { title: "Documentos compartilhados", description: "XMLs, guias e relatórios centralizados." },
      { title: "Pendências e comunicação", description: "Solicitações, alertas e mensagens organizadas." },
      { title: "Fechamento mensal", description: "Acompanhamento e validação do fechamento contábil." },
      { title: "SPED e SINTEGRA", description: "Preparação e exportação fiscal assistida." },
      { title: "Histórico e permissões", description: "Controle de acesso por usuário e papel." },
      { title: "Auditoria", description: "Rastreabilidade completa de ações." },
    ] as const,
    cta: "Conhecer o Portal Contábil",
  },
  faq: {
    eyebrow: "DÚVIDAS FREQUENTES",
    title: "Perguntas frequentes",
    items: [
      {
        question: "Como funciona a Inteligência Fiscal?",
        answer:
          "A Inteligência Fiscal analisa documentos fiscais, identifica riscos e inconsistências, sugere correções e ajuda a reduzir rejeições e retrabalho na operação.",
      },
      {
        question: "Meus dados estão seguros?",
        answer:
          "Sim. Aplicamos isolamento por empresa, permissões granulares, auditoria, rastreabilidade e criptografia em pontos sensíveis. Nada é exposto sem autorização.",
      },
      {
        question: "Posso cancelar quando quiser?",
        answer:
          "Sim. Você pode cancelar a assinatura a qualquer momento, com opção de cancelamento imediato ou programado para o fim do período.",
      },
      {
        question: "Há taxa de implantação?",
        answer:
          "Planos como o Empresa contam com implantação assistida. Para demais planos, a implantação é guiada e baseada em onboarding.",
      },
      {
        question: "O Portal Contábil está incluído?",
        answer:
          "Sim. Todos os planos publicados já incluem o Portal Contábil, com recursos adicionais nos planos Professional e Business.",
      },
      {
        question: "Como funciona o plano personalizado?",
        answer:
          "O plano Empresa é desenhado sob medida para operações maiores. Você fala com nosso especialista e define limites, integrações e suporte.",
      },
      {
        question: "Como funciona o Módulo Commerce?",
        answer:
          "O Módulo Commerce integra gestão de produtos, anúncios, pedidos, preços, margens, concorrência e oportunidades em marketplaces. Alguns recursos estão em desenvolvimento.",
      },
      {
        question: "O sistema emite notas fiscais?",
        answer:
          "A plataforma suporta NF-e, NFS-e, CT-e e MDF-e. A emissão plena depende do plano habilitado e do ambiente fiscal configurado.",
      },
      {
        question: "Posso integrar com marketplaces?",
        answer:
          "O Módulo Commerce prevê integração com marketplaces. Algumas integrações estão em desenvolvimento e indicamos disponibilidade planejada na landing.",
      },
    ] as const,
  },
  finalCta: {
    title: "Pronto para modernizar sua operação fiscal?",
    description:
      "Comece agora e tenha mais controle, menos retrabalho e uma operação fiscal preparada para crescer.",
    primaryCta: { label: "Começar agora", href: "/register" },
    secondaryCta: { label: "Falar com especialista", href: "#contato" },
  },
  footer: {
    product: {
      title: "Produto",
      links: [
        { label: "Recursos", href: "#recursos" },
        { label: "Planos", href: "#planos" },
        { label: "Portal Contábil", href: "#portal-contabil" },
        { label: "Commerce", href: "#commerce" },
        { label: "Funcionalidades", href: "#funcionalidades" },
      ],
    },
    company: {
      title: "Empresa",
      links: [{ label: "Sobre nós", href: "#sobre" }],
    },
    support: {
      title: "Suporte",
      links: [
        { label: "Contato", href: "#contato" },
        { label: "Status", href: "#recursos" },
      ],
    },
    legal: {
      title: "Legal",
      links: [],
    },
    disclaimer:
      "Doxnira Fiscal é uma plataforma fiscal inteligente. Experimente com segurança e cresça com mais previsibilidade.",
  },
} as const;
