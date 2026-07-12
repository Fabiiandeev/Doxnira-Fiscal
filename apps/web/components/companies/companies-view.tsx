"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  FileKey2,
  FileText,
  Pencil,
  Settings,
  ShieldAlert,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  SmartDashboardGrid,
  SmartEmpty,
  SmartEmptyActions,
  SmartFilter,
  SmartMetricCard,
  SmartSearch,
  SmartSelect,
  SmartStatus,
  SmartTable,
  type SmartTableColumn,
} from "@/components/smart";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/use-company";
import { useConfirmDialog } from "@/components/providers/confirm-dialog-provider";
import { listCompanies, updateCompany, type Company } from "@/lib/services/company-service";
import { formatDate, maskCnpj } from "@/lib/utils";

type CertificateFilter = "all" | "with" | "without" | "expiring";
type RiskFilter = "all" | "ready" | "attention" | "blocked";

function taxRegimeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    SIMPLES_NACIONAL: "Simples Nacional",
    LUCRO_PRESUMIDO: "Lucro Presumido",
    LUCRO_REAL: "Lucro Real",
    MEI: "MEI",
    OUTRO: "Outro",
    PENDENTE_CONFIRMACAO: "Pendente",
  };
  return value ? labels[value] ?? value : "Não informado";
}

function statusLabel(value: Company["validation"] | undefined) {
  if (!value) return { label: "Não validado", tone: "neutral" as const };
  if (value.status === "ready") return { label: "Pronta", tone: "success" as const };
  if (value.status === "blocked") return { label: "Bloqueada", tone: "danger" as const };
  return { label: "Atenção", tone: "warning" as const };
}

function certificateStatus(company: Company) {
  const certificate = company.certificate;
  if (!certificate) return { label: "Sem certificado", tone: "neutral" as const, expiring: false };
  if (certificate.validUntil && new Date(certificate.validUntil) < new Date()) {
    return { label: "Vencido", tone: "danger" as const, expiring: true };
  }
  const expiringLimit = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiring = certificate.validUntil
    ? new Date(certificate.validUntil) <= expiringLimit
    : false;
  return {
    label: expiring ? "Vencendo" : "Válido",
    tone: expiring ? ("warning" as const) : ("success" as const),
    expiring,
  };
}

function companyMatchesSearch(company: Company, search: string) {
  const value = search.trim().toLowerCase();
  if (!value) return true;
  return [
    company.legalName,
    company.tradeName,
    company.cnpj,
    company.city,
    company.uf,
  ]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(value));
}

