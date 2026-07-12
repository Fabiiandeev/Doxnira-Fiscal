"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { getCompanyId, setCompanyId } from "@/lib/api";
import { listCompanies, type Company } from "@/lib/services/company-service";

type CompanyContextValue = {
  companies: Company[];
  activeCompany: Company | undefined;
  activeCompanyId: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  selectCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => getCompanyId());
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
    enabled: Boolean(token),
  });

  const companies = useMemo(() => companiesQuery.data?.data ?? [], [companiesQuery.data?.data]);

  const selectCompany = useCallback(
    (companyId: string) => {
      setCompanyId(companyId);
      setActiveCompanyId(companyId);
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  useEffect(() => {
    const firstCompanyId = companies[0]?.id;
    if (!activeCompanyId && firstCompanyId) {
      selectCompany(firstCompanyId);
    }
  }, [activeCompanyId, companies, selectCompany]);

  useEffect(() => {
    function onCompanyChanged(event: Event) {
      setActiveCompanyId((event as CustomEvent<string>).detail);
    }

    window.addEventListener("ns-fiscal-company-changed", onCompanyChanged);
    return () => window.removeEventListener("ns-fiscal-company-changed", onCompanyChanged);
  }, []);

  const activeCompany =
    companies.find((company) => company.id === activeCompanyId) ?? companies[0];

  const value = useMemo<CompanyContextValue>(
    () => ({
      companies,
      activeCompany,
      activeCompanyId: activeCompany?.id ?? activeCompanyId,
      isLoading: companiesQuery.isLoading,
      isSuccess: companiesQuery.isSuccess,
      selectCompany,
      refreshCompanies: async () => {
        await queryClient.invalidateQueries({ queryKey: ["companies"] });
      },
    }),
    [
      activeCompany,
      activeCompanyId,
      companies,
      companiesQuery.isLoading,
      companiesQuery.isSuccess,
      queryClient,
      selectCompany,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("useCompanyContext deve ser usado dentro de CompanyProvider.");
  return context;
}
