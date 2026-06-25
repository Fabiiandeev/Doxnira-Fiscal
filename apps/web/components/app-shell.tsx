"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  BookOpen,
  Brain,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
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
  LineChart,
  ListChecks,
  Menu,
  Package,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Target,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCompanyId, getToken, setCompanyId } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { getStoredUser, logout } from "@/lib/services/auth-service";
import { listCompanies, type Company } from "@/lib/services/company-service";
import { getSyncReadiness, requestSync } from "@/lib/services/sync-service";
import { cn, maskCnpj } from "@/lib/utils";

type LucideIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "fiscal-ai",
    label: "FiscalAI",
    icon: Brain,
    items: [
      { label: "Fiscal Autopilot", href: "/fiscal-autopilot", icon: Zap, badge: "42" },
      { label: "Chat Fiscal", href: "/fiscal-ai", icon: Brain, badge: "8" },
      { label: "Radar Fiscal", href: "/fiscal-radar", icon: Activity, badge: "5" },
      { label: "Score Fiscal", href: "/fiscal-score", icon: Target },
      { label: "Ranking de Risco", href: "/accountant/risk-ranking", icon: Shield },
    ],
  },
  {
    id: "documentos-fiscais",
    label: "Documentos Fiscais",
    icon: FileText,
    items: [
      { label: "Inbox Fiscal", href: "/fiscal-inbox", icon: Inbox, badge: "15" },
      { label: "NF-e Entrada", href: "/documents/incoming", icon: Truck },
      { label: "NF-e Saida", href: "/documents/outgoing", icon: FileText },
      { label: "CT-e Entrada", href: "/cte/incoming", icon: Truck },
      { label: "NFS-e", href: "/nfse-national", icon: BookOpen },
      { label: "MDF-e", href: "/documents/services", icon: Send },
      { label: "XML Fiscal", href: "/xml-center", icon: FileBarChart },
      { label: "Entrada Automatica", href: "/inventory/incoming", icon: Truck },
      { label: "Rejeicoes", href: "/rejections", icon: AlertTriangle, badge: "7" },
    ],
  },
  {
    id: "emissao",
    label: "Emissao",
    icon: FileOutput,
    items: [
      { label: "Emitir NF-e", href: "/emitir-nota", icon: FileOutput },
      { label: "Emitir NFS-e", href: "/nfse-national", icon: BookOpen },
      { label: "Carta de Correcao", href: "/fiscal-rules", icon: FileText },
      { label: "Cancelamentos", href: "/rejections", icon: AlertTriangle },
      { label: "Inutilizacoes", href: "/guides", icon: FileKey2 },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    icon: Users,
    items: [
      { label: "Clientes", href: "/clients", icon: Users },
      { label: "Fornecedores", href: "/companies", icon: Building2 },
      { label: "Produtos", href: "/products", icon: Package },
      { label: "Servicos", href: "/services", icon: ClipboardCheck },
      { label: "Transportadoras", href: "/cte/incoming", icon: Truck },
      { label: "Empresas", href: "/companies", icon: Building2 },
    ],
  },
  {
    id: "estoque",
    label: "Estoque",
    icon: Package,
    items: [
      { label: "Estoque", href: "/inventory", icon: Package },
      { label: "Movimentacoes", href: "/inventory/movements", icon: Activity },
      { label: "Inventario", href: "/inventory/incoming", icon: ClipboardList },
    ],
  },
  {
    id: "agenda-fiscal",
    label: "Agenda Fiscal",
    icon: CalendarDays,
    items: [
      { label: "Agenda Fiscal", href: "/fiscal-calendar", icon: CalendarDays, badge: "8" },
      { label: "Solicitacoes", href: "/accountant/requests", icon: Inbox },
      { label: "Fila Fiscal", href: "/accountant/work-queue", icon: ListChecks },
    ],
  },
  {
    id: "fiscal",
    label: "Fiscal",
    icon: FileClock,
    items: [
      { label: "Fechamento Fiscal", href: "/monthly-closing", icon: FileClock },
      { label: "Previsao de Impostos", href: "/tax-forecast", icon: CircleDollarSign },
      { label: "Guias", href: "/guides", icon: FileOutput },
      { label: "SPED", href: "/sped", icon: FileBarChart },
      { label: "Sintegra", href: "/sped", icon: LineChart },
    ],
  },
  {
    id: "contabilidade",
    label: "Contabilidade",
    icon: BarChart2,
    items: [
      { label: "Painel do Contador", href: "/accountant", icon: BarChart2 },
      { label: "Empresas Vinculadas", href: "/companies", icon: Building2 },
      { label: "Compartilhamentos", href: "/accountant/requests", icon: Inbox },
      { label: "Pendencias", href: "/stuck-money", icon: CreditCard },
      { label: "Relatorios", href: "/accountant/value-report", icon: FileBarChart },
    ],
  },
  {
    id: "configuracoes",
    label: "Configuracoes",
    icon: Settings,
    items: [
      { label: "Empresa", href: "/companies", icon: Building2 },
      { label: "Certificado Digital", href: "/certificate", icon: FileKey2 },
      { label: "Usuarios", href: "/users", icon: Users },
      { label: "Permissoes", href: "/settings", icon: Shield },
      { label: "Integracoes", href: "/fiscal-rules", icon: FolderSync },
      { label: "API", href: "/segment-rules", icon: FileText },
      { label: "Logs", href: "/tax-reform", icon: ClipboardList },
    ],
  },
];