export function CompaniesView() {
  const queryClient = useQueryClient();
  const { confirm } = useConfirmDialog();
  const { activeCompanyId, selectCompany } = useCompany();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [taxRegime, setTaxRegime] = useState("all");
  const [uf, setUf] = useState("all");
  const [certificate, setCertificate] = useState<CertificateFilter>("all");
  const [risk, setRisk] = useState<RiskFilter>("all");

  const query = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const companies = useMemo(() => query.data?.data ?? [], [query.data?.data]);

  const inactivate = useMutation({
    mutationFn: (company: Company) => updateCompany(company.id, { status: "inactive" }),
    onSuccess: () => {
      notify({ title: "Empresa inativada" });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) =>
      notify({ title: "Empresa não inativada", description: error.message, tone: "error" }),
  });

  const filtered = useMemo(
    () =>
      companies.filter((company) => {
        const certificateInfo = certificateStatus(company);
        const validationStatus = company.validation?.status ?? "attention";
        return (
          companyMatchesSearch(company, search) &&
          (status === "all" || company.status === status) &&
          (taxRegime === "all" || company.taxRegime === taxRegime) &&
          (uf === "all" || company.uf === uf) &&
          (certificate === "all" ||
            (certificate === "with" && Boolean(company.certificate)) ||
            (certificate === "without" && !company.certificate) ||
            (certificate === "expiring" && certificateInfo.expiring)) &&
          (risk === "all" || validationStatus === risk)
        );
      }),
    [certificate, companies, risk, search, status, taxRegime, uf],
  );

  const ufs = [
    ...new Set(companies.map((company) => company.uf).filter((value): value is string => Boolean(value))),
  ].sort();
  const taxRegimes = [
    ...new Set(companies.map((company) => company.taxRegime).filter((value): value is string => Boolean(value))),
  ].sort();
  const activeCount = companies.filter((company) => company.status === "active").length;
  const pendingCount = companies.filter((company) => (company.validation?.issues.length ?? 0) > 0).length;
  const expiringCertificates = companies.filter((company) => certificateStatus(company).expiring).length;
  const readyForClosing = companies.filter(
    (company) => company.validation?.summary.readyForClosing,
  ).length;

  async function handleInactivate(company: Company) {
    const confirmed = await confirm({
      title: "Inativar empresa",
      description: `A empresa ${company.tradeName || company.legalName} deixará de aparecer como ativa. Você poderá reativá-la depois.`,
      confirmLabel: "Inativar",
      tone: "danger",
    });
    if (confirmed) inactivate.mutate(company);
  }

  function handleSelectCompany(company: Company) {
    selectCompany(company.id);
    notify({
      title: "Empresa ativa alterada",
      description: company.tradeName || company.legalName,
    });
  }

  const columns: SmartTableColumn<Company>[] = [
    {
      id: "company",
      header: "Empresa",
      cell: (company) => (
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/companies/${company.id}`} className="font-extrabold hover:underline">
              {company.tradeName || company.legalName}
            </Link>
            {activeCompanyId === company.id && <SmartStatus label="Ativa" tone="lime" />}
          </div>
          <p className="mt-1 text-xs text-subtle">{company.legalName}</p>
        </div>
      ),
    },
    { id: "cnpj", header: "CNPJ", cell: (company) => maskCnpj(company.cnpj) },
    {
      id: "location",
      header: "UF/Cidade",
      cell: (company) => `${company.uf || "—"} / ${company.city || "—"}`,
    },
    {
      id: "taxRegime",
      header: "Regime",
      cell: (company) => taxRegimeLabel(company.taxRegime),
    },
    {
      id: "fiscalStatus",
      header: "Status fiscal",
      cell: (company) => {
        const statusInfo = statusLabel(company.validation);
        return <SmartStatus label={statusInfo.label} tone={statusInfo.tone} />;
      },
    },
    {
      id: "certificate",
      header: "Certificado",
      cell: (company) => {
        const statusInfo = certificateStatus(company);
        return <SmartStatus label={statusInfo.label} tone={statusInfo.tone} />;
      },
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      cell: (company) => company.validation?.score ?? "—",
    },
    {
      id: "updated",
      header: "Última atualização",
      cell: (company) => company.updatedAt ? formatDate(company.updatedAt, true) : "—",
    },
    {
      id: "actions",
      header: "Ações",
      cell: (company) => (
        <div className="flex min-w-[260px] flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/companies/${company.id}`}>Ver detalhes</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" aria-label="Editar empresa">
            <Link href={`/companies/${company.id}/edit`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/companies/${company.id}/fiscal`}>Fiscal</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/companies/${company.id}/settings`}>Certificado</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/documents?companyId=${company.id}`}>Documentos</Link>
          </Button>
          {company.status === "active" ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleInactivate(company)}
              disabled={inactivate.isPending}
            >
              Inativar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSelectCompany(company)}
            >
              Selecionar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cadastros"
        title="Empresas"
        description="Gerencie as empresas vinculadas ao sistema."
        icon={Building2}
        action={
          <Button asChild variant="lime">
            <Link href="/companies/new">Nova empresa</Link>
          </Button>
        }
      />

      <SmartDashboardGrid className="xl:grid-cols-5">
        <SmartMetricCard label="Total de empresas" value={companies.length} icon={Building2} />
        <SmartMetricCard label="Ativas" value={activeCount} icon={CheckCircle2} tone="success" />
        <SmartMetricCard label="Com pendências" value={pendingCount} icon={ShieldAlert} tone={pendingCount ? "warning" : "success"} />
        <SmartMetricCard label="Certificados vencendo" value={expiringCertificates} icon={FileKey2} tone={expiringCertificates ? "warning" : "success"} />
        <SmartMetricCard label="Prontas para fechamento" value={readyForClosing} icon={Star} tone="success" />
      </SmartDashboardGrid>

      <SmartFilter>
        <SmartSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar razão social, fantasia, CNPJ, cidade ou UF"
          className="xl:col-span-2"
        />
        <SmartSelect value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </SmartSelect>
        <SmartSelect value={taxRegime} onChange={(event) => setTaxRegime(event.target.value)}>
          <option value="all">Todos os regimes</option>
          {taxRegimes.map((regime) => (
            <option key={regime} value={regime}>
              {taxRegimeLabel(regime)}
            </option>
          ))}
        </SmartSelect>
        <SmartSelect value={uf} onChange={(event) => setUf(event.target.value)}>
          <option value="all">Todas as UFs</option>
          {ufs.map((state) => (
            <option key={state} value={state ?? ""}>
              {state}
            </option>
          ))}
        </SmartSelect>
        <SmartSelect
          value={certificate}
          onChange={(event) => setCertificate(event.target.value as CertificateFilter)}
        >
          <option value="all">Todos os certificados</option>
          <option value="with">Com certificado</option>
          <option value="without">Sem certificado</option>
          <option value="expiring">Vencendo</option>
        </SmartSelect>
        <SmartSelect value={risk} onChange={(event) => setRisk(event.target.value as RiskFilter)}>
          <option value="all">Todos os riscos</option>
          <option value="ready">Prontas</option>
          <option value="attention">Atenção</option>
          <option value="blocked">Bloqueadas</option>
        </SmartSelect>
      </SmartFilter>

      <SmartTable
        columns={columns}
        data={filtered}
        rowKey={(company) => company.id}
        isLoading={query.isLoading}
        empty={
          <SmartEmpty
            title={companies.length === 0 ? "Nenhuma empresa cadastrada." : "Nenhuma empresa encontrada."}
            description={
              companies.length === 0
                ? "Cadastre sua primeira empresa para iniciar emissão, sincronização fiscal e fechamento."
                : "Ajuste os filtros para visualizar outras empresas."
            }
            actions={
              companies.length === 0 ? (
                <SmartEmptyActions onCreate={() => window.location.assign("/companies/new")} />
              ) : undefined
            }
          />
        }
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["companies"] })}>
          Atualizar listagem
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            notify({
              title: "Exportação em preparação",
              description: "A estrutura de exportação será conectada ao relatório de empresas.",
            })
          }
        >
          <FileText className="h-4 w-4" />
          Exportar
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Preferências
          </Link>
        </Button>
      </div>
    </div>
  );
}
