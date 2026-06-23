"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { notify } from "@/components/toast-viewport";
import { buscarCnpj, buscarCpf, salvarCliente } from "@/lib/services/cliente-service";
import { normalizeCnpj, normalizeCpf } from "@/lib/utils";
import type React from "react";

type FormState = Record<string, unknown>;

export function ClientForm({ companyId }: { companyId?: string }) {
  const [tab, setTab] = useState<"PJ" | "PF">("PJ");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>({ tipoPessoa: "PJ", companyId });

  const lookupCnpj = useMutation({
    mutationFn: (cnpj: string) => buscarCnpj(cnpj),
    onMutate: () => setLoadingLookup(true),
    onSuccess: (data: unknown) => {
      setLoadingLookup(false);
      const payload = data as Record<string, unknown>;
      const alertas = Array.isArray((payload.alertas as unknown)) ? (payload.alertas as unknown[]) : [];
      const hasIeAlert = alertas.some((a) => typeof a === 'object' && a !== null && (a as Record<string, unknown>).hasOwnProperty('code') && (a as Record<string, unknown>).code === 'IE_NOT_FOUND');
      if (hasIeAlert) {
        notify({ title: "IE não encontrada automaticamente. Confirme manualmente antes de emitir NF-e.", tone: "info" });
      } else {
        notify({ title: "CNPJ consultado", description: "Dados preenchidos automaticamente." });
      }
      const fields: FormState = {
        cnpj: payload.cnpj,
        razaoSocial: payload.razaoSocial,
        nomeFantasia: payload.nomeFantasia,
        inscricaoEstadual: payload.inscricaoEstadual,
        regimeTributario: payload.regimeTributario,
        cnae: payload.cnae,
        atividadeEconomica: payload.atividadeEconomica,
        situacaoCadastral: payload.situacaoCadastral,
        cidade: payload.cidade,
        uf: payload.uf,
        logradouro: payload.logradouro,
        codigoIbge: payload.codigoIbge,
      };
      setForm((f) => ({ ...f, ...fields, tipoPessoa: "PJ" }));
      const auto: Record<string, boolean> = {};
      Object.keys(fields).forEach((k) => {
        const v = (fields as Record<string, unknown>)[k];
        if (v !== null && v !== undefined && v !== "") auto[k] = true;
      });
      setAutoFilled(auto);
    },
    onError: (error: unknown) => {
      setLoadingLookup(false);
      const msg = (error as Error)?.message || "Não foi possível consultar o CNPJ agora.";
      notify({ title: "Erro", description: msg, tone: "error" });
    },
  });

  const lookupCpf = useMutation({
    mutationFn: (cpf: string) => buscarCpf(cpf),
    onMutate: () => setLoadingLookup(true),
    onSuccess: (data: unknown) => {
      setLoadingLookup(false);
      const payload = data as Record<string, unknown>;
      const alertasCpf = Array.isArray((payload.alertas as unknown)) ? (payload.alertas as unknown[]) : [];
      const hasProviderAlert = alertasCpf.some((a) => typeof a === 'object' && a !== null && (a as Record<string, unknown>).hasOwnProperty('code') && (a as Record<string, unknown>).code === 'CPF_PROVIDER_NOT_CONFIGURED');
      if (hasProviderAlert) {
        notify({ title: "Provider de CPF não configurado. Preencha manualmente.", tone: "info" });
      } else {
        notify({ title: "CPF consultado", description: "Dados preenchidos automaticamente." });
      }
      setForm((f) => ({ ...f, ...payload, tipoPessoa: "PF" }));
    },
    onError: (error: unknown) => {
      setLoadingLookup(false);
      const msg = (error as Error)?.message || "Não foi possível consultar o CPF agora.";
      notify({ title: "Erro", description: msg, tone: "error" });
    },
  });

  const save = useMutation({
    mutationFn: (payload: FormState) => salvarCliente(payload),
    onSuccess: () => notify({ title: "Cliente salvo." }),
    onError: (error: unknown) => notify({ title: "Erro ao salvar", description: (error as Error)?.message }),
  });

  function handleBuscarDocumento() {
    if (tab === "PJ") {
      const digits = normalizeCnpj((form.cnpj as string) || "");
      if (digits.length !== 14) return notify({ title: "CNPJ inválido.", tone: "error" });
      lookupCnpj.mutate(digits);
    } else {
      const cpf = normalizeCpf((form.cpf as string) || "");
      if (cpf.length !== 11) return notify({ title: "CPF inválido.", tone: "error" });
      lookupCpf.mutate(cpf);
    }
  }

  const onChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <Card className="p-5">
      <div className="mb-4 flex gap-2">
        <Button variant={tab === "PJ" ? "lime" : "outline"} onClick={() => setTab("PJ")}>Pessoa Jurídica</Button>
        <Button variant={tab === "PF" ? "lime" : "outline"} onClick={() => setTab("PF")}>Pessoa Física</Button>
      </div>

      {tab === "PJ" ? (
        <div className="grid gap-3">
          <div className="flex gap-2">
            <Input placeholder="CNPJ" value={(form.cnpj as string) || ""} onChange={onChange("cnpj")} />
            <Button onClick={handleBuscarDocumento} disabled={loadingLookup}>{loadingLookup ? "Buscando..." : "Buscar CNPJ"}</Button>
            <Button variant="outline" onClick={() => { setForm({ tipoPessoa: "PJ", companyId }); setAutoFilled({}); }}>Limpar</Button>
          </div>

          <Input placeholder="Razão Social" value={(form.razaoSocial as string) || ""} onChange={onChange("razaoSocial")} className={autoFilled["razaoSocial"] ? "ring-2 ring-emerald-200" : ""} />
          <Input placeholder="Nome Fantasia" value={(form.nomeFantasia as string) || ""} onChange={onChange("nomeFantasia")} className={autoFilled["nomeFantasia"] ? "ring-2 ring-emerald-200" : ""} />
          <Input placeholder="Inscrição Estadual" value={(form.inscricaoEstadual as string) || ""} onChange={onChange("inscricaoEstadual")} className={!form.inscricaoEstadual ? "border-amber-400" : ""} />
          <Input placeholder="Regime Tributário" value={(form.regimeTributario as string) || ""} onChange={onChange("regimeTributario")} />
          <Input placeholder="CNAE" value={(form.cnae as string) || ""} onChange={onChange("cnae")} />
          <Input placeholder="Atividade Econômica" value={(form.atividadeEconomica as string) || ""} onChange={onChange("atividadeEconomica")} />
          <Input placeholder="Telefone" value={(form.telefone as string) || ""} onChange={onChange("telefone")} />
          <Input placeholder="E-mail" value={(form.email as string) || ""} onChange={onChange("email")} />
          <Input placeholder="CEP" value={(form.cep as string) || ""} onChange={onChange("cep")} />
          <Input placeholder="Logradouro" value={(form.logradouro as string) || ""} onChange={onChange("logradouro")} />
          <Input placeholder="Número" value={(form.numero as string) || ""} onChange={onChange("numero")} />
          <Input placeholder="Complemento" value={(form.complemento as string) || ""} onChange={onChange("complemento")} />
          <Input placeholder="Bairro" value={(form.bairro as string) || ""} onChange={onChange("bairro")} />
          <Input placeholder="Cidade" value={(form.cidade as string) || ""} onChange={onChange("cidade")} />
          <Input placeholder="UF" value={(form.uf as string) || ""} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))} />

          <div className="flex justify-end gap-2">
            <Button onClick={() => save.mutate(form)}>{save.isPending ? "Salvando..." : "Salvar Cliente"}</Button>
            <Button variant="outline" onClick={() => { setForm({ tipoPessoa: "PJ", companyId }); setAutoFilled({}); }}>Limpar</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex gap-2">
            <Input placeholder="CPF" value={(form.cpf as string) || ""} onChange={onChange("cpf")} />
            <Button onClick={handleBuscarDocumento} disabled={loadingLookup}>{loadingLookup ? "Buscando..." : "Buscar CPF"}</Button>
            <Button variant="outline" onClick={() => { setForm({ tipoPessoa: "PF", companyId }); }}>Limpar</Button>
          </div>
          <Input placeholder="Nome Completo" value={(form.nome as string) || ""} onChange={onChange("nome")} />
          <Input placeholder="RG" value={(form.rg as string) || ""} onChange={onChange("rg")} />
          <Input placeholder="Data de Nascimento" value={(form.dataNascimento as string) || ""} onChange={onChange("dataNascimento")} />
          <Input placeholder="Telefone" value={(form.telefone as string) || ""} onChange={onChange("telefone")} />
          <Input placeholder="E-mail" value={(form.email as string) || ""} onChange={onChange("email")} />
          <Input placeholder="CEP" value={(form.cep as string) || ""} onChange={onChange("cep")} />
          <Input placeholder="Logradouro" value={(form.logradouro as string) || ""} onChange={onChange("logradouro")} />
          <Input placeholder="Número" value={(form.numero as string) || ""} onChange={onChange("numero")} />
          <Input placeholder="Complemento" value={(form.complemento as string) || ""} onChange={onChange("complemento")} />
          <Input placeholder="Bairro" value={(form.bairro as string) || ""} onChange={onChange("bairro")} />
          <Input placeholder="Cidade" value={(form.cidade as string) || ""} onChange={onChange("cidade")} />
          <Input placeholder="UF" value={(form.uf as string) || ""} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))} />

          <div className="flex justify-end gap-2">
            <Button onClick={() => save.mutate(form)}>{save.isPending ? "Salvando..." : "Salvar Cliente"}</Button>
            <Button variant="outline" onClick={() => { setForm({ tipoPessoa: "PF", companyId }); }}>Limpar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
