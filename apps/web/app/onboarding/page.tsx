"use client";

import { BadgeCheck, Building2, FileKey2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CnpjLookupForm } from "@/components/companies/cnpj-lookup-form";
import { BrandMark } from "@/components/brand-mark";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCompanyId, getToken } from "@/lib/api";
import { createCompany } from "@/lib/services/company-service";
import {
  lookupToCompanyForm,
  lookupToCompanyPayload,
  lookupToTaxSettings,
  type CnpjLookupResponse,
} from "@/lib/services/cnpj-service";
import { saveTaxSettings } from "@/lib/services/tax-service";

const steps = [
  { label: "Empresa", icon: Building2, active: true },
  { label: "Certificado", icon: FileKey2 },
  { label: "Preferências", icon: SlidersHorizontal },
  { label: "Sincronização", icon: RefreshCw },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lookupData, setLookupData] = useState<CnpjLookupResponse | null>(null);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const [form, setForm] = useState({
    legalName: "",
    tradeName: "",
    cnpj: "",
    uf: "",
    city: "",
    stateRegistration: "",
    taxRegime: "",
    environment: "homologation" as "production" | "homologation",
  });

  function handleCnpjDataLoaded(data: CnpjLookupResponse) {
    const fields = lookupToCompanyForm(data);
    setLookupData(data);
    setForm((prev) => ({
      ...prev,
      legalName: fields.legalName || prev.legalName,
      tradeName: fields.tradeName || prev.tradeName,
      cnpj: fields.cnpj,
      uf: fields.uf || prev.uf,
      city: fields.city || prev.city,
      stateRegistration:
        fields.stateRegistration || prev.stateRegistration,
      taxRegime: fields.taxRegime,
      environment: fields.environment,
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const lookupPayload = lookupData
        ? lookupToCompanyPayload(lookupData)
        : null;
      const company = await createCompany({
        legalName: form.legalName,
        tradeName: form.tradeName,
        cnpj: form.cnpj.replace(/\D/g, ""),
        uf: form.uf,
        city: form.city,
        ...(lookupPayload ?? {}),
        stateRegistration:
          lookupPayload?.stateRegistration ||
          form.stateRegistration.replace(/\D/g, "") ||
          undefined,
        stateRegistrationFormatted:
          lookupPayload?.stateRegistrationFormatted ||
          form.stateRegistration ||
          undefined,
        taxRegime: lookupPayload?.taxRegime || form.taxRegime || undefined,
        environment: form.environment,
      });
      if (lookupData) {
        await saveTaxSettings(lookupToTaxSettings(lookupData), company.id);
      }
      setCompanyId(company.id);
      notify({ title: "Empresa cadastrada", description: "Configuração inicial concluída." });
      router.push("/dashboard");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas p-4 md:p-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-surface shadow-card">
        <header className="flex items-center justify-between border-b border-line px-6 py-5 md:px-8">
          <BrandMark />
          <p className="text-[11px] font-bold text-subtle">Configuração inicial</p>
        </header>
        <div className="grid md:grid-cols-[260px_1fr]">
          <aside className="border-b border-line bg-muted p-5 md:min-h-[680px] md:border-b-0 md:border-r">
            <p className="mb-5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-subtle">
              4 etapas
            </p>
            <div className="space-y-2">
              {steps.map(({ label, icon: Icon, active }, index) => (
                <div
                  key={label}
                  className={`flex items-center gap-3 rounded-xl p-3 ${
                    active ? "bg-lime" : "text-subtle"
                  }`}
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/70">
                    {index === 0 ? (
                      <BadgeCheck className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider">
                      Etapa {index + 1}
                    </p>
                    <p className="text-xs font-extrabold">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
          <form method="post" onSubmit={submit} className="p-6 md:p-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle">
              Etapa 1 de 4
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.05em]">
              Dados da empresa
            </h1>
            <p className="mt-2 text-sm text-subtle">
              Informe o CNPJ que será vinculado à central fiscal.
            </p>

            <div className="mt-8 border-t border-line pt-8">
              <p className="mb-4 text-[11px] font-extrabold uppercase text-subtle">Busca automática de dados</p>
              <CnpjLookupForm onDataLoaded={handleCnpjDataLoaded} />
            </div>

            <div className="mt-8 border-t border-line pt-8 space-y-4">
              <p className="text-[11px] font-extrabold uppercase text-subtle">Dados da empresa</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="Razão social"
                  required
                  className="sm:col-span-2"
                />
                <Input
                  value={form.tradeName}
                  onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                  placeholder="Nome fantasia"
                />
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="CNPJ"
                  required
                />
                <Input
                  value={form.stateRegistration}
                  onChange={(e) => setForm({ ...form, stateRegistration: e.target.value })}
                  placeholder="Inscrição estadual"
                />
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Cidade"
                />
                <Input
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                  placeholder="UF"
                  maxLength={2}
                  required
                />
                <Input
                  value={form.taxRegime}
                  onChange={(e) => setForm({ ...form, taxRegime: e.target.value })}
                  placeholder="Regime tributário"
                />
                <select
                  name="environment"
                  value={form.environment}
                  onChange={(e) => setForm({ ...form, environment: e.target.value as "production" | "homologation" })}
                  className="h-11 rounded-xl border border-line bg-white px-3.5 text-sm outline-none"
                >
                  <option value="homologation">Homologação</option>
                  <option value="production">Produção</option>
                </select>
                <Input
                  value={lookupData?.empresa.cnaePrincipal.codigoFormatado || ""}
                  placeholder="CNAE principal"
                  readOnly
                />
                <Input
                  value={lookupData?.fiscal.regimeApuracao || ""}
                  placeholder="Regime de apuração"
                  readOnly
                />
                <Input
                  value={lookupData?.empresa.cnaePrincipal.descricao || ""}
                  placeholder="Atividade principal"
                  readOnly
                  className="sm:col-span-2"
                />
                <Input
                  value={lookupData?.fiscal.pisCofins || ""}
                  placeholder="PIS/COFINS"
                  readOnly
                />
                <Input
                  value={lookupData?.fiscal.contribuinteICMS || ""}
                  placeholder="Contribuinte ICMS"
                  readOnly
                />
                <Input
                  value={lookupData?.fiscal.contribuinteIPI || ""}
                  placeholder="Contribuinte IPI"
                  readOnly
                />
              </div>
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
            <div className="mt-8 flex justify-end">
              <Button type="submit" variant="lime" size="lg" disabled={loading || !form.legalName || !form.cnpj || !form.uf}>
                {loading ? "Salvando..." : "Salvar e visualizar dashboard"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
