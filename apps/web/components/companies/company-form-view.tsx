"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileKey2,
  Save,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CnpjLookupForm } from "@/components/companies/cnpj-lookup-form";
import { PageHeader } from "@/components/page-header";
import { SmartStatus } from "@/components/smart";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createCompany,
  getCompany,
  updateCompany,
  type Company,
  type CompanyValidationIssue,
} from "@/lib/services/company-service";
import { uploadCertificate } from "@/lib/services/certificate-service";
import {
  lookupToCompanyForm,
  lookupToCompanyPayload,
  lookupToTaxSettings,
  type CnpjLookupResponse,
} from "@/lib/services/cnpj-service";
import { saveCompanyFiscalSettings } from "@/lib/services/company-fiscal-settings-service";
import type { CompanyTaxSettings } from "@/lib/types";
import { isValidCnpj, normalizeCnpj } from "@/lib/utils";

const selectClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none";

type CompanyDraft = {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  branchType: "matriz" | "filial";
  openingDate: string;
  legalNature: string;
  companySize: string;
  registrationStatus: string;
  status: "active" | "inactive";
  notes: string;
  city: string;
  uf: string;
  stateRegistration: string;
  taxRegime: string;
  environment: "homologation" | "production";
};

type FiscalDraft = {
  crt: "1" | "2" | "3" | "4" | "";
  simples: boolean;
  sublimiteExceeded: boolean;
  presumedProfit: boolean;
  realProfit: boolean;
  mei: boolean;
  mainCnae: string;
  secondaryCnaes: string;
  municipalRegistration: string;
  ieIndicator: "SIM" | "NAO" | "ISENTO" | "";
  fiscalUf: string;
  ibgeCityCode: string;
  emissionType: string;
  nfeSeries: string;
  nfceSeries: string;
  nfseSeries: string;
  nextNfeNumber: string;
  nextNfceNumber: string;
  nextNfseNumber: string;
  simplesPercent: string;
  simplesAnnex: string;
  revenueRange: string;
  fatorR: string;
  accountant: string;
  isIcmsTaxpayer: boolean;
  providesService: boolean;
};

type AddressDraft = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  country: string;
};

type ContactDraft = {
  email: string;
  phone: string;
  whatsapp: string;
  fiscalResponsible: string;
  fiscalEmail: string;
  financialResponsible: string;
  financialEmail: string;
};

const emptyCompany: CompanyDraft = {
  id: "",
  legalName: "",
  tradeName: "",
  cnpj: "",
  branchType: "matriz",
  openingDate: "",
  legalNature: "",
  companySize: "",
  registrationStatus: "",
  status: "active",
  notes: "",
  city: "",
  uf: "",
  stateRegistration: "",
  taxRegime: "PENDENTE_CONFIRMACAO",
  environment: "homologation",
};

const emptyFiscal: FiscalDraft = {
  crt: "",
  simples: false,
  sublimiteExceeded: false,
  presumedProfit: false,
  realProfit: false,
  mei: false,
  mainCnae: "",
  secondaryCnaes: "",
  municipalRegistration: "",
  ieIndicator: "",
  fiscalUf: "",
  ibgeCityCode: "",
  emissionType: "NORMAL",
  nfeSeries: "",
  nfceSeries: "",
  nfseSeries: "",
  nextNfeNumber: "",
  nextNfceNumber: "",
  nextNfseNumber: "",
  simplesPercent: "",
  simplesAnnex: "",
  revenueRange: "",
  fatorR: "",
  accountant: "",
  isIcmsTaxpayer: false,
  providesService: false,
};

const emptyAddress: AddressDraft = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  country: "Brasil",
};

const emptyContact: ContactDraft = {
  email: "",
  phone: "",
  whatsapp: "",
  fiscalResponsible: "",
  fiscalEmail: "",
  financialResponsible: "",
  financialEmail: "",
};

