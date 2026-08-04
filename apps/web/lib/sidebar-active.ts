import { sidebarGroups, type SidebarItem, type SidebarGroup } from "@/lib/sidebar-navigation";

export const SIDEBAR_SINGLE_ITEM_GROUPS = new Set<string>(["dashboard"]);

export const ALL_SIDEBAR_ITEMS: SidebarItem[] = sidebarGroups.flatMap((group) => group.items);

export function isRouteActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const clean = pathname.split("?")[0].replace(/\/+$/, "");
  const target = href.replace(/\/+$/, "");
  if (clean === target) return true;
  // Avoid naive prefix match for short roots like "/" or "/dashboard".
  if (target === "/dashboard" || target === "/") return false;
  return clean === target || clean.startsWith(`${target}/`);
}

export function isItemActive(pathname: string | null | undefined, item: SidebarItem): boolean {
  if (!item.href) return false;
  return isRouteActive(pathname, item.href);
}

export function groupHasActiveChild(
  pathname: string | null | undefined,
  group: SidebarGroup,
): boolean {
  return group.items.some((item) => isItemActive(pathname, item));
}

export function findActiveTopItem(pathname: string | null | undefined): SidebarItem | undefined {
  return ALL_SIDEBAR_ITEMS.find((item) => isItemActive(pathname, item));
}
