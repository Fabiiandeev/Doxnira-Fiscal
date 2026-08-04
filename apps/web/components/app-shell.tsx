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
  ChevronRight,
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
  ListChecks,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Route,
  Search,
  Settings,
  Shield,
  Truck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyContext } from "@/components/providers/company-provider";
import { usePermissionsContext } from "@/components/providers/permissions-provider";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { getBrowserLocalStorage } from "@/lib/browser-storage";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  ALL_SIDEBAR_ITEMS,
  SIDEBAR_SINGLE_ITEM_GROUPS,
  findActiveTopItem,
  groupHasActiveChild,
  isItemActive,
} from "@/lib/sidebar-active";
import {
  sidebarGroups,
  type SidebarGroup,
  type SidebarItem,
} from "@/lib/sidebar-navigation";
import type { AuthUser } from "@/lib/services/auth-service";
import type { Company } from "@/lib/services/company-service";
import { getSyncReadiness, requestSync } from "@/lib/services/sync-service";
import { cn, maskCnpj } from "@/lib/utils";

const COLLAPSED_STORAGE_KEY = "ns-sidebar-collapsed";
const OPEN_GROUP_STORAGE_KEY = "ns-sidebar-open-group";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
  openGroup: string | null;
  setOpenGroup: (value: string | null) => void;
};

function useSidebarState(): SidebarContextValue {
  const [collapsed, setCollapsedState] = useState(false);
  const [openGroup, setOpenGroupState] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const storage = getBrowserLocalStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(COLLAPSED_STORAGE_KEY);
      if (raw !== null) setCollapsedState(raw === "1");
    } catch {
      /* ignore */
    }
    try {
      const raw = storage.getItem(OPEN_GROUP_STORAGE_KEY);
      if (raw) setOpenGroupState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    const storage = getBrowserLocalStorage();
    try {
      storage?.setItem(COLLAPSED_STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const setOpenGroup = useCallback((value: string | null) => {
    setOpenGroupState(value);
    const storage = getBrowserLocalStorage();
    try {
      storage?.setItem(OPEN_GROUP_STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  return { collapsed, setCollapsed, toggle, openGroup, setOpenGroup };
}

function initialsFor(name?: string | null) {
  if (!name) return "NS";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "NS";
}

function NavLink({
  item,
  pathname,
  active,
  depth,
  onNavigate,
  collapsed,
}: {
  item: SidebarItem;
  pathname: string | null | undefined;
  active: boolean;
  depth: 0 | 1;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  if (!item.href) return null;
  const Icon = item.icon;

  const baseClasses = cn(
    "group flex h-10 w-full items-center rounded-xl px-3 text-[12px] font-bold transition-colors",
    depth === 1 && "h-9 rounded-lg px-3 text-[11px] font-semibold",
    active
      ? "bg-lime text-ink shadow-sm"
      : "text-subtle hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink",
  );

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={baseClasses}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          depth === 1 && "h-[14px] w-[14px]",
          collapsed && "mx-auto",
        )}
        strokeWidth={active ? 2.4 : 2}
        aria-hidden
      />
      {!collapsed && <span className={cn("ml-3 flex-1 truncate", depth === 1 && "ml-2.5")}>{item.label}</span>}
   </Link>
  );

  if (collapsed) {
    return (
      <Tooltip label={item.label} side="right">
        <span className="block w-full">{link}</span>
     </Tooltip>
    );
  }

  return link;
}

function CollapsedGroupPopover({
  group,
  pathname,
  onNavigate,
}: {
  group: SidebarGroup;
  pathname: string | null | undefined;
  onNavigate?: () => void;
}) {
  const visibleItems = group.items;
  if (visibleItems.length <= 1) {
    return (
      <NavLink
        item={visibleItems[0]}
        pathname={pathname}
        active={isItemActive(pathname, visibleItems[0])}
        depth={0}
        collapsed
        onNavigate={onNavigate}
      />
    );
  }

  const Icon = group.icon;
  const active = groupHasActiveChild(pathname, group);

  return (
    <DropdownMenu>
      <Tooltip label={group.label} side="right">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={group.label}
            aria-haspopup="menu"
            className={cn(
              "flex h-10 w-full items-center justify-center rounded-xl text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60",
              active
                ? "bg-lime text-ink shadow-sm"
                : "text-subtle hover:bg-surface hover:text-ink",
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
         </button>
       </DropdownMenuTrigger>
     </Tooltip>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={10}
        className="min-w-64 p-2"
      >
        <div className="px-2 pb-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-subtle">
            {group.label}
         </p>
       </div>
        <ul className="flex flex-col gap-0.5" role="menu">
          {visibleItems.map((item) => {
            const ItemIcon = item.icon;
            const isActive = isItemActive(pathname, item);
            return (
              <li key={item.id} role="none">
                <Link
                  role="menuitem"
                  href={item.href ?? "#"}
                  aria-disabled={!item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "bg-lime text-ink shadow-sm"
                      : "text-subtle hover:bg-surface hover:text-ink",
                  )}
                >
                  <ItemIcon
                    className="h-[14px] w-[14px]"
                    strokeWidth={isActive ? 2.4 : 2}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{item.label}</span>
               </Link>
             </li>
            );
          })}
       </ul>
     </DropdownMenuContent>
   </DropdownMenu>
  );
}

function GroupHeader({
  group,
  open,
  onToggle,
  active,
  collapsed,
}: {
  group: SidebarGroup;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = group.icon;
  const isSingle = SIDEBAR_SINGLE_ITEM_GROUPS.has(group.id);

  if (collapsed) {
    if (isSingle) return null;
    return null;
  }

  if (isSingle) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`nav-group-${group.id}`}
      className={cn(
        "flex h-10 w-full items-center rounded-xl px-3 text-[10px] font-extrabold uppercase tracking-[0.12em] transition-colors",
        active ? "text-ink" : "text-subtle hover:text-ink",
      )}
    >
      <Icon className="h-[14px] w-[14px] shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden />
      <span className="ml-2 flex-1 text-left">{group.label}</span>
      <ChevronDown
        className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
        aria-hidden
      />
   </button>
  );
}

function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center border-b border-line",
        collapsed ? "justify-center px-2 py-3" : "justify-between gap-2 px-4 py-4",
      )}
    >
      {collapsed ? (
        <Tooltip label="Expandir menu" side="right">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expandir menu"
            className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-ink shadow-sm hover:bg-lime-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden />
         </button>
       </Tooltip>
      ) : (
        <>
          <BrandMark />
          <Tooltip label="Recolher menu" side="left">
            <button
              type="button"
              onClick={onToggle}
              aria-label="Recolher menu"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
           </button>
         </Tooltip>
        </>
      )}
   </div>
  );
}