function hydrateCompany(company: Company): CompanyDraft {
  return {
    ...emptyCompany,
    id: company.id,
    legalName: company.legalName,
    tradeName: company.tradeName || "",
    cnpj: company.cnpj,
    city: company.city || "",
    uf: company.uf || "",
    fiscalUf: company.uf || "",
    stateRegistration: company.stateRegistrationFormatted || company.stateRegistration || "",
    taxRegime: company.taxRegime || "PENDENTE_CONFIRMACAO",
    environment: company.environment,
    status: company.status === "inactive" ? "inactive" : "active",
  } as CompanyDraft;
}

function hydrateFiscal(company: Company): FiscalDraft {
  const settings = company.taxSettings;
  return {
    ...emptyFiscal,
    crt: (settings?.crt as FiscalDraft["crt"]) || "",
    mainCnae: settings?.mainCnae || "",
    secondaryCnaes: Array.isArray(settings?.secondaryCnaes)
      ? settings.secondaryCnaes.join(", ")
      : "",
    municipalRegistration: settings?.municipalRegistration || "",
    ieIndicator: (settings?.icmsContribType as FiscalDraft["ieIndicator"]) || "",
    fiscalUf: settings?.uf || company.uf || "",
    simples: company.taxRegime === "SIMPLES_NACIONAL",
    presumedProfit: company.taxRegime === "LUCRO_PRESUMIDO",
    realProfit: company.taxRegime === "LUCRO_REAL",
    mei: company.taxRegime === "MEI",
    simplesPercent: settings?.simplesNominalRate != null ? String(settings.simplesNominalRate) : "",
    simplesAnnex: settings?.simplesAnnex || "",
    fatorR: settings?.simplesFatorR != null ? String(settings.simplesFatorR) : "",
    isIcmsTaxpayer: Boolean(settings?.isIcmsTaxpayer),
    providesService: Boolean(settings?.providesService),
  };
}

function makeIssue(input: Omit<CompanyValidationIssue, "id"> & { id: string }) {
  return input;
}

