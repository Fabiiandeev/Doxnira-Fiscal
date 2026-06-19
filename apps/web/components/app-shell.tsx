"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  ChevronDown,
  CircleHelp,
  FileBarChart,
  FileCheck2,
  FileKey2,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Users,
  X,
  Zap,
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
  { label: "Documentos Fiscais", href: "/documents", icon: FileText, badge: "12" },
  { label: "Sincronização", href: "/sync", icon: RefreshCw },
  { label: "Empresas", href: "/companies", icon: Building2 },
  { label: "Certificado Digital", href: "/certificate", icon: FileKey2 },
  { label: "Manifestação", href: "/manifestations", icon: FileCheck2, badge: "8" },
  { label: "Alertas", href: "/alerts", icon: ShieldAlert, badge: "23" },
  { label: "Relatórios", href: "/reports", icon: FileBarChart },
  { label: "Usuários", href: "/users", icon: Users },
];

const secondaryNavigation = [
  { label: "Configurações", href: "/settings", icon: Settings },
  { label: "Ajuda", href: "/help", icon: CircleHelp },
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
        <p className="px-3 pb-2 pt-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle/70">
          Operação fiscal
        </p>
        {navigation.map((item) => {
          const badge =
            item.href === "/documents"
              ? documentCount
              : item.href === "/alerts"
                ? alertCount
                : item.href === "/manifestations"
                  ? undefined
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
                "group flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition",
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
        <p className="px-3 pb-2 pt-5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle/70">
          Sistema
        </p>
        {secondaryNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition",
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
      <div className="m-4 rounded-2xl bg-ink p-4 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-lime text-ink">
            <Zap className="h-4 w-4" />
          </div>
          <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
            Online
          </span>
        </div>
        <p className="text-xs font-extrabold">Motor DF-e operacional</p>
        <p className="mt-1 text-[10px] leading-4 text-white/50">
          Última sincronização há 14 minutos.
        </p>
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
    <header className="flex min-h-[88px] items-center gap-3 border-b border-black/5 px-4 md:px-7 xl:px-9">
      <button
        onClick={onOpenMenu}
        className="grid h-11 w-11 place-items-center rounded-xl bg-white text-ink lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={submitSearch} className="relative hidden max-w-xl flex-1 md:block">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-12 rounded-2xl border-0 bg-white/75 pl-11 pr-20 shadow-sm focus:bg-white"
          placeholder="Buscar por chave, CNPJ, fornecedor, número ou NSU..."
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-muted px-2 py-1 text-[10px] font-bold text-subtle">
          ⌘ K
        </span>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="lime"
          className="hidden h-12 rounded-2xl xl:flex"
          onClick={startSync}
          disabled={sync.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Iniciando..." : "Sincronizar agora"}
        </Button>
        <div className="relative hidden h-12 items-center gap-3 rounded-2xl bg-white/75 px-3.5 text-left md:flex">
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
        <button
          type="button"
          onClick={() =>
            notify({
              title: "Tema claro ativo",
              description: "A personalização de tema fica disponível em Configurações.",
            })
          }
          className="grid h-11 w-11 place-items-center rounded-xl bg-white/75 text-subtle hover:text-ink"
          aria-label="Alternar tema"
        >
          <Moon className="h-[18px] w-[18px]" />
        </button>
        <Link
          href="/alerts"
          className="relative grid h-11 w-11 place-items-center rounded-xl bg-white/75 text-subtle hover:text-ink"
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
          className="flex h-11 items-center gap-2 rounded-xl bg-ink px-1.5 pr-3 text-white"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-xs font-extrabold text-ink">
            {getStoredUser()?.name.slice(0, 2).toUpperCase() || "FN"}
          </span>
          <span className="hidden text-xs font-bold 2xl:block">{getStoredUser()?.name || "Fabian"}</span>
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
    <div className="min-h-screen bg-canvas p-0 lg:p-3">
      <div className="mx-auto flex min-h-screen max-w-[1800px] overflow-hidden bg-surface lg:min-h-[calc(100vh-1.5rem)] lg:rounded-3xl lg:shadow-card">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-black/5 bg-muted lg:flex">
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
          <main className="px-4 pb-10 pt-7 md:px-7 xl:px-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
