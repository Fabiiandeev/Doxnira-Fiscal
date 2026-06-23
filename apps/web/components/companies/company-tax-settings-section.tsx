"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
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
    taxRegime: "SIMPLES_NACIONAL",
    calculationRegime: "COMPETENCIA",
    uf: companyUf || "",
    stateRegistration: stateRegistration || "",
    mainCnae: "",
    simplesAnnex: "",
    mainActivity: "",
    isIcmsTaxpayer: false,
    isIpiTaxpayer: false,
    pisCofinsRegime: "SIMPLES",
    accumulatedRevenue: null,
  });
  const query = useQuery({
    queryKey: ["tax-settings", companyId],
    queryFn: () => getTaxSettings(companyId),
  });
  useEffect(() => {
    if (query.data) {
      setForm({
        ...query.data,
        stateRegistration: query.data.stateRegistration || "",
        mainCnae: query.data.mainCnae || "",
        simplesAnnex: query.data.simplesAnnex || "",
        mainActivity: query.data.mainActivity || "",
        accumulatedRevenue: query.data.accumulatedRevenue
          ? Number(query.data.accumulatedRevenue)
          : null,
      });
    }
  }, [query.data]);
  useEffect(() => {
    if (lookupData) setForm(lookupToTaxSettings(lookupData));
  }, [lookupData]);
  const save = useMutation({
    mutationFn: () => saveTaxSettings(form, companyId),
    onSuccess: () => {
      notify({ title: "Configuração fiscal salva" });
      queryClient.invalidateQueries({ queryKey: ["tax-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (error) =>
      notify({
        title: "Configuração fiscal não salva",
        description: error.message,
        tone: "error",
      }),
  });
  const repair = useMutation({
    mutationFn: () => repairTaxSettings(companyId),
    onSuccess: () => {
      notify({ title: "Configuração fiscal criada", description: "Dados mínimos foram salvos." });
      queryClient.invalidateQueries({ queryKey: ["tax-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (error) =>
      notify({
        title: "Correção automática falhou",
        description: error.message,
        tone: "error",
      }),
  });
  return (
    <Card className="mb-4 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-pastel-green text-emerald-700">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold">3. Configuração fiscal</h2>
          <p className="mt-1 text-[11px] text-subtle">
            Obrigatória para gerar o fechamento mensal assistido.
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
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Regime tributário">
          <select className={selectClass} value={form.taxRegime} onChange={(event) => setForm({ ...form, taxRegime: event.target.value as CompanyTaxSettings["taxRegime"] })}>
            <option value="SIMPLES_NACIONAL">Simples Nacional</option>
            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            <option value="LUCRO_REAL">Lucro Real</option>
            <option value="MEI">MEI</option>
            <option value="OUTRO">Outro</option>
            <option value="PENDENTE_CONFIRMACAO">Pendente de confirmação</option>
          </select>
        </Field>
        <Field label="Regime de apuração">
          <select className={selectClass} value={form.calculationRegime} onChange={(event) => setForm({ ...form, calculationRegime: event.target.value as CompanyTaxSettings["calculationRegime"] })}>
            <option value="COMPETENCIA">Competência</option>
            <option value="CAIXA">Caixa</option>
          </select>
        </Field>
        <Field label="PIS/COFINS">
          <select className={selectClass} value={form.pisCofinsRegime} onChange={(event) => setForm({ ...form, pisCofinsRegime: event.target.value as CompanyTaxSettings["pisCofinsRegime"] })}>
            <option value="SIMPLES">Simples</option>
            <option value="CUMULATIVO">Cumulativo</option>
            <option value="NAO_CUMULATIVO">Não cumulativo</option>
            <option value="PENDENTE_CONFIRMACAO">Pendente de confirmação</option>
          </select>
        </Field>
        <Field label="UF"><Input maxLength={2} value={form.uf} onChange={(event) => setForm({ ...form, uf: event.target.value.toUpperCase() })} /></Field>
        <Field label="Inscrição Estadual"><Input value={form.stateRegistration || ""} onChange={(event) => setForm({ ...form, stateRegistration: event.target.value })} /></Field>
        <Field label="CNAE principal"><Input value={form.mainCnae || ""} onChange={(event) => setForm({ ...form, mainCnae: event.target.value })} /></Field>
        <Field label="Anexo do Simples"><Input value={form.simplesAnnex || ""} onChange={(event) => setForm({ ...form, simplesAnnex: event.target.value })} /></Field>
        <Field label="Atividade principal"><Input value={form.mainActivity || ""} onChange={(event) => setForm({ ...form, mainActivity: event.target.value })} /></Field>
        <Field label="Receita acumulada 12 meses"><Input type="number" min="0" value={form.accumulatedRevenue ?? ""} onChange={(event) => setForm({ ...form, accumulatedRevenue: event.target.value ? Number(event.target.value) : null })} /></Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-5">
        <Check label="Contribuinte ICMS" checked={form.isIcmsTaxpayer} onChange={(checked) => setForm({ ...form, isIcmsTaxpayer: checked })} />
        <Check label="Contribuinte IPI" checked={form.isIpiTaxpayer} onChange={(checked) => setForm({ ...form, isIpiTaxpayer: checked })} />
      </div>
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
  return <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-ink" />{label}</label>;
}