function validateDraft(company: CompanyDraft, fiscal: FiscalDraft, hasCertificate: boolean) {
  const issues: CompanyValidationIssue[] = [];
  if (!isValidCnpj(company.cnpj)) {
    issues.push(makeIssue({
      id: "invalid-cnpj",
      title: "CNPJ inválido",
      explanation: "O CNPJ é obrigatório e deve ter dígitos verificadores válidos.",
      impact: "Bloqueia emissão, sincronização e validação fiscal.",
      field: "cnpj",
      action: "Corrigir CNPJ.",
      severity: "error",
    }));
  }
  if (!company.legalName.trim()) {
    issues.push(makeIssue({
      id: "missing-legal-name",
      title: "Razão social obrigatória",
      explanation: "A empresa precisa de razão social para ser salva com segurança.",
      impact: "Bloqueia o cadastro real.",
      field: "legalName",
      action: "Informar razão social.",
      severity: "error",
    }));
  }
  if (!company.taxRegime || company.taxRegime === "PENDENTE_CONFIRMACAO") {
    issues.push(makeIssue({
      id: "missing-tax-regime",
      title: "Regime tributário não informado",
      explanation: "O regime orienta a configuração fiscal da empresa.",
      impact: "Impede validação fiscal confiável.",
      field: "taxRegime",
      action: "Selecionar regime tributário.",
      severity: "error",
    }));
  }
  if (!fiscal.crt) {
    issues.push(makeIssue({
      id: "missing-crt",
      title: "CRT ausente",
      explanation: "O CRT é exigido antes da emissão de NF-e.",
      impact: "Pode gerar rejeição fiscal.",
      field: "crt",
      action: "Selecionar CRT.",
      severity: "error",
    }));
  }
  if (!company.uf.trim()) {
    issues.push(makeIssue({
      id: "missing-uf",
      title: "UF obrigatória",
      explanation: "A UF define ambiente e regras operacionais.",
      impact: "Bloqueia configuração fiscal mínima.",
      field: "uf",
      action: "Informar UF.",
      severity: "error",
    }));
  }
  if (!company.city.trim()) {
    issues.push(makeIssue({
      id: "missing-city",
      title: "Cidade obrigatória",
      explanation: "A cidade é necessária para o domicílio fiscal.",
      impact: "Pode bloquear NFS-e e cadastros municipais.",
      field: "city",
      action: "Informar cidade.",
      severity: "error",
    }));
  }
  if (!fiscal.ibgeCityCode.trim()) {
    issues.push(makeIssue({
      id: "missing-ibge",
      title: "Código IBGE ausente",
      explanation: "O código IBGE será necessário para documentos fiscais municipais.",
      impact: "Pode bloquear emissão de NFS-e.",
      field: "ibgeCityCode",
      action: "Informar código IBGE.",
      severity: "warning",
    }));
  }
  if (fiscal.isIcmsTaxpayer && !company.stateRegistration.trim()) {
    issues.push(makeIssue({
      id: "missing-ie",
      title: "IE ausente",
      explanation: "Contribuintes de ICMS devem informar inscrição estadual.",
      impact: "Pode bloquear emissão de NF-e.",
      field: "stateRegistration",
      action: "Informar IE.",
      severity: "error",
    }));
  }
  if (fiscal.providesService && !fiscal.municipalRegistration.trim()) {
    issues.push(makeIssue({
      id: "missing-im",
      title: "IM ausente para NFS-e",
      explanation: "Prestadores de serviço precisam preparar inscrição municipal.",
      impact: "Pode bloquear emissão de NFS-e.",
      field: "municipalRegistration",
      action: "Informar IM.",
      severity: "warning",
    }));
  }
  if (!hasCertificate) {
    issues.push(makeIssue({
      id: "missing-certificate",
      title: "Certificado obrigatório para emissão NF-e",
      explanation: "Sem certificado, a empresa fica limitada a cadastros e simulações.",
      impact: "Bloqueia emissão e sincronização real.",
      field: "certificate",
      action: "Gerenciar certificado.",
      severity: "warning",
    }));
  }
  if (!fiscal.mainCnae.trim()) {
    issues.push(makeIssue({
      id: "missing-cnae",
      title: "CNAE principal ausente",
      explanation: "O CNAE principal apoia regras operacionais e municipais.",
      impact: "Reduz confiança da análise.",
      field: "mainCnae",
      action: "Informar CNAE principal.",
      severity: "warning",
    }));
  }
  if (company.taxRegime === "SIMPLES_NACIONAL" && !fiscal.simplesPercent.trim()) {
    issues.push(makeIssue({
      id: "missing-simples-percent",
      title: "Percentual do Simples não informado",
      explanation: "O percentual é exigido para simulações e fechamento.",
      impact: "Mantém cálculos pendentes.",
      field: "simplesPercent",
      action: "Informar percentual do Simples.",
      severity: "warning",
    }));
  }
  return issues;
}

function buildFiscalPayload(company: CompanyDraft, fiscal: FiscalDraft): Partial<CompanyTaxSettings> {
  return {
    taxRegime: company.taxRegime as CompanyTaxSettings["taxRegime"],
    calculationRegime: "COMPETENCIA",
    uf: company.uf.toUpperCase(),
    stateRegistration: company.stateRegistration || null,
    mainCnae: fiscal.mainCnae || null,
    secondaryCnaes: fiscal.secondaryCnaes
      ? fiscal.secondaryCnaes.split(",").map((item) => item.trim()).filter(Boolean)
      : null,
    simplesAnnex: fiscal.simplesAnnex || null,
    mainActivity: null,
    isIcmsTaxpayer: fiscal.isIcmsTaxpayer,
    isIpiTaxpayer: false,
    pisCofinsRegime: company.taxRegime === "SIMPLES_NACIONAL" ? "SIMPLES" : "PENDENTE_CONFIRMACAO",
    accumulatedRevenue: null,
    providesService: fiscal.providesService,
    sellsMerchandise: true,
    municipalRegistration: fiscal.municipalRegistration || null,
    crt: fiscal.crt || null,
    simplesNominalRate: fiscal.simplesPercent ? Number(fiscal.simplesPercent) : null,
    simplesFatorR: fiscal.fatorR ? Number(fiscal.fatorR) : null,
  };
}

