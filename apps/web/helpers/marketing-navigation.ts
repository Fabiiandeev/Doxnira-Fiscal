export type MarketingNavItem = {
  title: string;
  href: string;
};

export const marketingNavigation: readonly MarketingNavItem[] = [
  { title: "Recursos", href: "#recursos" },
  { title: "Planos", href: "#planos" },
  { title: "Portal Contábil", href: "#portal-contabil" },
  { title: "Módulo Commerce", href: "#commerce" },
  { title: "Funcionalidades", href: "#funcionalidades" },
  { title: "Sobre nós", href: "#sobre" },
  { title: "Contato", href: "#contato" },
] as const;

export const marketingHeaderActions = {
  login: { label: "Entrar", href: "/login" },
  signup: { label: "Começar agora", href: "/register" },
} as const;
