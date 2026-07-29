"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAuth } from "@/components/providers/auth-provider";

type PermissionContextValue = {
  role: string | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
};

const rolePermissions: Record<string, string[]> = {
  OWNER: ["*"],
  ADMIN: ["*"],
  PLATFORM_ADMIN: ["*"],
  PLATFORM_SUPER_ADMIN: ["*"],
  ACCOUNTANT: [
    "dashboard:read", "fiscal:read", "accountant:write", "reports:read",
    "fiscal.mdfe.read", "fiscal.mdfe.download_xml", "fiscal.mdfe.download_damdfe",
  ],
  OPERATOR: [
    "dashboard:read", "fiscal:write", "commerce:write",
    "fiscal.mdfe.read", "fiscal.mdfe.create", "fiscal.mdfe.update",
    "fiscal.mdfe.events", "fiscal.mdfe.download_xml", "fiscal.mdfe.download_damdfe",
  ],
  VIEWER: ["dashboard:read", "reports:read"],
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role = user?.role?.toUpperCase() ?? null;
  const permissions = useMemo(
    () => (role ? rolePermissions[role] ?? ["dashboard:read"] : []),
    [role],
  );

  const value = useMemo<PermissionContextValue>(
    () => ({
      role,
      permissions,
      hasPermission: (permission) =>
        permissions.includes("*") ||
        permissions.includes(permission) ||
        permissions.includes(`${permission.split(":")[0]}:*`),
    }),
    [permissions, role],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissionsContext() {
  const context = useContext(PermissionContext);
  if (!context) throw new Error("usePermissionsContext deve ser usado dentro de PermissionProvider.");
  return context;
}
