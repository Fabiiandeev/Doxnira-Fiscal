"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { apiFetch, setSessionUser } from "@/lib/api";
import { getStoredUser, logout, type AuthUser } from "@/lib/services/auth-service";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession() {
  return { user: getStoredUser() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(readSession);
  const [isSessionResolved, setIsSessionResolved] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const result = await apiFetch<{ user: AuthUser }>("/auth/me");
      setSessionUser(result.user);
      setSession({ user: result.user });
    } catch {
      setSessionUser(null);
      setSession({ user: null });
    } finally {
      setIsSessionResolved(true);
    }
  }, []);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  const signOut = useCallback(async () => {
    await logout();
    queryClient.clear();
    setSession({ user: null });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      isAuthenticated: Boolean(session.user),
      isLoading: !isSessionResolved,
      refreshSession,
      signOut,
    }),
    [isSessionResolved, refreshSession, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
