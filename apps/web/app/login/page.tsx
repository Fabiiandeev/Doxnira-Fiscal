import {
  BadgeCheck,
  FileCheck2,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = { title: "Entrar" };

const benefits = [
  {
    icon: ScanSearch,
    title: "Sincronização automática",
    description: "NF-e e XMLs organizados por CNPJ e NSU.",
  },
  {
    icon: ShieldCheck,
    title: "Certificado protegido",
    description: "Credenciais sensíveis nunca aparecem em logs.",
  },
  {
    icon: FileCheck2,
    title: "Rastreabilidade fiscal",
    description: "Eventos e manifestações registrados para auditoria.",
  },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-canvas p-3 md:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-3xl bg-surface shadow-card md:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-0 bg-login-grid bg-[size:42px_42px] opacity-25" />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-lime/20 blur-3xl" />
          <div className="absolute -bottom-16 left-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative z-10">
            <BrandMark inverse />
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-lime" />
              Operação fiscal em uma única visão
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.055em] xl:text-[52px]">
              Seus XMLs fiscais sob controle.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/55">
              Sincronize, monitore e armazene documentos fiscais com segurança,
              contexto e rastreabilidade.
            </p>

            <div className="mt-10 grid gap-3 xl:grid-cols-3">
              {benefits.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"
                >
                  <div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-lime text-ink">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-extrabold">{title}</p>
                  <p className="mt-2 text-[10px] leading-4 text-white/45">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-[10px] font-bold text-white/35">
            <span>NS Sistemas · Ambiente protegido</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Serviços operacionais
            </span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-12 lg:hidden">
              <BrandMark />
            </div>
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pastel-green text-emerald-700">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle">
                  Acesso seguro
                </p>
                <p className="text-xs font-bold">Ambiente de produção</p>
              </div>
            </div>
            <h2 className="text-balance text-[34px] font-extrabold leading-tight tracking-[-0.05em]">
              Entre na sua central fiscal
            </h2>
            <p className="mt-3 text-sm leading-6 text-subtle">
              Use suas credenciais para acessar documentos, certificados e
              sincronizações.
            </p>

            <LoginForm />

            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-muted p-4">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
              <p className="text-[10px] leading-4 text-subtle">
                O acesso é monitorado. Senhas, conteúdo PFX e XMLs sensíveis nunca são
                registrados nos logs da aplicação.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

