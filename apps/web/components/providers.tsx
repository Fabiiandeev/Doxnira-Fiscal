"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AuthProvider } from "@/components/providers/auth-provider";
import { CompanyProvider } from "@/components/providers/company-provider";
import { ConfirmDialogProvider } from "@/components/providers/confirm-dialog-provider";
import { LoadingProvider } from "@/components/providers/loading-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { PermissionProvider } from "@/components/providers/permissions-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ErrorBoundary } from "@/components/system/error-boundary";
import { ToastViewport } from "@/components/toast-viewport";
import { primeSession, type SessionUser } from "@/lib/api";
import { installBrowserStorageShim } from "@/lib/browser-storage-shim";
import { cleanStaleMockStorage } from "@/lib/safe-storage";

installBrowserStorageShim();

export function Providers({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: {
    token: string | null;
    companyId: string | null;
    user: SessionUser | null;
  };
}) {
  primeSession({
    token: initialSession?.token ?? null,
    companyId: initialSession?.companyId ?? null,
    user: initialSession?.user ?? null,
  });

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 3,
            gcTime: 1000 * 60 * 15,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => { cleanStaleMockStorage(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <PermissionProvider>
              <CompanyProvider>
                <LoadingProvider>
                  <ModalProvider>
                    <ConfirmDialogProvider>
                      {children}
                      <ToastViewport />
                    </ConfirmDialogProvider>
                  </ModalProvider>
                </LoadingProvider>
              </CompanyProvider>
            </PermissionProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
