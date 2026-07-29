"use client";

import { ArrowLeft, ArrowRight, Cloud, Loader2, Save, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { usePermissionsContext } from "@/components/providers/permissions-provider";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Mdfe, MdfePayload, MdfeValidationIssue } from "@/lib/mdfe-types";
import { mdfeService } from "@/lib/services/mdfe-service";
import { MdfeAdditionalInfoStep } from "./mdfe-additional-info-step";
import { MdfeAnttStep } from "./mdfe-antt-step";
import { MdfeDocumentsStep } from "./mdfe-documents-step";
import { MdfeGeneralStep } from "./mdfe-general-step";
import { MdfeInsuranceStep } from "./mdfe-insurance-step";
import { MdfeReviewStep } from "./mdfe-review-step";
import { MdfeRouteStep } from "./mdfe-route-step";
import { MdfeStepper, mdfeSteps } from "./mdfe-stepper";
import { MdfeValidationPanel } from "./mdfe-validation-panel";
import { MdfeVehiclesStep } from "./mdfe-vehicles-step";

const initialPayload: MdfePayload = {
  series: "1",
  issuerType: "PRESTADOR_SERVICO_TRANSPORTE",
  carrierType: "ETC",
  modal: "RODOVIARIO",
  emissionType: "NORMAL",
  currentStep: 1,
  cargoUnit: "01",
  cargoQuantity: 0,
  routeStates: [],
  loadingMunicipalities: [],
  unloadingCities: [],
  trailers: [],
  drivers: [],
  fiscalDocuments: [],
  contractors: [],
  ciots: [],
  tollVouchers: [],
  payments: [],
  insurances: [],
  seals: [],
};

function payloadFromMdfe(mdfe: Mdfe): MdfePayload {
  return {
    ...initialPayload,
    ...mdfe,
    routeStates: Array.isArray(mdfe.routeStates)
      ? mdfe.routeStates.map((item) => typeof item === "string" ? item : String((item as { stateCode?: string }).stateCode ?? "")).filter(Boolean)
      : [],
    insurances: Array.isArray(mdfe.insurances)
      ? mdfe.insurances.map((item) => {
          const value = item as Record<string, unknown>;
          const endorsements = Array.isArray(value.endorsements)
            ? value.endorsements.map((entry) => typeof entry === "string" ? entry : String((entry as { endorsementNumber?: string }).endorsementNumber ?? "")).filter(Boolean)
            : [];
          return { ...value, endorsements };
        })
      : [],
  };
}

