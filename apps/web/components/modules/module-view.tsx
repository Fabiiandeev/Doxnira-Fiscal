"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Building2,
  CircleHelp,
  FileBarChart,
  FileCheck2,
  FileKey2,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RemoveCompanyDialog } from "@/components/companies/remove-company-dialog";
import { CnpjLookupForm } from "@/components/companies/cnpj-lookup-form";
import { ManifestationModal } from "@/components/manifestation-modal";
import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCompanyId, setCompanyId } from "@/lib/api";
import { listAlerts, updateAlert } from "@/lib/services/alert-service";
import { uploadCertificate } from "@/lib/services/certificate-service";
import { createCompany, listCompanies, updateCompany } from "@/lib/services/company-service";
import {
  lookupToCompanyForm,
  lookupToCompanyPayload,
  lookupToTaxSettings,
  type CnpjLookupResponse,
} from "@/lib/services/cnpj-service";
import { searchDocuments } from "@/lib/services/fiscal-service";
import { getPreferences, savePreferences } from "@/lib/services/preference-service";
import { saveTaxSettings } from "@/lib/services/tax-service";
import { formatCurrency, formatDate, maskCnpj } from "@/lib/utils";

type ModuleName =
  | "companies"
  | "manifestations"
  | "alerts"
  | "reports"
  | "users"
  | "settings"
  | "help"
  | "guides"
  | "requests";

const config = {
  companies: ["Empresas", "Estrutura multiempresa", "Gerencie CNPJs, ambientes fiscais e status da operação.", Building2],
  manifestations: ["Manifestação", "Eventos do destinatário", "Registre eventos fiscais mockados com rastreabilidade.", FileCheck2],
  alerts: ["Alertas", "Monitoramento fiscal", "Leia, resolva e reabra ocorrências relacionadas à operação.", BellRing],
  reports: ["Relatórios", "Análise e exportação", "Gere consolidações e exportações a partir da base fiscal.", FileBarChart],
  users: ["Usuários", "Acesso e permissões", "Papéis preparados para OWNER, ADMIN, ACCOUNTANT, OPERATOR e VIEWER.", Users],
  settings: ["Configurações", "Preferências do sistema", "Defina tema, empresa padrão e densidade de tabela.", Settings],
  help: ["Ajuda", "Suporte e documentação", "Entenda NSU, XML, manifestação e códigos de retorno.", CircleHelp],
  guides: ["Guias", "Documentos de arrecadação", "Acompanhe guias e vencimentos vinculados ao fechamento.", FileKey2],
  requests: ["Solicitações", "Demandas contábeis", "Centralize solicitações e documentos pendentes das empresas.", FileCheck2],
} as const;

export function ModuleView({ module }: { module: ModuleName }) {
  const [title, eyebrow, description, Icon] = config[module];
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} icon={Icon} />
      {module === "companies" && <CompaniesModule />}
      {module === "manifestations" && <ManifestationsModule />}
      {module === "alerts" && <AlertsModule />}
      {module === "reports" && <ReportsModule />}
      {module === "users" && <UsersModule />}
      {module === "settings" && <SettingsModule />}
      {module === "help" && <HelpModule />}
      {module === "guides" && <HelpModule />}
      {module === "requests" && <HelpModule />}
    </>
  );
}