const SINGLE_ITEM_GROUPS = new Set(["dashboard"]);

const OPEN_GROUP_KEY = "ns-sidebar-open-group";

function SidebarContent({
  onNavigate,
  documentCount,
  alertCount,
}: {
  onNavigate?: () => void;
  documentCount?: number;
  alertCount?: number;
}) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(OPEN_GROUP_KEY);
    if (stored) {
      try { setOpenGroup(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(OPEN_GROUP_KEY, JSON.stringify(openGroup));
    }
  }, [openGroup]);

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroup((prev) => (prev === groupId ? null : groupId));
  }, []);

  useEffect(() => {
    for (const group of navGroups) {
      if (SINGLE_ITEM_GROUPS.has(group.id)) continue;
      for (const item of group.items) {
        if (pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`))) {
          setOpenGroup((prev) => (prev === group.id ? prev : group.id));
          return;
        }
      }
    }
  }, [pathname]);

  return (
    <>
      <div className="px-5 pb-6 pt-6">
        <BrandMark />
      </div>
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3">
        {navGroups.map((group) => {
          const isSingle = SINGLE_ITEM_GROUPS.has(group.id);
          const isOpen = openGroup === group.id;
          const GroupIcon = group.icon;

          if (isSingle) {
            const item = group.items[0];
            const badge =
              item.href === "/documents"
                ? documentCount
                : item.href === "/alerts"
                  ? alertCount
                  : item.badge;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={group.id}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-bold transition",
                  isActive
                    ? "bg-lime text-ink shadow-sm"
                    : "text-subtle hover:bg-white/60 hover:text-ink",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.4 : 2} />
                <span className="flex-1">{item.label}</span>
                {badge !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px]",
                      isActive ? "bg-ink text-white" : "bg-white text-subtle",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          }

          const hasActiveChild = group.items.some(
            (item) =>
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`)),
          );

          return (
            <div key={group.id} className="mt-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[12px] font-bold transition",
                  hasActiveChild
                    ? "text-ink"
                    : "text-subtle hover:bg-white/60 hover:text-ink",
                )}
              >
                <GroupIcon className="h-[18px] w-[18px]" strokeWidth={hasActiveChild ? 2.4 : 2} />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out",
                  isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <div className="space-y-0.5 pb-1 pl-4">
                  {group.items.map((item) => {
                    const badge =
                      item.href === "/documents"
                        ? documentCount
                        : item.href === "/alerts"
                          ? alertCount
                          : item.badge;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[11px] font-semibold transition",
                          isActive
                            ? "bg-lime text-ink shadow-sm"
                            : "text-subtle hover:bg-white/60 hover:text-ink",
                        )}
                      >
                        <Icon className="h-[14px] w-[14px]" strokeWidth={isActive ? 2.4 : 2} />
                        <span className="flex-1">{item.label}</span>
                        {badge !== undefined && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px]",
                              isActive ? "bg-ink text-white" : "bg-white text-subtle",
                            )}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      <div className="mx-4 mb-3">
        <button type="button" onClick={() => notify({ title: "Menu compacto", description: "Aplicado automaticamente em telas menores." })} className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-[10px] font-bold text-subtle">
          <ChevronLeft className="h-3.5 w-3.5" />Recolher menu
        </button>
      </div>
      <div className="m-4 mt-0 rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-white"><Zap className="h-4 w-4" /></div>
          <div><p className="text-[10px] font-extrabold">Contabilidade NS Fiscal</p><p className="mt-1 text-[9px] text-subtle">Portal contábil ativo</p></div>
        </div>
      </div>
    </>
  );
}

