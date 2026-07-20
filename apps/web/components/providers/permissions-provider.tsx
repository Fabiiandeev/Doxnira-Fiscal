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
  ACCOUNTANT: ["dashboard:read", "fiscal:read", "accountant:write", "reports:read", "mdfe:read"],
  OPERATOR: ["dashboard:read", "fiscal:write", "commerce:write", "mdfe:read", "mdfe:create", "mdfe:update", "mdfe:validate"],
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