export function MdfeFormView({ mdfeId }: { mdfeId?: string }) {
  const router = useRouter();
  const { hasPermission } = usePermissionsContext();
  const [id, setId] = useState(mdfeId ?? "");
  const [step, setStep] = useState(1);
  const [value, setValue] = useState<MdfePayload>(initialPayload);
  const [issues, setIssues] = useState<MdfeValidationIssue[]>([]);
  const [loading, setLoading] = useState(Boolean(mdfeId));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const creating = useRef(false);

  useEffect(() => {
    if (!mdfeId) return;
    mdfeService.get(mdfeId).then((mdfe) => {
      setValue(payloadFromMdfe(mdfe));
      setStep(Number(mdfe.currentStep) || 1);
    }).catch((error) => notify({ title: "MDF-e não carregado", description: (error as Error).message, tone: "error" }))
      .finally(() => setLoading(false));
  }, [mdfeId]);

  const save = useCallback(async (silent = false) => {
    if (saving || creating.current) return id;
    setSaving(true);
    try {
      let currentId = id;
      if (!currentId) {
        creating.current = true;
        const created = await mdfeService.create({
          series: value.series,
          issuerType: value.issuerType,
          carrierType: value.carrierType,
          modal: value.modal,
          emissionType: value.emissionType,
          currentStep: step,
        });
        currentId = created.id;
        setId(created.id);
        window.history.replaceState(null, "", `/mdfe/${created.id}/editar`);
      }
      const saved = await mdfeService.update(currentId, { ...value, currentStep: step });
      setValue(payloadFromMdfe(saved));
      setDirty(false);
      setLastSaved(new Date());
      if (!silent) notify({ title: "Rascunho salvo", description: "Os dados do MDF-e foram persistidos.", tone: "success" });
      return currentId;
    } catch (error) {
      if (!silent) notify({ title: "Não foi possível salvar", description: (error as Error).message, tone: "error" });
      throw error;
    } finally {
      creating.current = false;
      setSaving(false);
    }
  }, [id, saving, step, value]);

  useEffect(() => {
    if (!dirty) return;
    const timeout = window.setTimeout(() => void save(true).catch(() => undefined), 1800);
    return () => window.clearTimeout(timeout);
  }, [dirty, save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(patch: MdfePayload) {
    setValue((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  async function validate() {
    try {
      const currentId = await save(true);
      if (!currentId) return;
      const result = await mdfeService.validate(currentId);
      setIssues(result.issues ?? []);
      notify({
        title: result.valid ? "MDF-e validado" : "Validação bloqueada",
        description: result.valid ? "Pronto para geração, assinatura e autorização." : `${result.issues.length} pendência(s) encontrada(s).`,
        tone: result.valid ? "success" : "error",
      });
    } catch (error) {
      notify({ title: "Falha na validação", description: (error as Error).message, tone: "error" });
    }
  }

  async function authorize() {
    if (!id || !window.confirm("Autorizar este MDF-e na SVRS? Esta ação fiscal não pode ser desfeita por edição.")) return;
    try {
      await mdfeService.generateXml(id);
      await mdfeService.sign(id);
      await mdfeService.authorize(id);
      notify({ title: "MDF-e autorizado", tone: "success" });
      router.push(`/mdfe/${id}`);
    } catch (error) {
      notify({ title: "Autorização não concluída", description: (error as Error).message, tone: "error" });
    }
  }

  const stepComponents = [
    <MdfeGeneralStep key="general" value={value} onChange={change} />,
    <MdfeRouteStep key="route" value={value} onChange={change} />,
    <MdfeVehiclesStep key="vehicles" value={value} onChange={change} />,
    <MdfeDocumentsStep key="documents" value={value} onChange={change} />,
    <MdfeAnttStep key="antt" value={value} onChange={change} />,
    <MdfeInsuranceStep key="insurance" value={value} onChange={change} />,
    <MdfeAdditionalInfoStep key="additional" value={value} onChange={change} />,
    <MdfeReviewStep key="review" value={value} onChange={change} />,
  ];

  if (loading) return <Card className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></Card>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Modelo 58 · SVRS"
        title={id ? `Editar MDF-e ${value.number ?? ""}` : "Novo MDF-e"}
        description="Rascunho por etapas, validação fiscal detalhada e autorização idempotente."
        action={<Button variant="outline" onClick={() => void save(false)} disabled={saving}><Save className="h-4 w-4" /> Salvar</Button>}
      />
      <Card className="p-4"><MdfeStepper currentStep={step} onSelect={setStep} /></Card>
      <div className="flex items-center gap-2 text-xs text-subtle">
        <Cloud className="h-4 w-4" />
        {saving ? "Salvando…" : dirty ? "Alterações pendentes" : lastSaved ? `Salvo às ${lastSaved.toLocaleTimeString("pt-BR")}` : "Salvamento automático ativo"}
      </div>
      <Card className="p-5 md:p-7">
        <h2 className="mb-5 text-lg font-extrabold">{step}. {mdfeSteps[step - 1]}</h2>
        {stepComponents[step - 1]}
      </Card>
      {step === 8 && <MdfeValidationPanel issues={issues} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline"><Link href="/mdfe"><ArrowLeft className="h-4 w-4" /> Voltar à lista</Link></Button>
        <div className="flex flex-wrap gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep((current) => current - 1)}><ArrowLeft className="h-4 w-4" /> Anterior</Button>}
          {step < 8 && <Button variant="lime" onClick={() => { void save(true).then(() => setStep((current) => current + 1)); }}>Salvar e continuar <ArrowRight className="h-4 w-4" /></Button>}
          {step === 8 && <Button variant="outline" onClick={() => void validate()}><ShieldCheck className="h-4 w-4" /> Validar</Button>}
          {step === 8 && hasPermission("fiscal.mdfe.authorize") && <Button variant="lime" onClick={() => void authorize()} disabled={issues.some((issue) => issue.severity === "BLOCKING")}><Send className="h-4 w-4" /> Autorizar na SVRS</Button>}
        </div>
      </div>
    </div>
  );
}
