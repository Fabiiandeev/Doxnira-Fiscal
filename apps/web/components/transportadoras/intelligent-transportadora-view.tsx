"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Search, AlertTriangle, Save, ArrowLeft, Loader2, Building2, MapPin, Truck, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { maskCnpj, normalizeCnpj } from "@/lib/utils";
import { createTransportadora, getTransportadora, lookupViaCep, updateTransportadora } from "@/lib/services/transportadora-service";
import { buscarCnpj } from "@/lib/services/cliente-service";
import type { Transportadora } from "@/lib/transportadora-types";
import { ApiError } from "@/lib/api";

interface Props { transportadoraId?: string; viewMode?: "create" | "view" | "edit"; onBack?: () => void; }

function mapFormToPayload(form: Partial<Transportadora>): Record<string, unknown> {
  const n = (v: unknown) => (v === "" || v === undefined || v === null) ? null : v;
  const d = (v: unknown) => { if (!v) return null; const r = String(v).replace(/\D/g, ""); return r.length > 0 ? r : null; };
  return {
    tipoPessoa: form.tipoPessoa ?? (form.cpf ? "PF" : "PJ"), cnpj: d(form.cnpj), cpf: d(form.cpf),
    razaoSocial: n(form.razaoSocial), nomeFantasia: n(form.nomeFantasia), nome: n(form.nome),
    inscricaoEstadual: n(form.inscricaoEstadual), inscricaoMunicipal: n(form.inscricaoMunicipal),
    regimeTributario: n(form.regimeTributario), crt: n(form.crt), indicadorIe: n(form.indicadorIe),
    tipoContribuinte: n(form.tipoContribuinte), contribuinteIcms: form.contribuinteIcms ?? null,
    antt: n(form.antt), rntrc: n(form.rntrc), tipoTransportadora: n(form.tipoTransportadora),
    placaVeiculo: n(form.placaVeiculo), ufPlaca: n(form.ufPlaca), tipoVeiculo: n(form.tipoVeiculo),
    modalidadeFrete: n(form.modalidadeFrete), permiteColeta: form.permiteColeta ?? null,
    permiteEntrega: form.permiteEntrega ?? null, cargaPerigosa: form.cargaPerigosa ?? null,
    temSeguro: form.temSeguro ?? null, apoliceSeguro: n(form.apoliceSeguro),
    cep: d(form.cep), logradouro: n(form.logradouro), numero: n(form.numero),
    complemento: n(form.complemento), bairro: n(form.bairro), municipio: n(form.municipio),
    uf: n(form.uf), codigoIbge: n(form.codigoIbge), codigoUfIbge: n(form.codigoUfIbge), pais: n(form.pais) ?? "BRASIL",
    email: n(form.email), telefone: d(form.telefone), whatsapp: n(form.whatsapp),
    observacoes: n(form.observacoes), ativo: form.ativo ?? true, fonteDados: n(form.fonteDados),
  };
}

