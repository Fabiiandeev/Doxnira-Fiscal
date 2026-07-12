"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileKey2, Power } from "lucide-react";
import Link from "next/link";

import { CompanyCertificateSection } from "@/components/companies/company-certificate-section";
import { CompanyValidationPanel } from "@/components/companies/company-validation-panel";
import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompany, updateCompany } from "@/lib/services/company-service";
import { maskCnpj } from "@/lib/utils";

export function CompanySettingsView({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
  });
  const toggle = useMutation({
    mutationFn: () =>
      updateCompany(companyId, {
        status: query.data?.status === "active" ? "inactive" : "active",
      }),
    onSuccess: () => {
      notify({ title: "Status da empresa atualizado" });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) =>
      notify({ title: "Status não atualizado", description: error.message, tone: "error" }),
  });

  if (query.isLoading || !query.data) {
    return <div className="h-96 animate-pulse rounded-3xl bg-white/50" />;
  }

  const company = query.data;

  return (
    <div className="space-y-5">
      <Link href={`/companies/${company.id}`} className="inline-flex items-center gap-2 text-[11px] font-extrabold text-subtle">
        <ArrowLeft className="h-4 w-4" />
        Voltar para detalhes
      </Link>
      <PageHeader
        eyebrow="Configurações da empresa"
        title={company.tradeName || company.legalName}
        description={`${maskCnpj(company.cnpj)} · status, certificado e preferências operacionais.`}
        icon={Building2}
        action={
          <Button variant="outline" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
            <Power className="h-4 w-4" />
            {company.status === "active" ? "Inativar" : "Ativar"}
          </Button>
        }
      />
      <CompanyValidationPanel companyId={company.id} initialValidation={company.validation} />
      <CompanyCertificateSection company={company} />
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <FileKey2 className="h-4 w-4" />
          Atalhos
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="lime">
            <Link href={`/companies/${company.id}/edit`}>Editar empresa</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/companies/${company.id}/fiscal`}>Configuração fiscal</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/documents?companyId=${company.id}`}>Documentos fiscais</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
