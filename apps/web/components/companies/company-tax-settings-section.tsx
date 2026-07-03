"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getTaxSettings, repairTaxSettings, saveTaxSettings } from "@/lib/services/tax-service";
import {
  lookupToTaxSettings,
  type CnpjLookupResponse,
} from "@/lib/services/cnpj-service";
import type { CompanyTaxSettings } from "@/lib/types";

const selectClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none";

const EMPTY_SETTINGS: CompanyTaxSettings = {
  taxRegime: "SIMPLES_NACIONAL",
  calculationRegime: "COMPETENCIA",
  uf: "",
  stateRegistration: "",
  mainCnae: "",
  simplesAnnex: "",
  mainActivity: "",
  isIcmsTaxpayer: false,
  isIpiTaxpayer: false,
  pisCofinsRegime: "SIMPLES",
  accumulatedRevenue: null,
  secondaryCnaes: null,
  icmsContribType: null,
  providesService: false,
  sellsMerchandise: true,
  municipalRegistration: "",
  crt: null,
  fiscalConfigComplete: false,
  simplesNominalRate: null,
  simplesDeductAmount: null,
  simplesEffectiveRate: null,
  simplesIcmsPercent: null,
  simplesIssPercent: null,
  simplesCppPercent: null,
  simplesFatorR: null,
  simplesRevenue12m: null,
  simplesPayroll12m: null,
  simplesManualOverride: false,
  presumidoIrpjBase: null,
  presumidoCsllBase: null,
  presumidoPisRate: null,
  presumidoCofinsRate: null,
  presumidoIssRate: null,
  presumidoIcmsRate: null,
  presumidoIpiRate: null,
  presumidoRatPercent: null,
  presumidoThirdParty: null,
  presumidoInssPatronal: null,
  presumidoIrpjVencimento: null,
  presumidoCsllVencimento: null,
  realapuracaoPeriod: null,
  realPisRate: null,
  realCofinsRate: null,
  realCreditAllowed: false,
  realLalurControl: false,
  realPrejuizoControl: false,
  realIrpjRate: null,
  realCsllRate: null,
};

