"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  FileClock,
  FileKey2,
  FileOutput,
  FileText,
  FolderSync,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Truck,
  Users,
  X,
  Zap,
  Brain,
  Inbox,
  BarChart2,
  CreditCard,
  Package,
  ClipboardCheck,
  ListChecks,
  BookOpen,
  GraduationCap,
  LineChart,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Fiscal Autopilot", href: "/fiscal-autopilot", icon: Zap, badge: "42" },
  { label: "FiscalAI", href: "/fiscal-ai", icon: Brain, badge: "8" },
  { label: "Inbox Fiscal", href: "/fiscal-inbox", icon: Inbox, badge: "15" },
  { label: "Radar Fiscal", href: "/fiscal-radar", icon: Activity, badge: "5" },
  { label: "Score Fiscal", href: "/fiscal-score", icon: Target },
  { label: "Dinheiro Parado", href: "/stuck-money", icon: CreditCard },
  { label: "Agenda Fiscal", href: "/fiscal-calendar", icon: CalendarDays, badge: "8" },
  { label: "Emitir Nota", href: "/emitir-nota", icon: FileOutput },
  { label: "Clientes", href: "/clients", icon: Users },
  { label: "Produtos", href: "/products", icon: Package },
  { label: "Serviços", href: "/services", icon: ClipboardCheck },
  { label: "Documentos Fiscais", href: "/documents", icon: FileText, badge: "12" },
  { label: "  Entrada", href: "/documents/incoming", icon: Truck },
  { label: "  Saída", href: "/documents/outgoing", icon: FileText },
  { label: "  Serviços", href: "/documents/services", icon: ClipboardCheck },
  { label: "  CT-e Entrada", href: "/cte/incoming", icon: Truck },
  { label: "XML Fiscal", href: "/xml-center", icon: FileBarChart },
  { label: "Rejeições", href: "/rejections", icon: AlertTriangle, badge: "7" },
  { label: "Estoque", href: "/inventory", icon: Package },
  { label: "  Entrada Automática", href: "/inventory/incoming", icon: Truck },
  { label: "  Movimentações", href: "/inventory/movements", icon: Activity },
  { label: "SPED / SINTEGRA", href: "/sped", icon: FileBarChart },
  { label: "Fechamento Fiscal", href: "/monthly-closing", icon: FileClock },
  { label: "Previsão de Impostos", href: "/tax-forecast", icon: CircleDollarSign },
  { label: "Guias", href: "/guides", icon: FileOutput },
  { label: "Contador", href: "/accountant", icon: BarChart2 },
  { label: "  Ranking de Risco", href: "/accountant/risk-ranking", icon: Target },
  { label: "  Fila Fiscal", href: "/accountant/work-queue", icon: ListChecks },
  { label: "  Solicitações", href: "/accountant/requests", icon: Inbox },
  { label: "  Relatório de Valor", href: "/accountant/value-report", icon: CreditCard },
  { label: "Radar IBS/CBS", href: "/tax-reform", icon: TrendingUp },
  { label: "NFS-e Nacional", href: "/nfse-national", icon: BookOpen },
  { label: "Regras Fiscais", href: "/fiscal-rules", icon: Shield },
  { label: "Pacotes por Segmento", href: "/segment-rules", icon: Package },
  { label: "Maturidade Fiscal", href: "/fiscal-maturity", icon: GraduationCap },
  { label: "Onboarding Fiscal", href: "/onboarding/fiscal-setup", icon: GraduationCap },
  { label: "Relatórios", href: "/reports", icon: FileBarChart },
  { label: "Configurações", href: "/settings", icon: Settings },
];

const secondaryNavigation = [
  { label: "Sincronização", href: "/sync", icon: RefreshCw },
  { label: "Certificados", href: "/certificate", icon: FileKey2 },
  { label: "Usuários", href: "/users", icon: Users },
];

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
  return (
    <>
      <div className="px-5 pb-6 pt-6">
        <BrandMark />
      </div>
      <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-3">
        {navigation.map((item) => {
          const badge =
            item.href === "/documents"
              ? documentCount
              : item.href === "/alerts"
                ? alertCount
                : item.badge;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-bold transition",
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
        })}
        {secondaryNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-bold transition",
                isActive
                  ? "bg-lime text-ink"
                  : "text-subtle hover:bg-white/60 hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
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