export function IntelligentTransportadoraView({ transportadoraId, viewMode: viewModeProp, onBack }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Partial<Transportadora>>({ tipoPessoa: "PJ", ativo: true });
  const [docValue, setDocValue] = useState("");
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isReadOnly = (viewModeProp ?? (transportadoraId ? "edit" : "create")) === "view";

  useEffect(() => {
    if (!transportadoraId) return;
    let cancelled = false;
    setLoadingRecord(true);
    setLoadError(null);
    getTransportadora(transportadoraId).then((data) => {
      if (cancelled) return;
      setForm(data);
      setDocValue(data.cnpj ? maskCnpj(data.cnpj) : data.cpf ?? "");
    }).catch(() => {
      if (cancelled) return;
      setLoadError("Erro ao carregar dados.");
      notify({ title: "Erro ao carregar", tone: "error" });
    }).finally(() => { if (!cancelled) setLoadingRecord(false); });
    return () => { cancelled = true; };
  }, [transportadoraId]);

  useEffect(() => {
    const cep = String(form.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    const timer = setTimeout(async () => {
      const viaCep = await lookupViaCep(cep);
      if (!viaCep) return;
      setForm((prev) => {
        const u: Partial<Transportadora> = {};
        const s = (f: keyof Transportadora, v: unknown) => { if ((prev[f] == null || prev[f] === "") && v != null && v !== "") (u as Record<string, unknown>)[f] = v; };
        s("logradouro", viaCep.logradouro); s("bairro", viaCep.bairro); s("complemento", viaCep.complemento);
        s("municipio", viaCep.cidade); s("uf", viaCep.uf); s("codigoIbge", viaCep.codigoIbge);
        return Object.keys(u).length === 0 ? prev : { ...prev, ...u };
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [form.cep]);

  const onChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (isReadOnly) return;
    const raw = e.target.value;
    let v: unknown = raw || null;
    if (["contribuinteIcms", "permiteColeta", "permiteEntrega", "cargaPerigosa", "temSeguro", "ativo"].includes(field)) {
      v = raw === "true" ? true : raw === "false" ? false : null;
    }
    setForm((f) => ({ ...f, [field]: v }));
  }, [isReadOnly]);

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const raw = normalizeCnpj(docValue);
      if (raw.length !== 14) throw new Error("CNPJ inválido");
      return buscarCnpj(raw);
    },
    onMutate: () => setForm({ tipoPessoa: "PJ", cnpj: normalizeCnpj(docValue), ativo: true }),
    onSuccess: (data) => {
      const u: Partial<Transportadora> = {};
      const s = (f: keyof Transportadora, v: unknown) => { if (v != null && v !== "") (u as Record<string, unknown>)[f] = v; };
      s("cnpj", data.cnpj); s("razaoSocial", data.razaoSocial); s("nomeFantasia", data.nomeFantasia);
      s("inscricaoEstadual", data.inscricaoEstadual); s("inscricaoMunicipal", data.inscricaoMunicipal);
      s("regimeTributario", data.regimeTributario); s("crt", data.crt); s("indicadorIe", data.indicadorIe);
      s("tipoContribuinte", data.tipoContribuinte); s("contribuinteIcms", data.contribuinteIcms);
      s("cep", data.cep); s("logradouro", data.logradouro); s("numero", data.numero);
      s("complemento", data.complemento); s("bairro", data.bairro);
      s("municipio", data.cidade); s("uf", data.uf); s("codigoIbge", data.codigoIbge); s("codigoUfIbge", data.codigoUfIbge);
      s("email", data.email); s("telefone", data.telefone);
      u.fonteDados = "CNPJ_AUTO";
      setForm((p) => ({ ...p, ...u }));
      notify({ title: "Dados encontrados", tone: "success" });
    },
    onError: (err: Error) => notify({ title: "Erro na busca", description: err.message, tone: "error" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = mapFormToPayload(form);
      return transportadoraId ? updateTransportadora(transportadoraId, payload) : createTransportadora(payload);
    },
    onSuccess: () => {
      notify({ title: transportadoraId ? "Atualizada" : "Salva", tone: "success" });
      setTimeout(() => { router.push("/transportadoras"); router.refresh(); }, 600);
    },
    onError: (err: unknown) => {
      notify({ title: "Erro ao salvar", description: err instanceof ApiError ? err.message : "Erro desconhecido", tone: "error" });
    },
  });

  const cepMutation = useMutation({
    mutationFn: async () => {
      const c = String(form.cep ?? "").replace(/\D/g, "");
      if (c.length !== 8) throw new Error("CEP inválido");
      return lookupViaCep(c);
    },
    onSuccess: (data) => {
      if (!data) { notify({ title: "CEP não encontrado", tone: "error" }); return; }
      const u: Partial<Transportadora> = {};
      if (!form.logradouro) u.logradouro = data.logradouro;
      if (!form.bairro) u.bairro = data.bairro;
      if (!form.complemento) u.complemento = data.complemento;
      if (!form.municipio) u.municipio = data.cidade;
      if (!form.uf) u.uf = data.uf;
      if (!form.codigoIbge) u.codigoIbge = data.codigoIbge;
      if (Object.keys(u).length > 0) { setForm((p) => ({ ...p, ...u })); notify({ title: "Endereço completado", tone: "success" }); }
      else notify({ title: "Endereço já completo", tone: "info" });
    },
    onError: () => notify({ title: "Erro ao buscar CEP", tone: "error" }),
  });

  const maskedDocument = maskCnpj(normalizeCnpj(docValue));
  const hasLookup = Boolean(form.cnpj || form.cpf || transportadoraId);

  const F = (f: string, l: string, o?: { t?: string; p?: string; m?: number; d?: boolean }) => {
    const v = (form as Record<string, unknown>)[f] ?? "";
    return <div><label className="text-xs font-bold text-ink block mb-1">{l}</label><Input type={o?.t || "text"} value={String(v)} onChange={onChange(f)} placeholder={o?.p} maxLength={o?.m} disabled={isReadOnly || o?.d} /></div>;
  };

  const S = (f: string, l: string, os: { v: string; l: string }[], ph?: string) => {
    const val = String((form as Record<string, unknown>)[f] ?? "");
    return <div><label className="text-xs font-bold text-ink block mb-1">{l}</label><select value={val} onChange={onChange(f)} disabled={isReadOnly} className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink disabled:opacity-50"><option value="">{ph || "Selecione..."}</option>{os.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>;
  };

  if (loadingRecord) return <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-4"><Card className="p-12 text-center"><Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-subtle" /><p className="text-sm text-subtle">Carregando...</p></Card></div>;
  if (loadError) return <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-4"><Card className="p-12 text-center"><AlertTriangle className="h-8 w-8 mx-auto mb-3 text-red-500" /><p className="text-sm text-red-600">{loadError}</p><Button variant="outline" className="mt-4" onClick={onBack ?? (() => router.push("/transportadoras"))}>Voltar</Button></Card></div>;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-4">
      <button type="button" onClick={onBack ?? (() => router.push("/transportadoras"))} className="flex items-center gap-2 text-sm text-subtle hover:text-ink transition">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <Card className="p-6 bg-lime/10 border-lime/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-5 w-5 text-lime-dark" />
              <h1 className="text-xl font-extrabold text-ink">{transportadoraId ? (isReadOnly ? "Transportadora" : "Editar Transportadora") : "Nova Transportadora"}</h1>
            </div>
            <p className="text-sm text-subtle">Informe o CNPJ para buscar dados automaticamente</p>
          </div>
          {!isReadOnly ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-64">
                <Input value={maskedDocument} onChange={(e) => setDocValue(e.target.value)} placeholder="00.000.000/0000-00" className="h-12" />
              </div>
              <Button variant="lime" onClick={() => lookupMutation.mutate()} disabled={lookupMutation.isPending || !docValue} className="h-12 px-6">
                {lookupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar CNPJ
              </Button>
            </div>
          ) : <Badge variant="outline" className="h-12 px-4 text-sm">Modo visualização</Badge>}
        </div>
      </Card>

      {hasLookup ? (
        <div className="grid gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4"><Building2 className="h-4 w-4 text-ink" /><h2 className="text-sm font-extrabold text-ink">Dados da Transportadora</h2></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {form.tipoPessoa === "PF" ? (
                <>
                  {F("nome", "Nome", { m: 255 })}
                  {F("cpf", "CPF", { m: 14 })}
                </>
              ) : (
                <>
                  {F("razaoSocial", "Razão Social", { m: 255 })}
                  {F("nomeFantasia", "Nome Fantasia", { m: 255 })}
                </>
              )}
              {F("inscricaoEstadual", "Inscrição Estadual", { m: 40 })}
              {F("inscricaoMunicipal", "Inscrição Municipal", { m: 40 })}
              {S("regimeTributario", "Regime Tributário", [
                { v: "Simples Nacional", l: "Simples Nacional" }, { v: "Lucro Presumido", l: "Lucro Presumido" },
                { v: "Lucro Real", l: "Lucro Real" }, { v: "MEI", l: "MEI" },
              ])}
              {S("crt", "CRT", [
                { v: "1", l: "1 - Simples Nacional" }, { v: "2", l: "2 - Simples (excesso)" },
                { v: "3", l: "3 - Regime Normal" }, { v: "4", l: "4 - MEI" },
              ])}
              {S("contribuinteIcms", "Contribuinte ICMS", [{ v: "true", l: "Sim" }, { v: "false", l: "Não" }])}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4"><Truck className="h-4 w-4 text-ink" /><h2 className="text-sm font-extrabold text-ink">Dados de Transporte</h2></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {F("antt", "ANTT", { m: 20 })}
              {F("rntrc", "RNTRC", { m: 20 })}
              {S("tipoTransportadora", "Tipo", [
                { v: "RODOVIARIO", l: "Rodoviário" }, { v: "AEREO", l: "Aéreo" },
                { v: "FERROVIARIO", l: "Ferroviário" }, { v: "HIDROVIARIO", l: "Hidroviário" },
              ])}
              {F("placaVeiculo", "Placa", { m: 10 })}
              {F("ufPlaca", "UF Placa", { m: 2, p: "MG" })}
              {S("tipoVeiculo", "Tipo Veículo", [
                { v: "CAMINHAO", l: "Caminhão" }, { v: "CARRETA", l: "Carreta" },
                { v: "VAN", l: "Van" }, { v: "OUTRO", l: "Outro" },
              ])}
              {S("modalidadeFrete", "Modalidade Frete", [
                { v: "0", l: "0 - Remetente" }, { v: "1", l: "1 - Destinatário" },
                { v: "2", l: "2 - Terceiros" }, { v: "3", l: "3 - Próprio Remetente" },
                { v: "4", l: "4 - Próprio Destinatário" }, { v: "9", l: "9 - Sem transporte" },
              ])}
              {S("permiteColeta", "Coleta", [{ v: "true", l: "Sim" }, { v: "false", l: "Não" }])}
              {S("permiteEntrega", "Entrega", [{ v: "true", l: "Sim" }, { v: "false", l: "Não" }])}
              {S("cargaPerigosa", "Carga Perigosa", [{ v: "true", l: "Sim" }, { v: "false", l: "Não" }])}
              {S("temSeguro", "Seguro", [{ v: "true", l: "Sim" }, { v: "false", l: "Não" }])}
              {F("apoliceSeguro", "Apólice Seguro", { m: 40 })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-ink" /><h2 className="text-sm font-extrabold text-ink">Endereço</h2>
              {!isReadOnly && <Button variant="outline" size="sm" onClick={() => cepMutation.mutate()} disabled={cepMutation.isPending || !form.cep}>{cepMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} Buscar CEP</Button>}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {F("cep", "CEP", { m: 9, p: "00000-000" })}
              {F("logradouro", "Logradouro", { m: 255 })}
              {F("numero", "Número", { m: 20 })}
              {F("complemento", "Complemento", { m: 255 })}
              {F("bairro", "Bairro", { m: 100 })}
              {F("municipio", "Município", { m: 120 })}
              {F("uf", "UF", { m: 2, p: "MG" })}
              {F("codigoIbge", "Código IBGE", { m: 20, d: true })}
              {F("pais", "País", { m: 80 })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4"><Shield className="h-4 w-4 text-ink" /><h2 className="text-sm font-extrabold text-ink">Contato</h2></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {F("email", "Email", { t: "email", m: 255 })}
              {F("telefone", "Telefone", { p: "(31) 99999-9999" })}
              {F("whatsapp", "WhatsApp")}
              {F("observacoes", "Observações")}
              {S("ativo", "Ativo", [{ v: "true", l: "Sim" }, { v: "false", l: "Inativo" }])}
            </div>
          </Card>

          {!isReadOnly && (
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onBack ?? (() => router.push("/transportadoras"))}>Cancelar</Button>
              <Button variant="lime" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {transportadoraId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        !transportadoraId && (
          <Card className="p-12 text-center">
            <Truck className="h-12 w-12 mx-auto mb-3 text-subtle" />
            <h2 className="text-xl font-bold text-ink mb-2">Nova Transportadora</h2>
            <p className="text-sm text-subtle max-w-md mx-auto">Informe o CNPJ acima e clique em &ldquo;Buscar CNPJ&rdquo;.</p>
          </Card>
        )
      )}
    </div>
  );
}
