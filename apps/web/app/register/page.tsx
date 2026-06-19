"use client";

import { ArrowLeft, Building2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { register } from "@/lib/services/auth-service";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmation"))) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(String(form.get("name")), String(form.get("email")), password);
      notify({ title: "Conta criada", description: "Cadastre a primeira empresa." });
      router.push("/onboarding");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Cadastro não concluído.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <div className="w-full max-w-xl rounded-3xl bg-surface p-6 shadow-card md:p-10">
        <div className="flex items-center justify-between">
          <BrandMark />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
        <div className="mt-10">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-lime">
            <UserPlus className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.05em]">Crie seu acesso</h1>
          <p className="mt-2 text-sm text-subtle">
            O cadastro visual está pronto para conexão com o módulo de autenticação.
          </p>
        </div>
        <form method="post" onSubmit={submit}>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Input name="name" placeholder="Nome completo" required />
            <Input name="email" type="email" placeholder="E-mail corporativo" required />
            <Input name="password" type="password" placeholder="Senha" minLength={6} required />
            <Input name="confirmation" type="password" placeholder="Confirmar senha" minLength={6} required />
          </div>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
          <Button type="submit" variant="lime" size="lg" className="mt-6 w-full" disabled={loading}>
            <Building2 className="h-4 w-4" />
            {loading ? "Criando acesso..." : "Continuar para empresa"}
          </Button>
        </form>
      </div>
    </main>
  );
}