export function CompanyFormView({ companyId }: { companyId?: string }) {
  const isEditing = Boolean(companyId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState<CompanyDraft>(emptyCompany);
  const [fiscal, setFiscal] = useState<FiscalDraft>(emptyFiscal);
  const [address, setAddress] = useState<AddressDraft>(emptyAddress);
  const [contact, setContact] = useState<ContactDraft>(emptyContact);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [productionConfirmed, setProductionConfirmed] = useState(false);
  const [lookupData, setLookupData] = useState<CnpjLookupResponse | null>(null);
  const [lastLookupAt, setLastLookupAt] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId ?? ""),
    enabled: isEditing,
  });

  useEffect(() => {
    if (!query.data) return;
    setCompany(hydrateCompany(query.data));
    setFiscal(hydrateFiscal(query.data));
    setProductionConfirmed(query.data.environment === "production");
  }, [query.data]);

  const hasCertificate = Boolean(query.data?.certificate || fileRef.current?.files?.[0]);
  const issues = useMemo(
    () => validateDraft(company, fiscal, hasCertificate),
    [company, fiscal, hasCertificate],
  );
  const blockingIssues = issues.filter((issue) => issue.severity === "error");

  const save = useMutation({
    mutationFn: async ({ configureFiscal }: { configureFiscal: boolean }) => {
      if (blockingIssues.length > 0) {
        throw new Error("Corrija as pendências obrigatórias antes de salvar.");
      }
      if (company.environment === "production" && !productionConfirmed) {
        throw new Error("Confirme o uso do ambiente fiscal de produção.");
      }
      const cnpj = normalizeCnpj(company.cnpj);
      const lookupPayload = lookupData ? lookupToCompanyPayload(lookupData) : null;
      const payload = {
        legalName: company.legalName.trim(),
        tradeName: company.tradeName.trim() || undefined,
        cnpj,
        uf: company.uf.toUpperCase(),
        city: company.city.trim(),
        stateRegistration:
          lookupPayload?.stateRegistration ||
          normalizeCnpj(company.stateRegistration) ||
          undefined,
        stateRegistrationFormatted:
          lookupPayload?.stateRegistrationFormatted ||
          company.stateRegistration ||
          undefined,
        stateRegistrationStatus: lookupPayload?.stateRegistrationStatus,
        stateRegistrationSource: lookupPayload?.stateRegistrationSource,
        icmsContributorStatus: lookupPayload?.icmsContributorStatus,
        taxRegime: lookupPayload?.taxRegime || company.taxRegime,
        environment: company.environment,
        status: company.status,
      };
      const savedCompany = isEditing && companyId
        ? await updateCompany(companyId, payload)
        : await createCompany(payload);

      await saveCompanyFiscalSettings(savedCompany.id, buildFiscalPayload(company, fiscal));

      const certificateFile = fileRef.current?.files?.[0];
      if (certificateFile) {
        if (!/\.(pfx|p12)$/i.test(certificateFile.name)) {
          throw new Error("Envie um certificado digital A1 .pfx ou .p12.");
        }
        if (!certificatePassword) {
          throw new Error("Informe a senha do certificado digital.");
        }
        await uploadCertificate(savedCompany.id, certificateFile, certificatePassword);
      }

      return { savedCompany, configureFiscal };
    },
    onSuccess: ({ savedCompany, configureFiscal }) => {
      notify({
        title: isEditing ? "Empresa atualizada" : "Empresa criada",
        description: "Dados cadastrais e fiscais foram salvos.",
      });
      if (address.cep || contact.email || contact.phone) {
        notify({
          title: "Campos complementares preparados",
          description: "Endereço e contato estão prontos para persistência quando o backend expuser esses campos.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company", savedCompany.id] });
      router.push(configureFiscal ? `/companies/${savedCompany.id}/fiscal` : `/companies/${savedCompany.id}`);
    },
    onError: (error) =>
      notify({ title: "Empresa não salva", description: error.message, tone: "error" }),
  });

  function applyLookup(data: CnpjLookupResponse) {
    const fields = lookupToCompanyForm(data);
    const taxSettings = lookupToTaxSettings(data);
    setLookupData(data);
    setLastLookupAt(new Date().toISOString());
    setCompany((current) => ({
      ...current,
      legalName: fields.legalName || current.legalName,
      tradeName: fields.tradeName || current.tradeName,
      cnpj: fields.cnpj,
      city: fields.city || current.city,
      uf: fields.uf || current.uf,
      stateRegistration: fields.stateRegistration || current.stateRegistration,
      taxRegime: fields.taxRegime,
      environment: fields.environment,
    }));
    setFiscal((current) => ({
      ...current,
      fiscalUf: fields.uf || current.fiscalUf,
      crt: (taxSettings.crt as FiscalDraft["crt"]) || current.crt,
      mainCnae: taxSettings.mainCnae || current.mainCnae,
      simplesAnnex: taxSettings.simplesAnnex || current.simplesAnnex,
      isIcmsTaxpayer: taxSettings.isIcmsTaxpayer,
      ieIndicator: taxSettings.icmsContribType || current.ieIndicator,
      simples: fields.taxRegime === "SIMPLES_NACIONAL",
      mei: fields.taxRegime === "MEI",
      presumedProfit: fields.taxRegime === "LUCRO_PRESUMIDO",
      realProfit: fields.taxRegime === "LUCRO_REAL",
    }));
  }

  if (isEditing && query.isLoading) {
    return <div className="h-96 animate-pulse rounded-3xl bg-white/50" />;
  }

  return (
    <div className="space-y-5">
      <Link href="/companies" className="inline-flex items-center gap-2 text-[11px] font-extrabold text-subtle">
        <ArrowLeft className="h-4 w-4" />
        Voltar para empresas
      </Link>
      <PageHeader
        eyebrow={isEditing ? "Editar empresa" : "Nova empresa"}
        title={isEditing ? company.legalName || "Editar empresa" : "Nova empresa"}
        description="Complete o cadastro para emissão, sincronização fiscal e fechamento."
        icon={Building2}
      />

      <Card className="p-5">
        <SectionTitle number="1" title="Buscar dados" icon={Search} />
        <div className="mt-4 rounded-2xl border border-line p-4">
          <CnpjLookupForm onDataLoaded={applyLookup} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-subtle">
            <span>Origem dos dados: {lookupData ? lookupData.inscricaoEstadual.fonte : "não consultado"}</span>
            <span>Última consulta: {lastLookupAt ? new Date(lastLookupAt).toLocaleString("pt-BR") : "—"}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle number="2" title="Dados cadastrais" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isEditing && <Field label="ID"><Input value={company.id} readOnly /></Field>}
          <Field label="Razão social"><Input value={company.legalName} onChange={(event) => setCompany({ ...company, legalName: event.target.value })} /></Field>
          <Field label="Nome fantasia"><Input value={company.tradeName} onChange={(event) => setCompany({ ...company, tradeName: event.target.value })} /></Field>
          <Field label="CNPJ"><Input id="company-cnpj" value={company.cnpj} onChange={(event) => setCompany({ ...company, cnpj: event.target.value })} /></Field>
          <Field label="Matriz/Filial"><select className={selectClass} value={company.branchType} onChange={(event) => setCompany({ ...company, branchType: event.target.value as CompanyDraft["branchType"] })}><option value="matriz">Matriz</option><option value="filial">Filial</option></select></Field>
          <Field label="Data de abertura"><Input type="date" value={company.openingDate} onChange={(event) => setCompany({ ...company, openingDate: event.target.value })} /></Field>
          <Field label="Natureza jurídica"><Input value={company.legalNature} onChange={(event) => setCompany({ ...company, legalNature: event.target.value })} /></Field>
          <Field label="Porte"><Input value={company.companySize} onChange={(event) => setCompany({ ...company, companySize: event.target.value })} /></Field>
          <Field label="Situação cadastral"><Input value={company.registrationStatus} onChange={(event) => setCompany({ ...company, registrationStatus: event.target.value })} /></Field>
          <Field label="Status interno"><select className={selectClass} value={company.status} onChange={(event) => setCompany({ ...company, status: event.target.value as CompanyDraft["status"] })}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></Field>
          <Field label="Observações"><Input value={company.notes} onChange={(event) => setCompany({ ...company, notes: event.target.value })} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle number="3" title="Dados fiscais" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Regime tributário"><select className={selectClass} value={company.taxRegime} onChange={(event) => setCompany({ ...company, taxRegime: event.target.value })}><option value="PENDENTE_CONFIRMACAO">Pendente</option><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option><option value="LUCRO_REAL">Lucro Real</option><option value="MEI">MEI</option><option value="OUTRO">Outro</option></select></Field>
          <Field label="CRT"><select className={selectClass} value={fiscal.crt} onChange={(event) => setFiscal({ ...fiscal, crt: event.target.value as FiscalDraft["crt"] })}><option value="">Selecione</option><option value="1">1 - Simples Nacional</option><option value="2">2 - Simples excesso sublimite</option><option value="3">3 - Regime normal</option><option value="4">4 - MEI</option></select></Field>
          <Field label="CNAE principal"><Input value={fiscal.mainCnae} onChange={(event) => setFiscal({ ...fiscal, mainCnae: event.target.value })} /></Field>
          <Field label="CNAEs secundários"><Input value={fiscal.secondaryCnaes} onChange={(event) => setFiscal({ ...fiscal, secondaryCnaes: event.target.value })} placeholder="Separados por vírgula" /></Field>
          <Field label="Inscrição estadual"><Input value={company.stateRegistration} onChange={(event) => setCompany({ ...company, stateRegistration: event.target.value })} /></Field>
          <Field label="Inscrição municipal"><Input value={fiscal.municipalRegistration} onChange={(event) => setFiscal({ ...fiscal, municipalRegistration: event.target.value })} /></Field>
          <Field label="Indicador IE"><select className={selectClass} value={fiscal.ieIndicator} onChange={(event) => setFiscal({ ...fiscal, ieIndicator: event.target.value as FiscalDraft["ieIndicator"] })}><option value="">Selecione</option><option value="SIM">Contribuinte</option><option value="NAO">Não contribuinte</option><option value="ISENTO">Isento</option></select></Field>
          <Field label="UF fiscal"><Input maxLength={2} value={company.uf} onChange={(event) => setCompany({ ...company, uf: event.target.value.toUpperCase() })} /></Field>
          <Field label="Município IBGE"><Input value={fiscal.ibgeCityCode} onChange={(event) => setFiscal({ ...fiscal, ibgeCityCode: event.target.value })} /></Field>
          <Field label="Ambiente SEFAZ"><select className={selectClass} value={company.environment} onChange={(event) => setCompany({ ...company, environment: event.target.value as CompanyDraft["environment"] })}><option value="homologation">Homologação</option><option value="production">Produção</option></select></Field>
          <Field label="Tipo de emissão"><Input value={fiscal.emissionType} onChange={(event) => setFiscal({ ...fiscal, emissionType: event.target.value })} /></Field>
          <Field label="Série NF-e"><Input value={fiscal.nfeSeries} onChange={(event) => setFiscal({ ...fiscal, nfeSeries: event.target.value })} /></Field>
          <Field label="Série NFC-e"><Input value={fiscal.nfceSeries} onChange={(event) => setFiscal({ ...fiscal, nfceSeries: event.target.value })} /></Field>
          <Field label="Série NFS-e"><Input value={fiscal.nfseSeries} onChange={(event) => setFiscal({ ...fiscal, nfseSeries: event.target.value })} /></Field>
          <Field label="Próxima numeração NF-e"><Input value={fiscal.nextNfeNumber} onChange={(event) => setFiscal({ ...fiscal, nextNfeNumber: event.target.value })} /></Field>
          <Field label="Próxima numeração NFC-e"><Input value={fiscal.nextNfceNumber} onChange={(event) => setFiscal({ ...fiscal, nextNfceNumber: event.target.value })} /></Field>
          <Field label="Próxima numeração NFS-e"><Input value={fiscal.nextNfseNumber} onChange={(event) => setFiscal({ ...fiscal, nextNfseNumber: event.target.value })} /></Field>
          <Field label="Percentual Simples"><Input type="number" value={fiscal.simplesPercent} onChange={(event) => setFiscal({ ...fiscal, simplesPercent: event.target.value })} /></Field>
          <Field label="Anexo Simples"><Input value={fiscal.simplesAnnex} onChange={(event) => setFiscal({ ...fiscal, simplesAnnex: event.target.value })} /></Field>
          <Field label="Faixa de faturamento"><Input value={fiscal.revenueRange} onChange={(event) => setFiscal({ ...fiscal, revenueRange: event.target.value })} /></Field>
          <Field label="Fator R"><Input type="number" value={fiscal.fatorR} onChange={(event) => setFiscal({ ...fiscal, fatorR: event.target.value })} /></Field>
          <Field label="Contador responsável"><Input value={fiscal.accountant} onChange={(event) => setFiscal({ ...fiscal, accountant: event.target.value })} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          <Check label="Simples Nacional" checked={fiscal.simples} onChange={(checked) => setFiscal({ ...fiscal, simples: checked })} />
          <Check label="Excesso sublimite" checked={fiscal.sublimiteExceeded} onChange={(checked) => setFiscal({ ...fiscal, sublimiteExceeded: checked })} />
          <Check label="Lucro Presumido" checked={fiscal.presumedProfit} onChange={(checked) => setFiscal({ ...fiscal, presumedProfit: checked })} />
          <Check label="Lucro Real" checked={fiscal.realProfit} onChange={(checked) => setFiscal({ ...fiscal, realProfit: checked })} />
          <Check label="MEI" checked={fiscal.mei} onChange={(checked) => setFiscal({ ...fiscal, mei: checked })} />
          <Check label="Contribuinte ICMS" checked={fiscal.isIcmsTaxpayer} onChange={(checked) => setFiscal({ ...fiscal, isIcmsTaxpayer: checked })} />
          <Check label="Presta serviços" checked={fiscal.providesService} onChange={(checked) => setFiscal({ ...fiscal, providesService: checked })} />
        </div>
        {company.environment === "production" && (
          <label className="mt-4 flex items-start gap-2 text-xs">
            <input type="checkbox" checked={productionConfirmed} onChange={(event) => setProductionConfirmed(event.target.checked)} className="mt-0.5" />
            Confirmo que desejo configurar esta empresa para ambiente SEFAZ de produção.
          </label>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle number="4" title="Endereço" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="CEP"><Input value={address.cep} onChange={(event) => setAddress({ ...address, cep: event.target.value })} /></Field>
          <Field label="Logradouro"><Input value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} /></Field>
          <Field label="Número"><Input value={address.number} onChange={(event) => setAddress({ ...address, number: event.target.value })} /></Field>
          <Field label="Complemento"><Input value={address.complement} onChange={(event) => setAddress({ ...address, complement: event.target.value })} /></Field>
          <Field label="Bairro"><Input value={address.district} onChange={(event) => setAddress({ ...address, district: event.target.value })} /></Field>
          <Field label="Cidade"><Input value={company.city} onChange={(event) => setCompany({ ...company, city: event.target.value })} /></Field>
          <Field label="UF"><Input maxLength={2} value={company.uf} onChange={(event) => setCompany({ ...company, uf: event.target.value.toUpperCase() })} /></Field>
          <Field label="Código IBGE"><Input value={fiscal.ibgeCityCode} onChange={(event) => setFiscal({ ...fiscal, ibgeCityCode: event.target.value })} /></Field>
          <Field label="País"><Input value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle number="5" title="Contato" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="E-mail"><Input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></Field>
          <Field label="Telefone"><Input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></Field>
          <Field label="Celular/WhatsApp"><Input value={contact.whatsapp} onChange={(event) => setContact({ ...contact, whatsapp: event.target.value })} /></Field>
          <Field label="Responsável fiscal"><Input value={contact.fiscalResponsible} onChange={(event) => setContact({ ...contact, fiscalResponsible: event.target.value })} /></Field>
          <Field label="E-mail fiscal"><Input type="email" value={contact.fiscalEmail} onChange={(event) => setContact({ ...contact, fiscalEmail: event.target.value })} /></Field>
          <Field label="Responsável financeiro"><Input value={contact.financialResponsible} onChange={(event) => setContact({ ...contact, financialResponsible: event.target.value })} /></Field>
          <Field label="E-mail financeiro"><Input type="email" value={contact.financialEmail} onChange={(event) => setContact({ ...contact, financialEmail: event.target.value })} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle number="6" title="Certificado digital" icon={FileKey2} />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Arquivo A1 (.pfx ou .p12)"><Input ref={fileRef} type="file" accept=".pfx,.p12" className="h-12 p-3" /></Field>
          <Field label="Senha do certificado"><Input type="password" value={certificatePassword} onChange={(event) => setCertificatePassword(event.target.value)} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SmartStatus label={query.data?.certificate ? "Possui certificado" : "Sem certificado"} tone={query.data?.certificate ? "success" : "warning"} />
          {query.data?.certificate?.validUntil && <SmartStatus label={`Validade: ${new Date(query.data.certificate.validUntil).toLocaleDateString("pt-BR")}`} tone="neutral" />}
          {isEditing && <Button asChild variant="outline"><Link href={`/companies/${companyId}/settings`}>Gerenciar certificado</Link></Button>}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle number="7" title="Configuração fiscal" />
        <p className="mt-2 text-sm text-subtle">Os campos fiscais desta tela alimentam a configuração fiscal da empresa. A configuração completa também pode ser revisada em uma tela dedicada.</p>
        {isEditing && <Button asChild className="mt-4" variant="outline"><Link href={`/companies/${companyId}/fiscal`}>Abrir configuração fiscal</Link></Button>}
      </Card>

      <Card className="p-5">
        <SectionTitle number="8" title="Pendências" />
        {issues.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Cadastro pronto para salvar.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-extrabold">{issue.title}</p>
                  <SmartStatus label={issue.severity === "error" ? "Erro" : "Alerta"} tone={issue.severity === "error" ? "danger" : "warning"} />
                </div>
                <p className="mt-2 text-xs text-subtle">{issue.explanation}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => document.getElementById(`company-${issue.field}`)?.focus()}>Corrigir</Button>
                  <Button size="sm" variant="ghost" onClick={() => notify({ title: "Pendência enviada ao contador", description: issue.title })}>Enviar para contador</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle number="9" title="Ações" />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline"><Link href="/companies">Cancelar</Link></Button>
          <Button variant="outline" onClick={() => notify({ title: "Validação local concluída", description: `${issues.length} pendência(s) encontrada(s).` })}>Validar cadastro</Button>
          <Button variant="outline" onClick={() => notify({ title: "Correção assistida", description: "Use os botões Corrigir nas pendências para revisar os campos." })}>Corrigir pendências</Button>
          {isEditing && <Button asChild variant="outline"><Link href={`/documents?companyId=${companyId}`}>Ver documentos</Link></Button>}
          <Button variant="lime" onClick={() => save.mutate({ configureFiscal: false })} disabled={save.isPending}>
            <Save className="h-4 w-4" />
            {save.isPending ? "Salvando..." : "Salvar empresa"}
          </Button>
          <Button variant="lime" onClick={() => save.mutate({ configureFiscal: true })} disabled={save.isPending}>
            Salvar e configurar fiscal
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({
  number,
  title,
  icon: Icon,
}: {
  number: string;
  title: string;
  icon?: typeof Building2;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-lime text-xs font-extrabold text-ink">
        {number}
      </div>
      <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-[11px] font-extrabold">{label}</span>{children}</label>;
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-ink" />
      {label}
    </label>
  );
}
