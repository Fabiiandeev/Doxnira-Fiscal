"use client";

import { BadgeCheck, Building2, FileKey2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCompanyId } from "@/lib/api";
import { createCompany } from "@/lib/services/company-service";

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      const company = await createCompany({
        legalName: String(form.get("legalName")),
        tradeName: String(form.get("tradeName")),
        cnpj: String(form.get("cnpj")),
        uf: String(form.get("uf")),
        stateRegistration: String(form.get("stateRegistration")),
        taxRegime: String(form.get("taxRegime")),
        environment: String(form.get("environment")) as "production" | "homologation",
      });
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
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Input name="legalName" className="sm:col-span-2" placeholder="Razão social" required />
              <Input name="tradeName" placeholder="Nome fantasia" />
              <Input name="cnpj" placeholder="CNPJ" required />
              <Input name="stateRegistration" placeholder="Inscrição estadual" />
              <Input name="uf" placeholder="UF" maxLength={2} required />
              <Input name="taxRegime" placeholder="Regime tributário" />
              <select name="environment" className="h-11 rounded-xl border border-line bg-white px-3.5 text-sm outline-none">
                <option value="production">Produção</option>
                <option value="homologation">Homologação</option>
              </select>
            </div>
            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
            <div className="mt-8 flex justify-end">
              <Button type="submit" variant="lime" size="lg" disabled={loading}>
                {loading ? "Salvando..." : "Salvar e visualizar dashboard"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
