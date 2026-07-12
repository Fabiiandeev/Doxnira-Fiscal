"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileKey2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CompanyCertificateSection } from "@/components/companies/company-certificate-section";
import { CompanyValidationPanel } from "@/components/companies/company-validation-panel";
import { CnpjLookupForm } from "@/components/companies/cnpj-lookup-form";
import { CompanyTaxSettingsSection } from "@/components/companies/company-tax-settings-section";
import { RemoveCompanyDialog } from "@/components/companies/remove-company-dialog";
import { PageHeader } from "@/components/page-header";
import { useConfirmDialog } from "@/components/providers/confirm-dialog-provider";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCompany, updateCompany } from "@/lib/services/company-service";
import {
  lookupToCompanyForm,
  lookupToCompanyPayload,
  type CnpjLookupResponse,
} from "@/lib/services/cnpj-service";
import { formatDate, maskCnpj } from "@/lib/utils";

export function CompanyDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    legalName: "",
    tradeName: "",
    cnpj: "",
    uf: "",
    city: "",
    stateRegistration: "",
    environment: "homologation" as "homologation" | "production",
  });
  const [productionConfirmed, setProductionConfirmed] = useState(false);
  const [lookupData, setLookupData] = useState<CnpjLookupResponse | null>(null);
  const query = useQuery({ queryKey: ["company", id], queryFn: () => getCompany(id) });
  useEffect(() => {
    if (!query.data) return;
    setForm({
      legalName: query.data.legalName,
      tradeName: query.data.tradeName || "",
      cnpj: query.data.cnpj,
      uf: query.data.uf || "",
      city: query.data.city || "",
      stateRegistration:
        query.data.stateRegistrationFormatted ||
        query.data.stateRegistration ||
        "",
      environment: query.data.environment,
    });
    setProductionConfirmed(query.data.environment === "production");
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => {
      const cnpj = form.cnpj.replace(/\D/g, "");
      if (cnpj.length !== 14) throw new Error("Informe um CNPJ válido.");
      if (
        form.environment === "production" &&
        !productionConfirmed
      ) {
        throw new Error("Confirme o uso do ambiente fiscal de produção.");
      }
      const lookupPayload = lookupData
        ? lookupToCompanyPayload(lookupData)
        : null;
      return updateCompany(id, {
        ...form,
        ...(lookupPayload ?? {}),
        cnpj,
        uf: form.uf.toUpperCase(),
        stateRegistration:
          lookupPayload?.stateRegistration ||
          form.stateRegistration.replace(/\D/g, "") ||
          null,
        stateRegistrationFormatted:
          lookupPayload?.stateRegistrationFormatted ||
          form.stateRegistration ||
          null,
        stateRegistrationStatus:
          lookupPayload?.stateRegistrationStatus ||
          query.data?.stateRegistrationStatus,
        stateRegistrationSource:
          lookupPayload?.stateRegistrationSource ||
          query.data?.stateRegistrationSource,
        icmsContributorStatus:
          lookupPayload?.icmsContributorStatus ||
          query.data?.icmsContributorStatus,
        taxRegime: lookupPayload?.taxRegime || query.data?.taxRegime,
      });
    },
    onSuccess: () => {
      notify({ title: "Empresa atualizada" });
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["sync-readiness"] });
    },
    onError: (error) =>
      notify({ title: "Empresa não atualizada", description: error.message, tone: "error" }),
  });
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
  async function confirmToggleStatus() {
    const nextStatus = company.status === "active" ? "inactive" : "active";
    const confirmed = await confirm({
      title: nextStatus === "inactive" ? "Inativar empresa" : "Ativar empresa",
      description:
        nextStatus === "inactive"
          ? "A empresa ficará indisponível para novas operações até ser ativada novamente."
          : "A empresa voltará a ficar disponível para operações do sistema.",
      confirmLabel: nextStatus === "inactive" ? "Inativar" : "Ativar",
      tone: nextStatus === "inactive" ? "danger" : "default",
    });
    if (confirmed) toggle.mutate();
  }
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
        action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/companies/${company.id}/edit`}>Editar</Link></Button><Button asChild variant="outline"><Link href={`/companies/${company.id}/fiscal`}>Configuração fiscal</Link></Button><Button asChild variant="outline"><Link href={`/companies/${company.id}/settings`}>Certificado</Link></Button><Button variant="outline" onClick={confirmToggleStatus} disabled={toggle.isPending}>{company.status === "active" ? "Desativar empresa" : "Ativar empresa"}</Button><RemoveCompanyDialog company={company} onRemoved={() => router.push("/companies")} /></div>}
      />
      <div className="mb-4">
        <CompanyValidationPanel companyId={company.id} initialValidation={company.validation} />
      </div>
      <Card className="mb-4 p-5 md:p-6">
        <h2 className="text-sm font-extrabold">1. Dados da empresa</h2>
        <div className="mt-5 rounded-2xl border border-line p-4">
          <CnpjLookupForm
            onDataLoaded={(data) => {
              const fields = lookupToCompanyForm(data);
              setLookupData(data);
              setForm((current) => ({
                ...current,
                legalName: fields.legalName || current.legalName,
                tradeName: fields.tradeName || current.tradeName,
                cnpj: fields.cnpj,
                city: fields.city || current.city,
                uf: fields.uf || current.uf,
                stateRegistration:
                  fields.stateRegistration || current.stateRegistration,
                environment: fields.environment,
              }));
            }}
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label><span className="mb-2 block text-[11px] font-extrabold">Razão social</span><Input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></label>
          <label><span className="mb-2 block text-[11px] font-extrabold">Nome fantasia</span><Input value={form.tradeName} onChange={(event) => setForm({ ...form, tradeName: event.target.value })} /></label>
          <label><span className="mb-2 block text-[11px] font-extrabold">CNPJ</span><Input id="company-cnpj" value={form.cnpj} onChange={(event) => setForm({ ...form, cnpj: event.target.value })} /></label>
          <label><span className="mb-2 block text-[11px] font-extrabold">Cidade</span><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
          <label><span className="mb-2 block text-[11px] font-extrabold">UF</span><Input maxLength={2} value={form.uf} onChange={(event) => setForm({ ...form, uf: event.target.value.toUpperCase() })} /></label>
          <label><span className="mb-2 block text-[11px] font-extrabold">Inscrição Estadual</span><Input value={form.stateRegistration} onChange={(event) => setForm({ ...form, stateRegistration: event.target.value })} /></label>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <h2 className="text-sm font-extrabold">2. Ambiente fiscal</h2>
          <select value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value as "homologation" | "production" })} className="mt-4 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none md:max-w-sm"><option value="homologation">Homologação</option><option value="production">Produção</option></select>
        </div>
        {form.environment === "production" && (
          <label className="mt-4 flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={productionConfirmed}
              onChange={(event) => setProductionConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            Confirmo que desejo configurar esta empresa para ambiente de produção.
          </label>
        )}
        <div className="mt-5 flex justify-end"><Button variant="lime" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar alterações"}</Button></div>
      </Card>
      <CompanyTaxSettingsSection
        companyId={company.id}
        companyUf={company.uf}
        stateRegistration={
          company.stateRegistrationFormatted || company.stateRegistration
        }
        lookupData={lookupData}
      />
      <CompanyCertificateSection company={company} />
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
