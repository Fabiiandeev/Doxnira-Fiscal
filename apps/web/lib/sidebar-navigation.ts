import {
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  Brain,
  Building2,
  CalendarClock,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileClock,
  FileKey2,
  FileOutput,
  FileText,
  FolderSync,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Package,
  Receipt,
  RefreshCw,
  Route,
  Settings,
  Shield,
  Target,
  Truck,
  Users,
  Wallet,
  Zap,
  Boxes,
  ShoppingCart,
  PackageOpen,
  Cog,
} from "lucide-react";

export type LucideIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

export type SidebarItem = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  permission?: string;
  platformOnly?: boolean;
  badge?: "documents" | "alerts";
};

export type SidebarGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: SidebarItem[];
};

export const sidebarGroups: SidebarGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    icon: Users,
    items: [
      { id: "companies", label: "Empresas", href: "/companies", icon: Building2 },
      { id: "customers", label: "Clientes", href: "/customers", icon: Users },
      { id: "products", label: "Produtos", href: "/products", icon: Package },
      { id: "services", label: "Serviços", href: "/services", icon: ClipboardCheck },
      { id: "fornecedores", label: "Fornecedores", href: "/fornecedores", icon: Package },
      { id: "transportadoras", label: "Transportadoras", href: "/transportadoras", icon: Truck },
      { id: "drivers", label: "Condutores", href: "/drivers", icon: Users },
    ],
  },
  {
    id: "documentos-fiscais",
    label: "Documentos Fiscais",
    icon: FileText,
    items: [
      { id: "emitir-nota", label: "Emitir NF-e", href: "/emitir-nota", icon: FileOutput },
      { id: "nfe", label: "NF-e", href: "/nfe", icon: FileText },
      { id: "nfe-entrada", label: "NF-e Entrada", href: "/documents/incoming", icon: Truck },
      { id: "nfce", label: "NFC-e", href: "/nfce", icon: CreditCard },
      { id: "nfse", label: "NFS-e", href: "/nfse-national", icon: BookOpen },
      { id: "cte", label: "CT-e Entrada", href: "/cte", icon: Truck },
      {
        id: "mdfe",
        label: "Manifestos MDF-e",
        href: "/mdfe",
        icon: Route,
        permission: "fiscal.mdfe.read",
      },
      {
        id: "mdfe-novo",
        label: "Emitir MDF-e",
        href: "/mdfe/novo",
        icon: FileOutput,
        permission: "fiscal.mdfe.create",
      },
      {
        id: "mdfe-nao-encerrados",
        label: "MDF-e não encerrados",
        href: "/mdfe/nao-encerrados",
        icon: Route,
        permission: "fiscal.mdfe.read",
      },
      { id: "notas-fiscais", label: "DF-e", href: "/notas-fiscais", icon: FileText },
      { id: "xml-center", label: "XML Fiscal", href: "/xml-center", icon: FileBarChart },
      { id: "rejections", label: "Rejeições", href: "/rejections", icon: AlertTriangle },
      { id: "guias", label: "Guias", href: "/guias", icon: FileOutput },
    ],
  },
  {
    id: "fiscal-contabil",
    label: "Fiscal e Contábil",
    icon: BarChart2,
    items: [
      { id: "monthly-closing", label: "Fechamento Fiscal", href: "/monthly-closing", icon: FileClock },
      { id: "sped", label: "SPED / SINTEGRA", href: "/sped", icon: FileBarChart },
      { id: "sintegra", label: "SINTEGRA", href: "/sintegra", icon: FileKey2 },
      { id: "contabilidade", label: "Contabilidade", href: "/accountant", icon: BarChart2 },
      { id: "accountant-documents", label: "Documentos Fiscais (Contador)", href: "/accountant/documents", icon: FileText },
      { id: "accountant-risk-ranking", label: "Ranking de Risco", href: "/accountant/risk-ranking", icon: Shield },
      { id: "accountant-fiscal-queue", label: "Fila Fiscal", href: "/accountant/fiscal-queue", icon: ListChecks },
      { id: "accountant-requests", label: "Solicitações", href: "/accountant/requests", icon: Inbox },
      { id: "accountant-value-report", label: "Relatório de Valor", href: "/accountant/value-report", icon: FileBarChart },
      { id: "tax-forecast", label: "Previsão de Impostos", href: "/tax-forecast", icon: Calculator },
      { id: "fiscal-ai", label: "FiscalAI", href: "/fiscal-ai", icon: Brain },
      { id: "fiscal-autopilot", label: "Fiscal Autopilot", href: "/fiscal-autopilot", icon: Zap },
      { id: "fiscal-radar", label: "Radar Fiscal", href: "/fiscal-radar", icon: Activity },
      { id: "fiscal-score", label: "Score Fiscal", href: "/fiscal-score", icon: Target },
      { id: "fiscal-rules", label: "Regras Fiscais", href: "/fiscal-rules", icon: Shield },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { id: "financeiro", label: "Financeiro", href: "/financeiro", icon: Wallet },
      { id: "financeiro-cobrancas", label: "Cobranças", href: "/financeiro/cobrancas", icon: Receipt },
      { id: "financeiro-contas-a-pagar", label: "Contas a Pagar", href: "/financeiro/contas-a-pagar", icon: CreditCard },
      { id: "financeiro-contas-a-receber", label: "Contas a Receber", href: "/financeiro/contas-a-receber", icon: Receipt },
      { id: "financeiro-contas-financeiras", label: "Contas Financeiras", href: "/financeiro/contas-financeiras", icon: Wallet },
      { id: "financeiro-categorias", label: "Categorias", href: "/financeiro/categorias", icon: ClipboardList },
      { id: "financeiro-centros-de-custo", label: "Centros de Custo", href: "/financeiro/centros-de-custo", icon: Calculator },
      { id: "financeiro-contas", label: "Contas (legado)", href: "/financeiro/contas", icon: CreditCard },
      { id: "financeiro-conciliacao", label: "Conciliação", href: "/financeiro/conciliacao", icon: RefreshCw },
      { id: "financeiro-fluxo-de-caixa", label: "Fluxo de Caixa", href: "/financeiro/fluxo-de-caixa", icon: Wallet },
      { id: "financeiro-integracoes", label: "Integrações Financeiras", href: "/financeiro/integracoes", icon: FolderSync },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    icon: Boxes,
    items: [
      { id: "operacao", label: "Operação", href: "/operacao", icon: Boxes },
      { id: "operacao-estoque", label: "Estoque", href: "/operacao/estoque", icon: PackageOpen },
      { id: "operacao-compras", label: "Compras", href: "/operacao/compras", icon: ShoppingCart },
      { id: "operacao-vendas", label: "Vendas", href: "/operacao/vendas", icon: ShoppingCart },
      { id: "operacao-automacao", label: "Automação", href: "/operacao/automacao", icon: Cog },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: FileBarChart,
    items: [
      { id: "reports", label: "Relatórios", href: "/reports", icon: FileBarChart },
      { id: "reports-accounting", label: "Apurações", href: "/reports/accounting", icon: Calculator },
      { id: "reports-monthly-closing", label: "Indicadores", href: "/reports/monthly-closing", icon: FileClock },
      { id: "document-requests", label: "Solicitações de Documentos", href: "/document-requests", icon: ClipboardList },
      { id: "fiscal-inbox", label: "Caixa de Entrada Fiscal", href: "/fiscal-inbox", icon: Inbox },
      { id: "fiscal-calendar", label: "Calendário Fiscal", href: "/fiscal-calendar", icon: CalendarClock },
      { id: "fiscal-maturity", label: "Vencimentos Fiscais", href: "/fiscal-maturity", icon: CalendarClock },
      { id: "stuck-money", label: "Dinheiro Parado", href: "/stuck-money", icon: Wallet },
      { id: "tax-reform", label: "Reforma Tributária", href: "/tax-reform", icon: FileText },
      { id: "simulador", label: "Simulador", href: "/simulador", icon: Calculator },
      { id: "nfe-validation", label: "Validação NF-e", href: "/nfe-validation", icon: ClipboardCheck },
      { id: "xml-fiscal", label: "XML Fiscal Detalhado", href: "/xml-fiscal", icon: FileBarChart },
      { id: "segment-rules", label: "Regras por Segmento", href: "/segment-rules", icon: Shield },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icon: Settings,
    items: [
      { id: "settings", label: "Configurações", href: "/settings", icon: Settings },
      { id: "settings-subscription", label: "Plano e assinatura", href: "/settings/subscription", icon: CreditCard },
      { id: "settings-company", label: "Empresa", href: "/settings/company", icon: Building2 },
      { id: "settings-fiscal", label: "Fiscal", href: "/settings/fiscal", icon: FileText },
      { id: "settings-mdfe", label: "Operação MDF-e", href: "/settings/mdfe", icon: Route },
      { id: "settings-certificate", label: "Certificado", href: "/settings/certificate", icon: FileKey2 },
      { id: "settings-integrations", label: "Integrações", href: "/settings/integrations", icon: FolderSync },
      { id: "settings-users", label: "Usuários", href: "/settings/users", icon: Users },
      { id: "settings-security", label: "Segurança/Auditoria", href: "/settings/security", icon: Shield },
      {
        id: "platform-plans",
        label: "Planos e preços",
        href: "/platform/plans",
        icon: CreditCard,
        platformOnly: true,
      },
    ],
  },
];