function UserFooter({
  user,
  collapsed,
  onLogout,
}: {
  user: AuthUser | null;
  collapsed: boolean;
  onLogout: () => Promise<void>;
}) {
  const initials = initialsFor(user?.name);
  const router = useRouter();

  async function handleLogout() {
    await onLogout();
    router.replace("/login");
  }

  if (collapsed) {
    return (
      <div className="flex shrink-0 justify-center border-t border-line px-2 py-3">
        <Tooltip label={`${user?.name ?? "Usuário"} · Sair da conta`} side="right">
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair da conta"
            className="grid h-10 w-10 place-items-center rounded-full bg-lime text-xs font-extrabold text-ink shadow-sm hover:bg-lime-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
          >
            {initials}
         </button>
       </Tooltip>
     </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface/40 px-3 py-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime text-xs font-extrabold text-ink shadow-sm">
        {initials}
     </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-extrabold text-ink">{user?.name ?? "Usuário"}</p>
        <p className="truncate text-[10px] font-semibold text-subtle">{user?.role ?? "—"}</p>
     </div>
      <Tooltip label="Sair da conta" side="left">
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair da conta"
          className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-subtle hover:bg-surface hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
        >
          <LogOut className="h-4 w-4" aria-hidden />
       </button>
     </Tooltip>
   </div>
  );
}

function SidebarBody({
  pathname,
  collapsed,
  openGroup,
  setOpenGroup,
  onNavigate,
}: {
  pathname: string | null | undefined;
  collapsed: boolean;
  openGroup: string | null;
  setOpenGroup: (value: string | null) => void;
  onNavigate?: () => void;
}) {
  const { hasPermission } = usePermissionsContext();
  const { user } = useAuth();
  const isPlatformAdmin =
    user?.role === "PLATFORM_ADMIN" || user?.role === "PLATFORM_SUPER_ADMIN";

  const visibleGroups = useMemo(() => {
    return sidebarGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            (!item.permission || hasPermission(item.permission)) &&
            (!item.platformOnly || isPlatformAdmin),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [hasPermission, isPlatformAdmin]);

  useEffect(() => {
    if (collapsed) return;
    for (const group of visibleGroups) {
      if (SIDEBAR_SINGLE_ITEM_GROUPS.has(group.id)) continue;
      if (groupHasActiveChild(pathname, group)) {
        if (openGroup !== group.id) setOpenGroup(group.id);
        return;
      }
    }
  }, [pathname, visibleGroups, openGroup, setOpenGroup, collapsed]);

  if (collapsed) {
    return (
      <nav
        aria-label="Navegação principal"
        className="scrollbar-none flex-1 overflow-y-auto px-2 py-3"
      >
        <ul className="flex flex-col gap-1">
          {visibleGroups.map((group) => (
            <li key={group.id}>
              <CollapsedGroupPopover
                group={group}
                pathname={pathname}
                onNavigate={onNavigate}
              />
           </li>
          ))}
       </ul>
     </nav>
    );
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="scrollbar-none flex-1 overflow-y-auto px-3 py-3"
    >
      <ul className="flex flex-col gap-1">
        {visibleGroups.map((group) => {
          const isSingle = SIDEBAR_SINGLE_ITEM_GROUPS.has(group.id);
          const isOpen = openGroup === group.id;
          const active = groupHasActiveChild(pathname, group);

          if (isSingle) {
            const item = group.items[0];
            return (
              <li key={group.id}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  active={isItemActive(pathname, item)}
                  depth={0}
                  collapsed={false}
                  onNavigate={onNavigate}
                />
             </li>
            );
          }

          return (
            <li key={group.id}>
              <GroupHeader
                group={group}
                open={isOpen}
                onToggle={() => setOpenGroup(isOpen ? null : group.id)}
                active={active}
                collapsed={false}
              />
              <div
                id={`nav-group-${group.id}`}
                role="region"
                aria-label={group.label}
                className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out",
                  isOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <ul className="flex flex-col gap-0.5 pb-1 pl-3 pt-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <NavLink
                        item={item}
                        pathname={pathname}
                        active={isItemActive(pathname, item)}
                        depth={1}
                        collapsed={false}
                        onNavigate={onNavigate}
                      />
                   </li>
                  ))}
               </ul>
             </div>
           </li>
          );
        })}
     </ul>
   </nav>
  );
}

