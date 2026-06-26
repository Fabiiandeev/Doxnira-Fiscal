"use client";

import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/services/auth-service";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      const result = await login(String(form.get("email")), String(form.get("password")));
      notify({ title: "Acesso autorizado", description: "Sessão fiscal iniciada." });
      window.location.assign(result.hasCompany ? "/dashboard" : "/onboarding");
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : "Não foi possível acessar a central.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-xs font-extrabold text-ink">
          E-mail corporativo
        </label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            id="email"
            name="email"
            type="email"
            className="h-12 rounded-2xl pl-11"
            required
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-extrabold text-ink">
            Senha
          </label>
          <Link
            href="/help"
            className="text-[11px] font-extrabold text-subtle transition hover:text-ink"
          >
            Esqueci minha senha
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="h-12 rounded-2xl pl-11 pr-12"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
            aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-[11px] font-bold text-subtle">
        <input
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded border-line accent-ink"
        />
        Manter meu acesso neste dispositivo
      </label>

      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-[11px] font-bold text-red-700">
          {error}
        </div>
      )}

      <Button type="submit" variant="lime" size="lg" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando acesso...
          </>
        ) : (
          <>
            Entrar na central
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-[11px] text-subtle">
        Ainda não tem acesso?{" "}
        <Link href="/register" className="font-extrabold text-ink hover:underline">
          Criar uma conta
        </Link>
      </p>
    </form>
  );
}