function CompaniesModule() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const certificateRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [productionConfirmed, setProductionConfirmed] = useState(false);
  const [lookupData, setLookupData] = useState<CnpjLookupResponse | null>(null);
  const [form, setForm] = useState({
    legalName: "",
    tradeName: "",
    cnpj: "",
    uf: "GO",
    city: "",
    stateRegistration: "",
    taxRegime: "",
    environment: "homologation" as "homologation" | "production",
  });
  const query = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  useEffect(() => {
    setFormOpen(new URLSearchParams(window.location.search).get("new") === "1");
  }, []);
  const create = useMutation({
    mutationFn: async () => {
      const file = certificateRef.current?.files?.[0];
      if (form.environment === "production" && !productionConfirmed) {
        throw new Error("Confirme o uso do ambiente fiscal de produção.");
      }
      if (file && !/\.(pfx|p12)$/i.test(file.name)) {
        throw new Error("Envie um certificado digital A1 .pfx ou .p12.");
      }
      if (file && !certificatePassword) {
        throw new Error("Informe a senha do certificado digital.");
      }
      const lookupPayload = lookupData
        ? lookupToCompanyPayload(lookupData)
        : null;
      const company = await createCompany({
        ...form,
        ...(lookupPayload ?? {}),
        cnpj: form.cnpj.replace(/\D/g, ""),
        stateRegistration:
          lookupPayload?.stateRegistration ||
          form.stateRegistration.replace(/\D/g, "") ||
          undefined,
        stateRegistrationFormatted:
          lookupPayload?.stateRegistrationFormatted ||
          form.stateRegistration ||
          undefined,
        taxRegime: lookupPayload?.taxRegime || form.taxRegime || undefined,
      });
      if (lookupData) {
        await saveTaxSettings(lookupToTaxSettings(lookupData), company.id);
      }
      let certificateError: string | null = null;
      if (file) {
        try {
          await uploadCertificate(company.id, file, certificatePassword);
        } catch (error) {
          certificateError = error instanceof Error ? error.message : "Falha no upload.";
        }
      }
      return { company, certificateError, certificateSelected: Boolean(file) };
    },
    onSuccess: ({ company, certificateError, certificateSelected }) => {
      setCompanyId(company.id);
      setFormOpen(false);
      setCertificatePassword("");
      setProductionConfirmed(false);
      setLookupData(null);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      if (certificateError) {
        notify({
          title: "Empresa criada, mas o certificado não foi enviado.",
          description: certificateError,
          tone: "error",
        });
      } else {
        notify({
          title: "Empresa criada",
          description: certificateSelected
            ? "Dados e certificado digital foram processados."
            : "Dados da empresa foram salvos.",
        });
      }
      router.push(`/companies/${company.id}/edit`);
    },
    onError: (error) => notify({ title: "Empresa não criada", description: error.message, tone: "error" }),
  });
  const toggle = useMutation({
    mutationFn: (company: NonNullable<typeof query.data>["data"][number]) =>
      updateCompany(company.id, { status: company.status === "active" ? "inactive" : "active" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button variant="lime" onClick={() => setFormOpen((value) => !value)}>Nova empresa</Button></div>
      {formOpen && (
        <Card className="p-5">
          <div>
            <h2 className="text-sm font-extrabold">1. Dados da empresa</h2>
            <div className="mt-4 rounded-2xl border border-line p-4">
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
                    taxRegime: fields.taxRegime,
                    environment: fields.environment,
                  }));
                }}
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input placeholder="Razão social" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
              <Input placeholder="Nome fantasia" value={form.tradeName} onChange={(event) => setForm({ ...form, tradeName: event.target.value })} />
              <Input placeholder="CNPJ" value={form.cnpj} onChange={(event) => setForm({ ...form, cnpj: event.target.value })} />
              <Input placeholder="Cidade" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
              <Input placeholder="UF" maxLength={2} value={form.uf} onChange={(event) => setForm({ ...form, uf: event.target.value.toUpperCase() })} />
              <Input placeholder="Inscrição Estadual" value={form.stateRegistration} onChange={(event) => setForm({ ...form, stateRegistration: event.target.value })} />
              <Input placeholder="Regime tributário" value={form.taxRegime} onChange={(event) => setForm({ ...form, taxRegime: event.target.value })} />
              <Input placeholder="CNAE principal" value={lookupData?.empresa.cnaePrincipal.codigoFormatado || ""} readOnly />
              <Input placeholder="Regime de apuração" value={lookupData?.fiscal.regimeApuracao || ""} readOnly />
              <Input className="md:col-span-2" placeholder="Atividade principal" value={lookupData?.empresa.cnaePrincipal.descricao || ""} readOnly />
            </div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <h2 className="text-sm font-extrabold">2. Ambiente fiscal</h2>
            <select value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value as "homologation" | "production" })} className="mt-4 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none md:max-w-sm"><option value="homologation">Homologação</option><option value="production">Produção</option></select>
            {form.environment === "production" && (
              <label className="mt-3 flex items-start gap-2 text-xs">
                <input type="checkbox" checked={productionConfirmed} onChange={(event) => setProductionConfirmed(event.target.checked)} className="mt-0.5" />
                Confirmo que desejo configurar esta empresa para ambiente de produção.
              </label>
            )}
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold"><FileKey2 className="h-4 w-4" />3. Certificado Digital A1</h2>
            <p className="mt-1 text-xs text-subtle">Opcional. A empresa será criada antes do upload.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input ref={certificateRef} type="file" accept=".pfx,.p12" className="h-12 p-3" />
              <Input type="password" placeholder="Senha do certificado" value={certificatePassword} onChange={(event) => setCertificatePassword(event.target.value)} />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="lime" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Salvando..." : "Salvar empresa"}
            </Button>
          </div>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {(query.data?.data || []).map((company) => (
          <Card key={company.id} className="p-5">
            <div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-pastel-purple"><Building2 className="h-5 w-5" /></div><Badge variant={company.status === "active" ? "success" : "neutral"}>{company.status === "active" ? "Ativa" : "Inativa"}</Badge></div>
            <h2 className="mt-5 text-base font-extrabold">{company.tradeName || company.legalName}</h2>
            <p className="mt-1 text-[10px] font-bold text-subtle">{maskCnpj(company.cnpj)} · {company.uf} · {company.environment}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-muted p-4 text-[10px]"><div><p className="text-subtle">Documentos</p><p className="mt-1 font-extrabold">{company._count?.fiscalDocuments || 0}</p></div><div><p className="text-subtle">Último NSU</p><p className="mt-1 truncate font-mono font-extrabold">{company.nfeLastNsu}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href={`/companies/${company.id}/edit`}>Editar</Link></Button><Button variant="ghost" size="sm" onClick={() => toggle.mutate(company)}>{company.status === "active" ? "Desativar" : "Ativar"}</Button><RemoveCompanyDialog company={company} /></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ManifestationsModule() {
  const companyId = getCompanyId();
  const query = useQuery({
    queryKey: ["manifestation-documents", companyId],
    queryFn: () => searchDocuments({ page: 1, pageSize: 25, filters: { query: "", documentType: "", operationDirection: "", source: "", hasLinkedCte: "", status: "", xmlType: "", manifestation: "PENDING", startDate: "", endDate: "", minAmount: "", maxAmount: "", uf: "", onlyNewSuppliers: false } }),
    enabled: Boolean(companyId),
  });
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4"><p className="text-xs font-extrabold">{query.data?.pagination.total || 0} documentos pendentes</p></div>
      {(query.data?.data || []).map((document) => (
        <div key={document.id} className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-0 md:flex-row md:items-center">
          <div className="min-w-0 flex-1"><Link href={`/documents/${document.id}`} className="text-xs font-extrabold hover:underline">NF-e {document.invoiceNumber || "—"} · {document.issuerName || "—"}</Link><p className="mt-1 text-[10px] text-subtle">{document.emissionDate ? formatDate(document.emissionDate) : "—"} · {formatCurrency(document.totalAmount)}</p></div>
          <ManifestationModal documentIds={[document.id]} />
        </div>
      ))}
      {!query.isLoading && !query.data?.data.length && <p className="p-12 text-center text-xs text-subtle">Nenhuma manifestação pendente.</p>}
    </Card>
  );
}

function AlertsModule() {
  const companyId = getCompanyId();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const query = useQuery({ queryKey: ["alerts", companyId, status], queryFn: () => listAlerts(companyId!, status), enabled: Boolean(companyId) });
  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "read" | "resolve" | "reopen" }) => updateAlert(companyId!, id, action),
    onSuccess: () => { notify({ title: "Alerta atualizado" }); queryClient.invalidateQueries({ queryKey: ["alerts"] }); },
  });
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-2 border-b border-line p-4">{["", "open", "resolved"].map((value) => <Button key={value || "all"} variant={status === value ? "default" : "outline"} size="sm" onClick={() => setStatus(value)}>{value === "" ? "Todos" : value === "open" ? "Abertos" : "Resolvidos"}</Button>)}</div>
      {(query.data?.data || []).map((alert) => (
        <div key={alert.id} className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-0 md:flex-row md:items-center">
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge variant={alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "neutral"}>{alert.severity}</Badge><p className="text-xs font-extrabold">{alert.title}</p></div><p className="mt-2 text-[10px] text-subtle">{alert.message}</p></div>
          <div className="flex gap-2">{alert.fiscalDocumentId && <Button asChild variant="ghost" size="sm"><Link href={`/documents/${alert.fiscalDocumentId}`}>Abrir nota</Link></Button>}{!alert.readAt && <Button variant="outline" size="sm" onClick={() => action.mutate({ id: alert.id, action: "read" })}>Ler</Button>}<Button variant={alert.status === "resolved" ? "outline" : "lime"} size="sm" onClick={() => action.mutate({ id: alert.id, action: alert.status === "resolved" ? "reopen" : "resolve" })}>{alert.status === "resolved" ? "Reabrir" : "Resolver"}</Button></div>
        </div>
      ))}
    </Card>
  );
}

