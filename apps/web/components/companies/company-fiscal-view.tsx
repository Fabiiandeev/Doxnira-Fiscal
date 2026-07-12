"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calculator, FileText } from "lucide-react";
import Link from "next/link";

import { CompanyTaxSettingsSection } from "@/components/companies/company-tax-settings-section";
import { CompanyValidationPanel } from "@/components/companies/company-validation-panel";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompany } from "@/lib/services/company-service";
import { maskCnpj } from "@/lib/utils";

export function CompanyFiscalView({ companyId }: { companyId: string }) {
  const query = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
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
        eyebrow="Configuração fiscal"
        title={company.tradeName || company.legalName}
        description={`${maskCnpj(company.cnpj)} · revise regime, CRT, CNAE, inscrições e parâmetros fiscais.`}
        icon={Calculator}
        action={
          <Button asChild variant="outline">
            <Link href={`/documents?companyId=${company.id}`}>
              <FileText className="h-4 w-4" />
              Ver documentos
            </Link>
          </Button>
        }
      />
      <CompanyValidationPanel companyId={company.id} initialValidation={company.validation} />
      <CompanyTaxSettingsSection
        companyId={company.id}
        companyUf={company.uf}
        stateRegistration={company.stateRegistrationFormatted || company.stateRegistration}
      />
      <Card className="p-5">
        <h2 className="text-sm font-extrabold">Ações fiscais</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="lime">
            <Link href={`/companies/${company.id}/edit`}>Editar cadastro</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/companies/${company.id}/settings`}>Gerenciar certificado</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