function SidebarInner({
  pathname,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  user,
  onLogout,
}: {
  pathname: string | null | undefined;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
  user: AuthUser | null;
  onLogout: () => Promise<void>;
}) {
  const { openGroup, setOpenGroup } = useSidebarState();
  return (
    <div className="flex h-full flex-col bg-white">
      <SidebarHeader collapsed={collapsed} onToggle={onToggleCollapsed} />
      <SidebarBody
        pathname={pathname}
        collapsed={collapsed}
        openGroup={openGroup}
        setOpenGroup={setOpenGroup}
        onNavigate={onNavigate}
      />
      <UserFooter user={user} collapsed={collapsed} onLogout={onLogout} />
   </div>
  );
}

function Topbar({
  onOpenMenu,
  companies,
  activeCompany,
  onCompanyChange,
  alertCount,
  user,
  onLogout,
}: {
  onOpenMenu: () => void;
  companies: Company[];
  activeCompany?: Company;
  onCompanyChange: (id: string) => void;
  alertCount: number;
  user: AuthUser | null;
  onLogout: () => Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const readiness = useQuery({
    queryKey: ["sync-readiness", activeCompany?.id],
    queryFn: () => getSyncReadiness(activeCompany?.id ?? ""),
    enabled: Boolean(activeCompany?.id),
  });
  const sync = useMutation({
    mutationFn: () => requestSync(activeCompany?.id ?? ""),
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
    await onLogout();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <header className="flex min-h-[82px] items-center gap-3 border-b border-line bg-white px-4 md:px-6">
      <button
        onClick={onOpenMenu}
        className="grid h-11 w-11 place-items-center rounded-xl bg-white text-ink lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
     </button>

      <div className="hidden min-w-[205px] 2xl:block">
        <p className="text-base font-extrabold">Olá, {user?.name.split(" ")[0] || "Contador"}</p>
        <p className="mt-1 text-[10px] text-subtle">Bem-vindo ao portal da contabilidade</p>
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
        <div className="relative hidden h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 lg:flex">
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
        <div className="relative hidden h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 text-left md:flex">
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
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-subtle hover:text-ink"
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
          className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-1.5 pr-3 text-ink"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-xs font-extrabold text-ink">
            {user?.name.slice(0, 2).toUpperCase() || "FN"}
         </span>
          <span className="hidden text-left 2xl:block"><span className="block text-[10px] font-extrabold">{user?.name || "Fabian"}</span><span className="block text-[8px] font-semibold text-subtle">{user?.role || "Contador"}</span></span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-subtle 2xl:block" />
       </button>
          {profileOpen && (
            <div className="absolute right-0 top-14 z-40 w-56 rounded-2xl border border-line bg-surface p-2 shadow-card">
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

function formatSegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <div className="border-b border-line bg-white px-4 py-3 md:px-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <Link href="/dashboard" className="text-subtle hover:text-ink">
          Dashboard
       </Link>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const item = ALL_SIDEBAR_ITEMS.find((navItem) => navItem.href === href);
          const isLast = index === segments.length - 1;

          return (
            <span key={href} className="flex items-center gap-2">
              <span className="text-subtle">/</span>
              {isLast ? (
                <span className="text-ink">{item?.label ?? formatSegment(segment)}</span>
              ) : (
                <Link href={href} className="text-subtle hover:text-ink">
                  {item?.label ?? formatSegment(segment)}
               </Link>
              )}
           </span>
          );
        })}
     </nav>
   </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, signOut, user } = useAuth();
  const {
    activeCompany,
    activeCompanyId,
    companies,
    isSuccess: isCompanyQuerySuccess,
    selectCompany,
  } = useCompanyContext();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const { collapsed, toggle } = useSidebarState();

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    setReady(true);
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    if (
      ready &&
      !activeCompanyId &&
      isCompanyQuerySuccess &&
      companies.length === 0
    ) {
      router.replace("/onboarding");
    }
  }, [ready, activeCompanyId, isCompanyQuerySuccess, companies.length, router]);

  if (!ready) return <div className="min-h-screen animate-pulse bg-canvas" />;

  const alertCount = activeCompany?._count?.alerts ?? 0;

  function changeCompany(id: string) {
    selectCompany(id);
    notify({ title: "Empresa alterada", description: "Os dados fiscais foram atualizados." });
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div
        className="mx-auto flex min-h-screen max-w-[1920px] overflow-hidden bg-surface"
        style={
          {
            "--sidebar-width": "288px",
            "--sidebar-collapsed-width": "76px",
          } as React.CSSProperties
        }
      >
        <aside
          aria-label="Menu lateral"
          className={cn(
            "hidden shrink-0 flex-col overflow-hidden border-r border-line bg-white transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
          )}
        >
          <SidebarInner
            pathname={pathname}
            collapsed={collapsed}
            onToggleCollapsed={toggle}
            user={user}
            onLogout={signOut}
          />
       </aside>

        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent
            className="left-0 top-0 m-0 h-screen w-[var(--sidebar-width)] max-w-none translate-x-0 translate-y-0 rounded-none border-r border-line bg-white p-0"
          >
            <DialogTitle className="sr-only">Menu de navegação</DialogTitle>
            <SidebarInner
              pathname={pathname}
              collapsed={false}
              onToggleCollapsed={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              user={user}
              onLogout={signOut}
            />
         </DialogContent>
       </Dialog>

        <div className="min-w-0 flex-1">
          <Topbar
            onOpenMenu={() => setMobileOpen(true)}
            companies={companies}
            activeCompany={activeCompany}
            onCompanyChange={changeCompany}
            alertCount={alertCount}
            user={user}
            onLogout={signOut}
          />
          <Breadcrumbs />
          <main className="px-4 pb-10 pt-4 md:px-5">{children}</main>
       </div>
     </div>
   </div>
  );
}