function ReportsModule() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-6">
        <FileBarChart className="h-6 w-6 text-violet-600" />
        <h2 className="mt-5 text-base font-extrabold">Relatórios contábeis</h2>
        <p className="mt-2 text-xs text-subtle">Entradas, saídas, CT-e, impostos e pendências com exportação CSV/XLSX real.</p>
        <Button asChild className="mt-6" variant="lime"><Link href="/reports/accounting">Abrir relatórios</Link></Button>
      </Card>
      <Card className="p-6">
        <FileCheck2 className="h-6 w-6 text-emerald-600" />
        <h2 className="mt-5 text-base font-extrabold">Fechamento fiscal mensal</h2>
        <p className="mt-2 text-xs text-subtle">Cálculo assistido com aprovação, reabertura e documentos MOCK/SEED ignorados.</p>
        <Button asChild className="mt-6" variant="outline"><Link href="/reports/monthly-closing">Abrir fechamento</Link></Button>
      </Card>
    </div>
  );
}

function SettingsModule() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["preferences"], queryFn: getPreferences });
  const companies = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [defaultCompanyId, setDefaultCompanyId] = useState("");
  const [brand, setBrand] = useState("NS Fiscal Cloud");
  useEffect(() => {
    const preferences = query.data?.preferences;
    if (!preferences) return;
    setTheme(preferences.theme);
    setDensity(preferences.tableDensity);
    setDefaultCompanyId(preferences.defaultCompanyId || "");
    setBrand(preferences.dashboardLayout?.brand || "NS Fiscal Cloud");
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => savePreferences({ theme, tableDensity: density, defaultCompanyId: defaultCompanyId || null, dashboardLayout: { brand } }),
    onSuccess: () => { notify({ title: "Preferências salvas" }); queryClient.invalidateQueries({ queryKey: ["preferences"] }); },
  });
  const reset = useMutation({
    mutationFn: () => savePreferences({ theme: "light", tableDensity: "comfortable", defaultCompanyId: null, dashboardLayout: { brand: "NS Fiscal Cloud" } }),
    onSuccess: () => { setTheme("light"); setDensity("comfortable"); setDefaultCompanyId(""); setBrand("NS Fiscal Cloud"); notify({ title: "Preferências restauradas" }); queryClient.invalidateQueries({ queryKey: ["preferences"] }); },
  });
  return (
    <Card className="max-w-3xl p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label><span className="mb-2 block text-[11px] font-extrabold">Tema</span><select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Sistema</option></select></label>
        <label><span className="mb-2 block text-[11px] font-extrabold">Densidade</span><select value={density} onChange={(event) => setDensity(event.target.value as typeof density)} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
        <label><span className="mb-2 block text-[11px] font-extrabold">Empresa padrão</span><select value={defaultCompanyId} onChange={(event) => setDefaultCompanyId(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="">Primeira empresa disponível</option>{(companies.data?.data || []).map((company) => <option key={company.id} value={company.id}>{company.tradeName || company.legalName}</option>)}</select></label>
        <label><span className="mb-2 block text-[11px] font-extrabold">Marca</span><Input value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
      </div>
      <div className="mt-6 flex gap-2"><Button variant="lime" onClick={() => save.mutate()} disabled={save.isPending}>Salvar preferências</Button><Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>Resetar</Button></div>
    </Card>
  );
}

function UsersModule() {
  return <Card className="p-6"><div className="flex items-center justify-between"><div><h2 className="text-base font-extrabold">Fabian</h2><p className="mt-1 text-xs text-subtle">admin@nssistemas.com.br</p></div><Badge variant="lime">OWNER</Badge></div><p className="mt-6 rounded-2xl bg-muted p-4 text-[10px] leading-5 text-subtle">O controle de papéis está modelado no backend. Convites e gestão multiusuário ficam fora do escopo fiscal desta fase.</p></Card>;
}

function HelpModule() {
  const items = [
    ["O que é NSU?", "Número sequencial usado pela distribuição DF-e. Deve avançar sem saltos e respeitar a janela de consulta."],
    ["XML completo x resumo", "O XML completo contém o documento processado. O resumo pode exigir manifestação para liberação."],
    ["Manifestação", "Ciência, confirmação, desconhecimento e operação não realizada são eventos do destinatário."],
    ["cStat 137", "Nenhum documento localizado. A próxima consulta deve respeitar a janela mínima."],
    ["cStat 138", "Documentos localizados e processados."],
    ["cStat 656", "Consumo indevido. O sistema aplica bloqueio antes de nova tentativa."],
  ];
  return <div className="grid gap-4 lg:grid-cols-2">{items.map(([title, text]) => <Card key={title} className="p-5"><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-2 text-xs leading-6 text-subtle">{text}</p></Card>)}<Card className="p-5 lg:col-span-2"><h2 className="text-sm font-extrabold">Precisa de suporte?</h2><Button className="mt-4" variant="lime" onClick={() => notify({ title: "Chamado mockado aberto", description: "A equipe NS Sistemas recebeu a solicitação." })}>Abrir chamado</Button></Card></div>;
}
