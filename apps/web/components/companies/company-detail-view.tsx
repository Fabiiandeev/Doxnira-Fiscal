"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileKey2, RefreshCw } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompany, updateCompany } from "@/lib/services/company-service";
import { formatDate, maskCnpj } from "@/lib/utils";

export function CompanyDetailView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["company", id], queryFn: () => getCompany(id) });
  const toggle = useMutation({
    mutationFn: () =>
      updateCompany(id, { status: query.data?.status === "active" ? "inactive" : "active" }),
    onSuccess: () => {
      notify({ title: "Empresa atualizada" });
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
  if (!query.data) return <div className="h-96 animate-pulse rounded-3xl bg-white/50" />;
  const company = query.data;
  return (
    <>
      <Link href="/companies" className="mb-5 inline-flex items-center gap-2 text-[11px] font-extrabold text-subtle">
        <ArrowLeft className="h-4 w-4" />Voltar para empresas
      </Link>
      <PageHeader
        eyebrow={company.status === "active" ? "Empresa ativa" : "Empresa inativa"}
        title={company.legalName}
        description={`${maskCnpj(company.cnpj)} · Ambiente de ${company.environment}`}
        icon={Building2}
        action={<Button variant="lime" onClick={() => toggle.mutate()}>{company.status === "active" ? "Desativar empresa" : "Ativar empresa"}</Button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Info icon={RefreshCw} label="Último NSU" value={company.nfeLastNsu} />
        <Info icon={FileKey2} label="Última sincronização" value={company.lastSyncAt ? formatDate(company.lastSyncAt, true) : "Nunca"} />
        <Info icon={Building2} label="Regime / UF" value={`${company.taxRegime || "Não informado"} · ${company.uf || "—"}`} />
      </div>
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof RefreshCw; label: string; value: string }) {
  return <Card className="p-5"><Icon className="h-4 w-4 text-subtle" /><p className="mt-5 text-[10px] font-bold text-subtle">{label}</p><p className="mt-1 break-all text-sm font-extrabold">{value}</p></Card>;
}