function toNumber(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

export function CompanyTaxSettingsSection({
  companyId,
  companyUf,
  stateRegistration,
  lookupData,
}: {
  companyId: string;
  companyUf: string | null;
  stateRegistration?: string | null;
  lookupData?: CnpjLookupResponse | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CompanyTaxSettings>({
    ...EMPTY_SETTINGS,
    uf: companyUf || "",
    stateRegistration: stateRegistration || "",
  });
  const [activeTab, setActiveTab] = useState<"geral" | "simples" | "presumido" | "real">("geral");

  const query = useQuery({
    queryKey: ["tax-settings", companyId],
    queryFn: () => getTaxSettings(companyId),
  });

  useEffect(() => {
    if (query.data) {
      const d = query.data;
      setForm({
        ...EMPTY_SETTINGS,
        ...d,
        uf: d.uf || "",
        stateRegistration: d.stateRegistration || "",
        mainCnae: d.mainCnae || "",
        simplesAnnex: d.simplesAnnex || "",
        mainActivity: d.mainActivity || "",
        municipalRegistration: d.municipalRegistration || "",
        accumulatedRevenue: toNumber(d.accumulatedRevenue),
        secondaryCnaes: d.secondaryCnaes || null,
        simplesNominalRate: toNumber(d.simplesNominalRate),
        simplesDeductAmount: toNumber(d.simplesDeductAmount),
        simplesEffectiveRate: toNumber(d.simplesEffectiveRate),
        simplesIcmsPercent: toNumber(d.simplesIcmsPercent),
        simplesIssPercent: toNumber(d.simplesIssPercent),
        simplesCppPercent: toNumber(d.simplesCppPercent),
        simplesFatorR: toNumber(d.simplesFatorR),
        simplesRevenue12m: toNumber(d.simplesRevenue12m),
        simplesPayroll12m: toNumber(d.simplesPayroll12m),
        presumidoIrpjBase: toNumber(d.presumidoIrpjBase),
        presumidoCsllBase: toNumber(d.presumidoCsllBase),
        presumidoPisRate: toNumber(d.presumidoPisRate),
        presumidoCofinsRate: toNumber(d.presumidoCofinsRate),
        presumidoIssRate: toNumber(d.presumidoIssRate),
        presumidoIcmsRate: toNumber(d.presumidoIcmsRate),
        presumidoIpiRate: toNumber(d.presumidoIpiRate),
        presumidoRatPercent: toNumber(d.presumidoRatPercent),
        presumidoThirdParty: toNumber(d.presumidoThirdParty),
        presumidoInssPatronal: toNumber(d.presumidoInssPatronal),
        realPisRate: toNumber(d.realPisRate),
        realCofinsRate: toNumber(d.realCofinsRate),
        realIrpjRate: toNumber(d.realIrpjRate),
        realCsllRate: toNumber(d.realCsllRate),
        fiscalConfigComplete: d.fiscalConfigComplete ?? false,
      });
    }
  }, [query.data]);

  useEffect(() => {
    if (lookupData) setForm(lookupToTaxSettings(lookupData));
  }, [lookupData]);

  useEffect(() => {
    if (form.taxRegime === "SIMPLES_NACIONAL" || form.taxRegime === "MEI") {
      setActiveTab((t) => (t === "presumido" || t === "real" ? "simples" : t));
    } else if (form.taxRegime === "LUCRO_PRESUMIDO") {
      setActiveTab((t) => (t === "simples" || t === "real" ? "presumido" : t));
    } else if (form.taxRegime === "LUCRO_REAL") {
      setActiveTab((t) => (t === "simples" || t === "presumido" ? "real" : t));
    }
  }, [form.taxRegime]);

  const computedFatorR =
    form.simplesRevenue12m && form.simplesPayroll12m && form.simplesRevenue12m > 0
      ? +((form.simplesPayroll12m / form.simplesRevenue12m) * 100).toFixed(2)
      : null;

  const completeness = query.data?._completeness;
  const isComplete = form.fiscalConfigComplete;
  const missingFields = completeness?.missingFields || [];

  const save = useMutation({
    mutationFn: () => saveTaxSettings(form, companyId),
    onSuccess: () => {
      notify({ title: "Configuração fiscal salva" });
      queryClient.invalidateQueries({ queryKey: ["tax-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (error) =>
      notify({ title: "Configuração fiscal não salva", description: error.message, tone: "error" }),
  });

  const repair = useMutation({
    mutationFn: () => repairTaxSettings(companyId),
    onSuccess: () => {
      notify({ title: "Configuração fiscal criada", description: "Dados mínimos foram salvos." });
      queryClient.invalidateQueries({ queryKey: ["tax-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (error) =>
      notify({ title: "Correção automática falhou", description: error.message, tone: "error" }),
  });

  const update = <K extends keyof CompanyTaxSettings>(key: K, value: CompanyTaxSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isSimples = form.taxRegime === "SIMPLES_NACIONAL" || form.taxRegime === "MEI";
  const isPresumido = form.taxRegime === "LUCRO_PRESUMIDO";
  const isReal = form.taxRegime === "LUCRO_REAL";

  const tabs = [
    { id: "geral" as const, label: "Geral" },
    ...(isSimples ? [{ id: "simples" as const, label: "Simples Nacional" }] : []),
    ...(isPresumido ? [{ id: "presumido" as const, label: "Lucro Presumido" }] : []),
    ...(isReal ? [{ id: "real" as const, label: "Lucro Real" }] : []),
  ];

  return (
    <Card className="mb-4 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-pastel-green text-emerald-700">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold">3. Configuração fiscal</h2>
            {isComplete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Completa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Incompleta
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-subtle">
            Obrigatória para emitir NF-e e gerar fechamento mensal assistido.
          </p>
          {(!query.data || !form.uf) && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-extrabold">Configuração fiscal incompleta</p>
                <p className="mt-1 text-[11px]">{!form.uf ? "Informe a UF para criar os dados fiscais mínimos." : "Nenhuma configuração fiscal foi encontrada."}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => repair.mutate()} disabled={repair.isPending}>Corrigir automaticamente</Button>
            </div>
          )}
          {!isComplete && query.data && form.uf && missingFields.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-bold text-amber-800">
                Campos obrigatórios pendentes: {missingFields.join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${
              activeTab === tab.id ? "bg-white text-ink shadow-sm" : "text-subtle hover:text-ink"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "geral" && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Regime tributário">
            <select className={selectClass} value={form.taxRegime} onChange={(e) => update("taxRegime", e.target.value as CompanyTaxSettings["taxRegime"])}>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
              <option value="MEI">MEI</option>
              <option value="OUTRO">Outro</option>
              <option value="PENDENTE_CONFIRMACAO">Pendente de confirmação</option>
            </select>
          </Field>
          <Field label="Regime de apuração">
            <select className={selectClass} value={form.calculationRegime} onChange={(e) => update("calculationRegime", e.target.value as CompanyTaxSettings["calculationRegime"])}>
              <option value="COMPETENCIA">Competência</option>
              <option value="CAIXA">Caixa</option>
            </select>
          </Field>
          <Field label="PIS/COFINS">
            <select className={selectClass} value={form.pisCofinsRegime} onChange={(e) => update("pisCofinsRegime", e.target.value as CompanyTaxSettings["pisCofinsRegime"])}>
              <option value="SIMPLES">Simples</option>
              <option value="CUMULATIVO">Cumulativo</option>
              <option value="NAO_CUMULATIVO">Não cumulativo</option>
              <option value="PENDENTE_CONFIRMACAO">Pendente de confirmação</option>
            </select>
          </Field>
          <Field label="UF">
            <Input maxLength={2} value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Inscrição Estadual">
            <Input value={form.stateRegistration || ""} onChange={(e) => update("stateRegistration", e.target.value)} />
          </Field>
          <Field label="CNAE principal">
            <Input value={form.mainCnae || ""} onChange={(e) => update("mainCnae", e.target.value)} />
          </Field>
          <Field label="Anexo do Simples">
            <select className={selectClass} value={form.simplesAnnex || ""} onChange={(e) => update("simplesAnnex", e.target.value || null)}>
              <option value="">—</option>
              <option value="III">Anexo III</option>
              <option value="IV">Anexo IV</option>
              <option value="V">Anexo V</option>
              <option value="I">Anexo I</option>
              <option value="II">Anexo II</option>
            </select>
          </Field>
          <Field label="Atividade principal">
            <Input value={form.mainActivity || ""} onChange={(e) => update("mainActivity", e.target.value)} />
          </Field>
          <Field label="Receita acumulada 12 meses">
            <Input type="number" min="0" value={form.accumulatedRevenue ?? ""} onChange={(e) => update("accumulatedRevenue", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Tipo contribuinte ICMS">
            <select className={selectClass} value={form.icmsContribType || ""} onChange={(e) => update("icmsContribType", (e.target.value || null) as CompanyTaxSettings["icmsContribType"])}>
              <option value="">—</option>
              <option value="SIM">Sim</option>
              <option value="NAO">Não</option>
              <option value="ISENTO">Isento</option>
            </select>
          </Field>
          <Field label="Inscrição Municipal">
            <Input value={form.municipalRegistration || ""} onChange={(e) => update("municipalRegistration", e.target.value)} />
          </Field>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-5">
        <Check label="Contribuinte ICMS" checked={form.isIcmsTaxpayer} onChange={(c) => update("isIcmsTaxpayer", c)} />
        <Check label="Contribuinte IPI" checked={form.isIpiTaxpayer} onChange={(c) => update("isIpiTaxpayer", c)} />
        <Check label="Presta serviço" checked={form.providesService} onChange={(c) => update("providesService", c)} />
        <Check label="Vende mercadoria" checked={form.sellsMerchandise} onChange={(c) => update("sellsMerchandise", c)} />
      </div>

      {activeTab === "simples" && isSimples && (
        <div className="mt-5">
          <h3 className="text-xs font-extrabold text-ink">Simples Nacional</h3>
          <p className="mt-1 text-[11px] text-subtle">Configure as alíquotas e valores do Simples Nacional. O Fator R e alíquota efetiva são calculados automaticamente.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Receita acumulada 12 meses (R$)">
              <Input type="number" min="0" value={form.simplesRevenue12m ?? ""} onChange={(e) => update("simplesRevenue12m", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Folha de pagamento 12 meses (R$)">
              <Input type="number" min="0" value={form.simplesPayroll12m ?? ""} onChange={(e) => update("simplesPayroll12m", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <div className="flex items-end">
              <div className="rounded-xl border border-line bg-surface p-3">
                <p className="text-[10px] font-bold text-subtle">Fator R calculado</p>
                <p className="text-sm font-extrabold text-ink">{computedFatorR != null ? `${computedFatorR}%` : "—"}</p>
                <p className="text-[10px] text-subtle">{computedFatorR != null ? (computedFatorR > 28 ? "Anexo V (Fator R > 28%)" : "Anexo III/IV (Fator R ≤ 28%)") : "Informe receita e folha"}</p>
              </div>
            </div>
            <Field label="Alíquota nominal (%)">
              <Input type="number" min="0" step="0.01" value={form.simplesNominalRate ?? ""} onChange={(e) => update("simplesNominalRate", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Dedução (R$)">
              <Input type="number" min="0" step="0.01" value={form.simplesDeductAmount ?? ""} onChange={(e) => update("simplesDeductAmount", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Alíquota efetiva (%)">
              <Input type="number" min="0" step="0.01" value={form.simplesEffectiveRate ?? ""} onChange={(e) => update("simplesEffectiveRate", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="% ICMS no Simples">
              <Input type="number" min="0" step="0.01" value={form.simplesIcmsPercent ?? ""} onChange={(e) => update("simplesIcmsPercent", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="% ISS no Simples">
              <Input type="number" min="0" step="0.01" value={form.simplesIssPercent ?? ""} onChange={(e) => update("simplesIssPercent", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="% CPP no Simples">
              <Input type="number" min="0" step="0.01" value={form.simplesCppPercent ?? ""} onChange={(e) => update("simplesCppPercent", e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>
          <div className="mt-4">
            <Check
              label="Override manual — estou ciente que substituirá o cálculo automático do Fator R"
              checked={form.simplesManualOverride}
              onChange={(c) => update("simplesManualOverride", c)}
            />
          </div>
          <div className="mt-3 rounded-xl border border-line bg-surface p-3">
            <p className="text-[10px] font-bold text-subtle">Regra Simples Nacional</p>
            <p className="text-[11px] text-subtle">No Simples Nacional: ICMS próprio = 0, PIS/COFINS = 0, utiliza-se CSOSN em vez de CST. O DAS recolhe todos os tributos de forma unificada.</p>
          </div>
        </div>
      )}

      {activeTab === "presumido" && isPresumido && (
        <div className="mt-5">
          <h3 className="text-xs font-extrabold text-ink">Lucro Presumido</h3>
          <p className="mt-1 text-[11px] text-subtle">Configure as bases de presunção e alíquotas do Lucro Presumido.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Base de presunção IRPJ (%)">
              <select className={selectClass} value={form.presumidoIrpjBase ?? ""} onChange={(e) => update("presumidoIrpjBase", e.target.value ? Number(e.target.value) : null)}>
                <option value="">—</option>
                <option value="32">32% (Receita geral)</option>
                <option value="8">8% (Revenda de combustíveis)</option>
                <option value="4">4% (Serviços)</option>
              </select>
            </Field>
            <Field label="Base de presunção CSLL (%)">
              <select className={selectClass} value={form.presumidoCsllBase ?? ""} onChange={(e) => update("presumidoCsllBase", e.target.value ? Number(e.target.value) : null)}>
                <option value="">—</option>
                <option value="32">32% (Receita geral)</option>
                <option value="12">12% (Revenda de combustíveis)</option>
                <option value="4">4% (Serviços)</option>
              </select>
            </Field>
            <Field label="Alíquota PIS (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoPisRate ?? ""} onChange={(e) => update("presumidoPisRate", e.target.value ? Number(e.target.value) : null)} placeholder="0.65" />
            </Field>
            <Field label="Alíquota COFINS (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoCofinsRate ?? ""} onChange={(e) => update("presumidoCofinsRate", e.target.value ? Number(e.target.value) : null)} placeholder="3.00" />
            </Field>
            <Field label="Alíquota ICMS interno (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoIcmsRate ?? ""} onChange={(e) => update("presumidoIcmsRate", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Alíquota ISS (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoIssRate ?? ""} onChange={(e) => update("presumidoIssRate", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Alíquota IPI (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoIpiRate ?? ""} onChange={(e) => update("presumidoIpiRate", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="RAT (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoRatPercent ?? ""} onChange={(e) => update("presumidoRatPercent", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Terceiros SAT (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoThirdParty ?? ""} onChange={(e) => update("presumidoThirdParty", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="INSS patronal (%)">
              <Input type="number" min="0" step="0.01" value={form.presumidoInssPatronal ?? ""} onChange={(e) => update("presumidoInssPatronal", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Vencimento IRPJ">
              <select className={selectClass} value={form.presumidoIrpjVencimento ?? ""} onChange={(e) => update("presumidoIrpjVencimento", (e.target.value || null) as CompanyTaxSettings["presumidoIrpjVencimento"])}>
                <option value="">—</option>
                <option value="ULTIMO_DIA_UTIL">Último dia útil</option>
                <option value="DIA_15">Dia 15</option>
                <option value="DIA_20">Dia 20</option>
                <option value="DIA_25">Dia 25</option>
                <option value="DIA_30">Dia 30</option>
              </select>
            </Field>
            <Field label="Vencimento CSLL">
              <select className={selectClass} value={form.presumidoCsllVencimento ?? ""} onChange={(e) => update("presumidoCsllVencimento", (e.target.value || null) as CompanyTaxSettings["presumidoCsllVencimento"])}>
                <option value="">—</option>
                <option value="ULTIMO_DIA_UTIL">Último dia útil</option>
                <option value="DIA_15">Dia 15</option>
                <option value="DIA_20">Dia 20</option>
                <option value="DIA_25">Dia 25</option>
                <option value="DIA_30">Dia 30</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 rounded-xl border border-line bg-surface p-3">
            <p className="text-[10px] font-bold text-subtle">Regra Lucro Presumido</p>
            <p className="text-[11px] text-subtle">IRPJ = Base presunção × Receita × 15%. CSLL = Base presunção × Receita × 9%. PIS/COFINS cumulativo: sem crédito. ICMS: alíquota interna da UF.</p>
          </div>
        </div>
      )}

      {activeTab === "real" && isReal && (
        <div className="mt-5">
          <h3 className="text-xs font-extrabold text-ink">Lucro Real</h3>
          <p className="mt-1 text-[11px] text-subtle">Configure as alíquotas e controles do Lucro Real.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Período de apuração">
              <select className={selectClass} value={form.realapuracaoPeriod ?? ""} onChange={(e) => update("realapuracaoPeriod", (e.target.value || null) as CompanyTaxSettings["realapuracaoPeriod"])}>
                <option value="">—</option>
                <option value="MENSAL">Mensal</option>
                <option value="TRIMESTRAL">Trimestral</option>
              </select>
            </Field>
            <Field label="Alíquota PIS (%)">
              <Input type="number" min="0" step="0.01" value={form.realPisRate ?? ""} onChange={(e) => update("realPisRate", e.target.value ? Number(e.target.value) : null)} placeholder="1.65" />
            </Field>
            <Field label="Alíquota COFINS (%)">
              <Input type="number" min="0" step="0.01" value={form.realCofinsRate ?? ""} onChange={(e) => update("realCofinsRate", e.target.value ? Number(e.target.value) : null)} placeholder="7.60" />
            </Field>
            <Field label="Alíquota IRPJ (%)">
              <Input type="number" min="0" step="0.01" value={form.realIrpjRate ?? ""} onChange={(e) => update("realIrpjRate", e.target.value ? Number(e.target.value) : null)} placeholder="15.00" />
            </Field>
            <Field label="Alíquota CSLL (%)">
              <Input type="number" min="0" step="0.01" value={form.realCsllRate ?? ""} onChange={(e) => update("realCsllRate", e.target.value ? Number(e.target.value) : null)} placeholder="9.00" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-5">
            <Check label="Crédito PIS/COFINS permitido" checked={form.realCreditAllowed} onChange={(c) => update("realCreditAllowed", c)} />
            <Check label="Controle LALUR" checked={form.realLalurControl} onChange={(c) => update("realLalurControl", c)} />
            <Check label="Controle prejuízo fiscal" checked={form.realPrejuizoControl} onChange={(c) => update("realPrejuizoControl", c)} />
          </div>
          <div className="mt-3 rounded-xl border border-line bg-surface p-3">
            <p className="text-[10px] font-bold text-subtle">Regra Lucro Real</p>
            <p className="text-[11px] text-subtle">PIS/COFINS não cumulativo: crédito sobre insumos. IRPJ e CSLL sobre lucro real (após adições/exclusões LALUR). ICMS com crédito integral.</p>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="lime" onClick={() => save.mutate()} disabled={save.isPending || repair.isPending || !form.uf}>
          {save.isPending ? "Salvando..." : "Salvar configuração fiscal"}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-[11px] font-extrabold">{label}</span>{children}</label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-ink" />{label}</label>;
}