function Topbar({
  onOpenMenu,
  companies,
  activeCompany,
  onCompanyChange,
  alertCount,
}: {
  onOpenMenu: () => void;
  companies: Company[];
  activeCompany?: Company;
  onCompanyChange: (id: string) => void;
  alertCount: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const readiness = useQuery({
    queryKey: ["sync-readiness", activeCompany?.id],
    queryFn: () => getSyncReadiness(activeCompany!.id),
    enabled: Boolean(activeCompany?.id),
  });
  const sync = useMutation({
    mutationFn: () => requestSync(activeCompany!.id),
    onSuccess: (result) => {
      notify({ title: result.message, description: "Acompanhe o processamento na tela de sincronização." });
      queryClient.invalidateQueries({ queryKey: ["sync"] });
      router.push("/sync");
    },
    onError: (error) => {
      notify({ title: "Sincronização não iniciada", description: error.message, tone: "error" });
    },
  });

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (debouncedSearch.length >= 3) {
      router.replace(`/documents?q=${encodeURIComponent(debouncedSearch)}`);
    }
  }, [debouncedSearch, router]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (search.trim()) router.push(`/documents?q=${encodeURIComponent(search.trim())}`);
  }

  function startSync() {
    if (!readiness.data?.certificate.exists) {
      notify({
        title: "Certificado necessário",
        description: "Cadastre um certificado A1 para iniciar a sincronização.",
        tone: "error",
      });
      router.push("/certificate");
      return;
    }
    sync.mutate();
  }

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <header className="flex min-h-[82px] items-center gap-3 border-b border-black/5 bg-white px-4 md:px-6">
      <button
        onClick={onOpenMenu}
        className="grid h-11 w-11 place-items-center rounded-xl bg-white text-ink lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-[205px] 2xl:block">
        <p className="text-base font-extrabold">Olá, {getStoredUser()?.name.split(" ")[0] || "Contador"}! 👋</p>
        <p className="mt-1 text-[10px] text-subtle">Bem-vindo ao portal da contabilidade.</p>
      </div>

      <form onSubmit={submitSearch} className="relative hidden min-w-0 max-w-xl flex-1 md:block">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 rounded-xl border border-line bg-white pl-11 pr-20 shadow-none"
          placeholder="Buscar empresa, CNPJ, chave, NF-e, cliente..."
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-muted px-2 py-1 text-[10px] font-bold text-subtle">
          ⌘ K
        </span>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 lg:flex">
          <CalendarDays className="h-4 w-4 text-subtle" />
          <span className="text-[10px] font-extrabold capitalize">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date())}</span>
          <ChevronDown className="h-3.5 w-3.5 text-subtle" />
        </div>
        <Button
          variant="lime"
          className="hidden h-11 rounded-xl xl:flex"
          onClick={startSync}
          disabled={sync.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Iniciando..." : "Sincronizar todas"}
        </Button>
        <div className="relative hidden h-11 items-center gap-3 rounded-xl border border-line bg-white px-3 text-left md:flex">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-pastel-purple text-indigo-700">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="hidden xl:block">
            <p className="max-w-36 truncate text-[11px] font-extrabold">
              {activeCompany?.tradeName || activeCompany?.legalName || "Empresa"}
            </p>
            <p className="text-[9px] font-semibold text-subtle">
              {activeCompany ? maskCnpj(activeCompany.cnpj) : "Carregando..."}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-subtle" />
          <select
            value={activeCompany?.id || ""}
            onChange={(event) => onCompanyChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Selecionar empresa"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.tradeName || company.legalName}
              </option>
            ))}
          </select>
        </div>
        <Link
          href="/alerts"
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-line bg-white text-subtle hover:text-ink"
          aria-label="Notificações"
        >
          <Bell className="h-[18px] w-[18px]" />
          {alertCount > 0 && (
            <span className="absolute right-2 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-extrabold text-white">
              {alertCount}
            </span>
          )}
        </Link>
        <div className="relative">
        <button
          onClick={() => setProfileOpen((value) => !value)}
          className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-1.5 pr-3 text-ink"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-xs font-extrabold text-ink">
            {getStoredUser()?.name.slice(0, 2).toUpperCase() || "FN"}
          </span>
          <span className="hidden text-left 2xl:block"><span className="block text-[10px] font-extrabold">{getStoredUser()?.name || "Fabian"}</span><span className="block text-[8px] font-semibold text-subtle">{getStoredUser()?.role || "Contador"}</span></span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-subtle 2xl:block" />
        </button>
          {profileOpen && (
            <div className="absolute right-0 top-14 z-40 w-56 rounded-2xl border border-line bg-white p-2 shadow-card">
              <Link href="/settings" className="block rounded-xl px-3 py-2.5 text-[11px] font-bold hover:bg-muted">
                Preferências
              </Link>
              <button onClick={handleLogout} className="w-full rounded-xl px-3 py-2.5 text-left text-[11px] font-bold text-red-600 hover:bg-red-50">
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
    enabled: ready,
  });

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setActiveCompanyId(getCompanyId());
    setReady(true);
  }, [router]);

  useEffect(() => {
    const first = companiesQuery.data?.data[0];
    if (!activeCompanyId && first) {
      setCompanyId(first.id);
      setActiveCompanyId(first.id);
    }
  }, [activeCompanyId, companiesQuery.data]);

  if (!ready) return <div className="min-h-screen animate-pulse bg-canvas" />;

  const companies = companiesQuery.data?.data || [];
  const activeCompany =
    companies.find((company) => company.id === activeCompanyId) || companies[0];
  const documentCount = activeCompany?._count?.fiscalDocuments || 0;
  const alertCount = activeCompany?._count?.alerts || 0;

  function changeCompany(id: string) {
    setCompanyId(id);
    setActiveCompanyId(id);
    queryClient.invalidateQueries();
    notify({ title: "Empresa alterada", description: "Os dados fiscais foram atualizados." });
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-[1920px] overflow-hidden bg-surface">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-black/5 bg-white lg:flex">
          <SidebarContent documentCount={documentCount} alertCount={alertCount} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            />
            <aside className="relative flex h-full w-[290px] flex-col bg-muted shadow-card">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-4 top-5 z-10 grid h-9 w-9 place-items-center rounded-xl bg-white"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent
                onNavigate={() => setMobileOpen(false)}
                documentCount={documentCount}
                alertCount={alertCount}
              />
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Topbar
            onOpenMenu={() => setMobileOpen(true)}
            companies={companies}
            activeCompany={activeCompany}
            onCompanyChange={changeCompany}
            alertCount={alertCount}
          />
          <main className="px-4 pb-10 pt-4 md:px-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
