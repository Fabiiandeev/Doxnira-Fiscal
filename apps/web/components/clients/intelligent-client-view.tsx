"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Search,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  FileText,
  Save,
  Zap,
  ArrowLeft,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Building2,
  User,
  MapPin,
  BarChart3,
  History,
  Link2,
  Clock,
  Hash,
  ListChecks,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { notify } from "@/components/toast-viewport";
import {
  buscarCnpj,
  buscarCpf,
  createClient,
  updateClient,
  validarCliente,
  lookupViaCep,
} from "@/lib/services/cliente-service";
import { normalizeCnpj, normalizeCpf, maskCnpj, maskCpf, cn } from "@/lib/utils";
import type {
  IntelligentClient,
  ClientLookupResult,
  SmartError,
  FiscalAiResult,
  ScoreDetalhes,
  HistoricoEntry,
  CnaeItem,
} from "@/lib/client-types";

interface IntelligentClientViewProps {
  clientId?: string;
  onBack?: () => void;
}

const SITUACAO_BADGE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  ATIVA: "success",
  BAIXADA: "danger",
  SUSPENSA: "warning",
  INAPTA: "danger",
  NULA: "danger",
};

const CONFIANCA_BADGE: Record<string, "success" | "warning" | "danger"> = {
  ALTA: "success",
  MEDIA: "warning",
  BAIXA: "danger",
};

const ORIGEM_BADGE: Record<string, "lime" | "info" | "dark" | "neutral"> = {
  FISCAL_AI: "lime",
  USUARIO: "info",
  CONTADOR: "dark",
  INTEGRACAO: "neutral",
};

const TAB_ITEMS = [
  { value: "cadastro", label: "Cadastro", Icon: FileText },
  { value: "fiscal", label: "Fiscal", Icon: Shield },
  { value: "endereco", label: "Endereço & Contato", Icon: MapPin },
  { value: "fiscalai", label: "FiscalAI", Icon: Zap },
  { value: "historico", label: "Histórico", Icon: History },
] as const;

function scoreColor(v: number): string {
  if (v >= 70) return "text-emerald-600";
  if (v >= 40) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(v: number): string {
  if (v >= 70) return "bg-emerald-500";
  if (v >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function scoreRing(v: number): string {
  if (v >= 70) return "stroke-emerald-500";
  if (v >= 40) return "stroke-amber-500";
  return "stroke-red-500";
}

function addHistorico(
  existing: HistoricoEntry[] | null,
  entries: Omit<HistoricoEntry, "quando">[],
): HistoricoEntry[] {
  const now = new Date().toISOString();
  return [...(existing ?? []), ...entries.map((e) => ({ ...e, quando: now }))];
}

export function IntelligentClientView({ clientId, onBack }: IntelligentClientViewProps) {
  const [tab, setTab] = useState<"PJ" | "PF">("PJ");
  const [docValue, setDocValue] = useState("");
  const [form, setForm] = useState<Partial<IntelligentClient>>({ tipoPessoa: "PJ" });
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});
  const [manualEdited, setManualEdited] = useState<Set<string>>(new Set());
  const manualEditedRef = useRef(manualEdited);
  manualEditedRef.current = manualEdited;
  const [smartErrors, setSmartErrors] = useState<SmartError[]>([]);
  const [fiscalAi, setFiscalAi] = useState<FiscalAiResult | null>(null);
  const [score, setScore] = useState<{ overall: number; detalhes: ScoreDetalhes } | null>(null);
  const [activeTab, setActiveTab] = useState("cadastro");
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const runValidation = useCallback(async (data: Partial<IntelligentClient>) => {
    try {
      const result = await validarCliente(data as Record<string, unknown>);
      const allErrors: SmartError[] = [
        ...(result.alertas ?? []),
        ...(result.pendencias ?? []),
      ];
      setSmartErrors(allErrors);
      setFiscalAi({
        podeEmitirNfe: result.podeEmitirNfe,
        podeEmitirNfse: result.podeEmitirNfse,
        podeEmitirNfce: result.podeEmitirNfce,
        podeReceberCte: result.podeReceberCte,
        necessitaIe: result.necessitaIe,
        necessitaIm: result.necessitaIm,
        necessitaContador: result.necessitaContador,
        necessitaCertificado: result.necessitaCertificado,
        necessitaCadastroComplementar: result.necessitaCadastroComplementar,
      });
      setScore({ overall: result.scoreCadastro, detalhes: result.scoreDetalhes });
    } catch {
      notify({ title: "Validação indisponível", tone: "error" });
    }
  }, []);

  const scheduleValidation = useCallback((data: Partial<IntelligentClient>) => {
    const key = "validation";
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => runValidation(data), 800);
  }, [runValidation]);

  useEffect(() => {
    const cep = String(form.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    const timer = setTimeout(async () => {
      const viaCep = await lookupViaCep(cep);
      if (!viaCep) return;
      setForm((prev) => {
        const updates: Partial<IntelligentClient> = {};
        const setIfEmpty = (field: keyof IntelligentClient, value: unknown) => {
          if ((prev[field] == null || prev[field] === "") && value != null && value !== "" && !manualEditedRef.current.has(field)) {
            (updates as Record<string, unknown>)[field] = value;
          }
        };
        setIfEmpty("logradouro", viaCep.logradouro);
        setIfEmpty("bairro", viaCep.bairro);
        setIfEmpty("complemento", viaCep.complemento);
        setIfEmpty("municipio", viaCep.cidade);
        setIfEmpty("uf", viaCep.uf);
        setIfEmpty("codigoIbge", viaCep.codigoIbge);
        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [form.cep]);

  const onChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setForm((f) => {
      const updated = { ...f, [field]: value || null };
      scheduleValidation(updated);
      return updated;
    });
    setAutoFilled((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setManualEdited((prev) => new Set(prev).add(field));
  }, [scheduleValidation]);

  const markAutoFilled = useCallback((fields: string[]) => {
    setAutoFilled((prev) => {
      const next = { ...prev };
      for (const f of fields) next[f] = true;
      return next;
    });
  }, []);


  const lookupMutation = useMutation({
    mutationFn: async () => {
      if (tab === "PJ") {
        const raw = normalizeCnpj(docValue);
        if (raw.length !== 14) throw new Error("CNPJ inválido");
        return buscarCnpj(raw);
      }
      const raw = normalizeCpf(docValue);
      if (raw.length !== 11) throw new Error("CPF inválido");
      return buscarCpf(raw);
    },
    onSuccess: (data: ClientLookupResult) => {
      const filled: string[] = [];
      const updates: Partial<IntelligentClient> = { tipoPessoa: tab };
      const histEntries: Omit<HistoricoEntry, "quando">[] = [];

      const autoSet = (field: keyof IntelligentClient, value: unknown, label?: string) => {
        if (value == null || value === "") return;
        if (manualEditedRef.current.has(field)) return;
        const prev = form[field];
        if (prev != null && prev !== "" && prev !== value) return;
        (updates as Record<string, unknown>)[field] = value;
        filled.push(field);
        if (prev !== value) {
          histEntries.push({
            quem: "FiscalAI",
            campo: label || field,
            valorAnterior: prev != null ? String(prev) : null,
            valorNovo: String(value),
            origem: "FISCAL_AI",
          });
        }
      };

      if (tab === "PJ") {
        autoSet("cnpj", data.cnpj, "CNPJ");
        autoSet("razaoSocial", data.razaoSocial, "Razão Social");
        autoSet("nomeFantasia", data.nomeFantasia, "Nome Fantasia");
        autoSet("naturezaJuridica", data.naturezaJuridica, "Natureza Jurídica");
        autoSet("porte", data.porte, "Porte");
        autoSet("capitalSocial", data.capitalSocial, "Capital Social");
        autoSet("dataAbertura", data.dataAbertura, "Data de Abertura");
        autoSet("situacaoCadastral", data.situacaoCadastral, "Situação Cadastral");
        autoSet("situacaoMotivo", data.situacaoMotivo, "Motivo Situação");
        autoSet("optanteSimples", data.optanteSimples, "Optante Simples");
        autoSet("mei", data.mei, "MEI");
        autoSet("matriz", data.matriz, "Matriz");
        autoSet("filial", data.filial, "Filial");
        autoSet("regimeTributario", data.regimeTributario, "Regime Tributário");
        autoSet("crt", data.crt, "CRT");
        autoSet("indicadorIe", data.indicadorIe, "Indicador IE");
        autoSet("tipoContribuinte", data.tipoContribuinte, "Tipo de Contribuinte");
        autoSet("inscricaoEstadual", data.inscricaoEstadual, "Inscrição Estadual");
        autoSet("cnae", data.cnae, "CNAE Principal");
        autoSet("atividadeEconomica", data.atividadeEconomica, "Atividade Econômica");
        autoSet("contribuinteIcms", data.contribuinteIcms ?? (data.indicadorIe === "1" ? true : data.indicadorIe === "9" ? false : null), "Contribuinte ICMS");
        autoSet("cep", data.cep, "CEP");
        autoSet("logradouro", data.logradouro, "Logradouro");
        autoSet("numero", data.numero, "Número");
        autoSet("complemento", data.complemento, "Complemento");
        autoSet("bairro", data.bairro, "Bairro");
        autoSet("municipio", data.cidade, "Município");
        autoSet("uf", data.uf, "UF");
        autoSet("codigoIbge", data.codigoIbge, "Código IBGE");
        autoSet("codigoUfIbge", data.codigoUfIbge, "Código UF IBGE");
        autoSet("pais", data.pais ?? "BRASIL", "País");
        autoSet("telefone", data.telefone || data.telefone1, "Telefone");
        autoSet("email", data.email, "Email");
        autoSet("cnaeSecundarios", data.cnaeSecundarios, "CNAEs Secundários");
        autoSet("ieStatus", data.indicadorIe === "1" ? "ENCONTRADA" : "NAO_ENCONTRADA", "IE Status");
      }

      if (tab === "PF") {
        autoSet("cpf", data.cpf, "CPF");
        autoSet("nome", data.nome, "Nome");
      }

      setForm((prev) => {
        const merged = { ...prev, ...updates };
        if (histEntries.length > 0) {
          merged.historicoJson = addHistorico(prev.historicoJson ?? null, histEntries);
        }
        return merged;
      });
      markAutoFilled(filled);
      const mergedData = { ...form, ...updates };
      scheduleValidation(mergedData);
      notify({ title: "Dados encontrados", description: `${filled.length} campos preenchidos automaticamente`, tone: "success" });
    },
    onError: (err: Error) => {
      notify({ title: "Erro na busca", description: err.message, tone: "error" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form } as Record<string, unknown>;
      if (clientId) return updateClient(clientId, payload);
      return createClient(payload);
    },
    onSuccess: () => {
      notify({ title: clientId ? "Cliente atualizado" : "Cliente criado", tone: "success" });
    },
    onError: () => {
      notify({ title: "Erro ao salvar", tone: "error" });
    },
  });

  const toggleErrorExpand = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCorrigir = (err: SmartError) => {
    if (err.campo === "crt" && form.mei === true) {
      setForm((f) => ({ ...f, crt: "4" }));
      setSmartErrors((prev) => prev.map((e) => (e.id === err.id ? { ...e, corrigido: true } : e)));
      const entry: Omit<HistoricoEntry, "quando"> = {
        quem: "FiscalAI",
        campo: "CRT",
        valorAnterior: form.crt ?? null,
        valorNovo: "4",
        origem: "FISCAL_AI",
      };
      setForm((f) => ({ ...f, historicoJson: addHistorico(f.historicoJson ?? null, [entry]) }));
      notify({ title: "Correção aplicada", description: "CRT alterado para 4 (MEI/Simei)", tone: "success" });
    } else {
      setSmartErrors((prev) => prev.map((e) => (e.id === err.id ? { ...e, corrigido: true } : e)));
      notify({ title: "Correção marcada", tone: "success" });
    }
  };

  const handleIgnorar = (err: SmartError) => {
    setSmartErrors((prev) => prev.filter((e) => e.id !== err.id));
  };

  const maskedDocument = tab === "PJ" ? maskCnpj(normalizeCnpj(docValue)) : maskCpf(normalizeCpf(docValue));
  const hasLookup = !!(form.cnpj || form.cpf);
  const erros = smartErrors.filter((e) => e.tipo === "ERRO");
  const alertas = smartErrors.filter((e) => e.tipo === "ALERTA");
  const dicas = smartErrors.filter((e) => e.tipo === "DICA");

  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (hasLookup) runValidation(formRef.current);
  }, [hasLookup, runValidation]);

  const renderSmartError = (err: SmartError) => {
    const Icon = err.tipo === "ERRO" ? XCircle : err.tipo === "ALERTA" ? AlertTriangle : Info;
    const iconColor = err.tipo === "ERRO" ? "text-red-500" : err.tipo === "ALERTA" ? "text-amber-500" : "text-indigo-500";
    const expanded = expandedErrors.has(err.id);

    return (
      <div key={err.id} className={cn("rounded-xl border bg-white", err.corrigido ? "border-emerald-200" : "border-line")}>
        <button
          type="button"
          className="flex w-full items-start gap-3 p-3 text-left"
          onClick={() => toggleErrorExpand(err.id)}
        >
          {err.corrigido ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-bold", err.corrigido && "line-through text-subtle")}>
              {err.titulo}
            </p>
            <p className="text-xs text-subtle">{err.campo}</p>
          </div>
          <Badge variant={CONFIANCA_BADGE[err.confianca] ?? "neutral"}>{err.confianca}</Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-subtle" /> : <ChevronDown className="h-4 w-4 text-subtle" />}
        </button>
        {expanded && (
          <div className="border-t border-line px-3 pb-3 pt-2 space-y-2">
            <p className="text-xs text-subtle"><span className="font-bold text-ink">Explicação:</span> {err.explicacao}</p>
            <p className="text-xs text-subtle"><span className="font-bold text-ink">Impacto:</span> {err.impacto}</p>
            <p className="text-xs text-subtle"><span className="font-bold text-ink">Regra:</span> {err.regraUtilizada}</p>
            {err.correcaoSugerida && (
              <p className="text-xs text-subtle"><span className="font-bold text-ink">Sugestão:</span> {err.correcaoSugerida}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="lime" size="sm" onClick={() => handleCorrigir(err)} disabled={err.corrigido}>
                Corrigir
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleIgnorar(err)}>
                Ignorar
              </Button>
              <Button variant="outline" size="sm">
                <Send className="h-3 w-3" /> Contador
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderScore = () => {
    if (!score) return null;
    const { overall, detalhes } = score;
    const circumference = 2 * Math.PI * 40;
    const dashOffset = circumference - (overall / 100) * circumference;
    const bars: { label: string; value: number; key: keyof ScoreDetalhes }[] = [
      { label: "Cadastrais", value: detalhes.cadastrais, key: "cadastrais" },
      { label: "Fiscais", value: detalhes.fiscais, key: "fiscais" },
      { label: "Endereço", value: detalhes.endereco, key: "endereco" },
      { label: "Contato", value: detalhes.contato, key: "contato" },
      { label: "SPED", value: detalhes.sped, key: "sped" },
      { label: "NFS-e", value: detalhes.nfse, key: "nfse" },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="relative">
            <svg width="96" height="96" className="-rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" className="text-muted" strokeWidth="6" />
              <circle
                cx="48" cy="48" r="40" fill="none"
                className={scoreRing(overall)}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-2xl font-extrabold", scoreColor(overall))}>{overall}%</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {bars.map((b) => (
            <div key={b.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-subtle">{b.label}</span>
                <span className={cn("font-bold", scoreColor(b.value))}>{b.value}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className={cn("h-1.5 rounded-full transition-all duration-500", scoreBg(b.value))} style={{ width: `${b.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFiscalAiCard = (label: string, value: boolean | undefined, explanation?: string) => (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center gap-2">
        {value ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400" />
        )}
        <span className="text-sm font-bold text-ink">{label}</span>
      </div>
      {explanation && <p className="mt-1 text-xs text-subtle">{explanation}</p>}
    </div>
  );

  const greenRing = (field: string) =>
    autoFilled[field] ? "ring-2 ring-emerald-300 ring-offset-1" : "";

  return (
    <div className="space-y-4">
      {onBack && (
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-subtle hover:text-ink transition">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      )}

      <Card className="p-6 bg-lime/10 border-lime/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-5 w-5 text-lime-dark" />
              <h1 className="text-xl font-extrabold text-ink">Cadastro Inteligente de Cliente</h1>
            </div>
            <p className="text-sm text-subtle">
              Informe o CPF ou CNPJ e a FiscalAI buscará, validará e completará todos os dados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as "PJ" | "PF"); setDocValue(""); setForm({ tipoPessoa: v as "PJ" | "PF" }); setAutoFilled({}); setManualEdited(new Set()); }}>
              <TabsList>
                <TabsTrigger value="PJ"><Building2 className="mr-1.5 h-3.5 w-3.5" /> PJ</TabsTrigger>
                <TabsTrigger value="PF"><User className="mr-1.5 h-3.5 w-3.5" /> PF</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="w-60">
              <Input
                label={tab === "PJ" ? "CNPJ" : "CPF"}
                value={maskedDocument}
                onChange={(e) => setDocValue(e.target.value)}
                placeholder={tab === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              />
            </div>
            <Button
              variant="lime"
              onClick={() => lookupMutation.mutate()}
              disabled={lookupMutation.isPending || !docValue}
              className="h-11"
            >
              {lookupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar Dados
            </Button>
          </div>
        </div>
      </Card>

      {hasLookup && (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mx-auto flex w-full max-w-3xl justify-center gap-1 rounded-2xl bg-muted p-1.5 shadow-soft">
                {TAB_ITEMS.map(({ value, label, Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-subtle transition-all duration-200 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=active]:scale-[1.02]"
                  >
                    <Icon className="mr-1.5 h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{label.split(" ")[0]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="cadastro">
                <Card className="p-5 space-y-5">
                  <h2 className="text-base font-extrabold text-ink">Dados Cadastrais</h2>
                  {tab === "PJ" ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <Input label="CNPJ" value={form.cnpj ? maskCnpj(form.cnpj) : ""} readOnly className={greenRing("cnpj")} />
                      <Input label="Razão Social" value={form.razaoSocial ?? ""} onChange={onChange("razaoSocial")} className={greenRing("razaoSocial")} />
                      <Input label="Nome Fantasia" value={form.nomeFantasia ?? ""} onChange={onChange("nomeFantasia")} className={greenRing("nomeFantasia")} />
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Situação Cadastral</label>
                        <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5">
                          {form.situacaoCadastral ? (
                            <>
                              <Badge variant={SITUACAO_BADGE[form.situacaoCadastral] ?? "neutral"}>
                                {form.situacaoCadastral}
                              </Badge>
                              {form.situacaoMotivo && (
                                <span className="text-xs text-subtle truncate">{form.situacaoMotivo}</span>
                              )}
                              {form.situacaoData && (
                                <span className="text-xs text-subtle">
                                  <Clock className="inline h-3 w-3 mr-0.5" />
                                  {new Date(form.situacaoData).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-subtle">—</span>
                          )}
                        </div>
                      </div>
                      <Input label="Natureza Jurídica" value={form.naturezaJuridica ?? ""} onChange={onChange("naturezaJuridica")} className={greenRing("naturezaJuridica")} />
                      <Input label="Porte" value={form.porte ?? ""} onChange={onChange("porte")} className={greenRing("porte")} />
                      <Input label="Capital Social" value={form.capitalSocial ?? ""} onChange={onChange("capitalSocial")} className={greenRing("capitalSocial")} />
                      <Input label="Data de Abertura" value={form.dataAbertura ? new Date(form.dataAbertura).toLocaleDateString("pt-BR") : ""} readOnly className={greenRing("dataAbertura")} />
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Optante Simples</label>
                        <select
                          value={form.optanteSimples === null ? "" : form.optanteSimples ? "true" : "false"}
                          onChange={onChange("optanteSimples")}
                          className="flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5"
                        >
                          <option value="">Selecione</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">MEI</label>
                        <select
                          value={form.mei === null ? "" : form.mei ? "true" : "false"}
                          onChange={onChange("mei")}
                          className="flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5"
                        >
                          <option value="">Selecione</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Tipo Estabelecimento</label>
                        <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5">
                          {form.matriz ? (
                            <Badge variant="info">Matriz</Badge>
                          ) : form.filial ? (
                            <Badge variant="neutral">Filial</Badge>
                          ) : (
                            <span className="text-sm text-subtle">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input label="CPF" value={form.cpf ? maskCpf(form.cpf) : ""} readOnly className={greenRing("cpf")} />
                      <Input label="Nome Completo" value={form.nome ?? ""} onChange={onChange("nome")} className={greenRing("nome")} />
                      <Input label="RG" value={form.rg ?? ""} onChange={onChange("rg")} />
                      <Input label="Data de Nascimento" value={form.dataNascimento ?? ""} onChange={onChange("dataNascimento")} />
                    </div>
                  )}

                  {tab === "PJ" && form.cnaeSecundarios && form.cnaeSecundarios.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4 text-subtle" /> CNAEs Secundários
                      </h3>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {form.cnaeSecundarios.map((c: CnaeItem, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
                            <Hash className="h-3.5 w-3.5 text-subtle shrink-0" />
                            <span className="text-sm font-mono text-ink">{c.codigo}</span>
                            <span className="text-sm text-subtle truncate">— {c.descricao}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="fiscal">
                <Card className="p-5 space-y-5">
                  <h2 className="text-base font-extrabold text-ink">Dados Fiscais</h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Regime Tributário</label>
                      <select
                        value={form.regimeTributario ?? ""}
                        onChange={onChange("regimeTributario")}
                        className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("regimeTributario"))}
                      >
                        <option value="">Selecione</option>
                        <option value="Simples Nacional">Simples Nacional</option>
                        <option value="Simples Nacional - Excesso de sublimite">Simples Nacional - Excesso sublimite</option>
                        <option value="Lucro Presumido">Lucro Presumido</option>
                        <option value="Lucro Real">Lucro Real</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">CRT</label>
                      <select value={form.crt ?? ""} onChange={onChange("crt")} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("crt"))}>
                        <option value="">Selecione</option>
                        <option value="1">1 — Simples Nacional</option>
                        <option value="2">2 — Simples com ST</option>
                        <option value="3">3 — Regime Normal</option>
                        <option value="4">4 — MEI / Simei</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Indicador IE</label>
                      <select value={form.indicadorIe ?? ""} onChange={onChange("indicadorIe")} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("indicadorIe"))}>
                        <option value="">Selecione</option>
                        <option value="1">1 — Contribuinte ICMS</option>
                        <option value="2">2 — Isento</option>
                        <option value="9">9 — Não contribuinte</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Inscrição Estadual</label>
                      <div className="flex items-center gap-2">
                        <Input value={form.inscricaoEstadual ?? ""} onChange={onChange("inscricaoEstadual")} className={greenRing("inscricaoEstadual")} />
                        {form.ieStatus && <Badge variant={form.ieStatus === "ENCONTRADA" ? "success" : "danger"}>{form.ieStatus}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Inscrição Municipal</label>
                      <div className="flex items-center gap-2">
                        <Input value={form.inscricaoMunicipal ?? ""} onChange={onChange("inscricaoMunicipal")} className={greenRing("inscricaoMunicipal")} />
                        {form.imStatus && <Badge variant={form.imStatus === "ATIVA" ? "success" : "danger"}>{form.imStatus}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Tipo de Contribuinte</label>
                      <select value={form.tipoContribuinte ?? ""} onChange={onChange("tipoContribuinte")} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("tipoContribuinte"))}>
                        <option value="">Selecione</option>
                        <option value="Contribuinte ICMS">Contribuinte ICMS</option>
                        <option value="Contribuinte ISS">Contribuinte ISS</option>
                        <option value="Ambos">Ambos</option>
                        <option value="Não contribuinte">Não contribuinte</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Contribuinte ICMS</label>
                      <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5">
                        {form.contribuinteIcms ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : form.contribuinteIcms === false ? (
                          <XCircle className="h-5 w-5 text-subtle" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        )}
                        <span className="text-sm text-ink">
                          {form.contribuinteIcms === true ? "Sim" : form.contribuinteIcms === false ? "Não" : "Pendente"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Contribuinte ISS</label>
                      <div className="flex items-center gap-2">
                        {form.contribuinteIss ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : form.contribuinteIss === false ? (
                          <XCircle className="h-5 w-5 text-subtle" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        )}
                        <span className="text-sm text-ink">
                          {form.contribuinteIss === true ? "Sim" : form.contribuinteIss === false ? "Não" : "Pendente"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Substituição Tributária</label>
                      <select
                        value={form.substituicaoTributaria === null ? "" : form.substituicaoTributaria ? "true" : "false"}
                        onChange={onChange("substituicaoTributaria")}
                        className="flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5"
                      >
                        <option value="">Selecione</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-2">
                    <Input label="CNAE Principal" value={form.cnae ?? ""} onChange={onChange("cnae")} className={greenRing("cnae")} />
                    <Input label="Atividade Econômica" value={form.atividadeEconomica ?? ""} onChange={onChange("atividadeEconomica")} className={greenRing("atividadeEconomica")} />
                  </div>
                  <div className="pt-2">
                    <p className="mb-2 text-sm font-bold text-ink">Retenções</p>
                    <div className="flex flex-wrap gap-3">
                      {(["irrf", "csll", "pis", "cofins", "iss"] as const).map((key) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!form.retencoes?.[key]}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                retencoes: {
                                  ...f.retencoes,
                                  irrf: f.retencoes?.irrf ?? false,
                                  csll: f.retencoes?.csll ?? false,
                                  pis: f.retencoes?.pis ?? false,
                                  cofins: f.retencoes?.cofins ?? false,
                                  iss: f.retencoes?.iss ?? false,
                                  [key]: e.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-line accent-lime-dark"
                          />
                          {key.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="endereco">
                <Card className="p-5 space-y-5">
                  <h2 className="text-base font-extrabold text-ink">Endereço</h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Input label="CEP" value={form.cep ?? ""} onChange={onChange("cep")} className={greenRing("cep")} />
                    <Input label="Logradouro" value={form.logradouro ?? ""} onChange={onChange("logradouro")} className={cn("md:col-span-2", greenRing("logradouro"))} />
                    <Input label="Número" value={form.numero ?? ""} onChange={onChange("numero")} className={greenRing("numero")} />
                    <Input label="Complemento" value={form.complemento ?? ""} onChange={onChange("complemento")} className={greenRing("complemento")} />
                    <Input label="Bairro" value={form.bairro ?? ""} onChange={onChange("bairro")} className={greenRing("bairro")} />
                    <Input label="Cidade / Município" value={form.municipio ?? ""} onChange={onChange("municipio")} className={greenRing("municipio")} />
                    <Input label="UF" value={form.uf ?? ""} onChange={onChange("uf")} className={greenRing("uf")} />
                    <Input label="Código Município IBGE" value={form.codigoIbge ?? ""} onChange={onChange("codigoIbge")} className={greenRing("codigoIbge")} />
                    <Input label="Código UF IBGE" value={form.codigoUfIbge ?? ""} onChange={onChange("codigoUfIbge")} className={greenRing("codigoUfIbge")} />
                    <Input label="País" value={form.pais ?? ""} onChange={onChange("pais")} className={greenRing("pais")} />
                  </div>
                  <hr className="border-line" />
                  <h2 className="text-base font-extrabold text-ink">Contato</h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Input label="Telefone" value={form.telefone ?? ""} onChange={onChange("telefone")} className={greenRing("telefone")} />
                    <Input label="WhatsApp" value={form.whatsapp ?? ""} onChange={onChange("whatsapp")} />
                    <Input label="Email" value={form.email ?? ""} onChange={onChange("email")} className={greenRing("email")} />
                    <Input label="Site" value={form.site ?? ""} onChange={onChange("site")} />
                    <Input label="Contato Financeiro" value={form.contatoFinanceiro ?? ""} onChange={onChange("contatoFinanceiro")} />
                    <Input label="Contato Fiscal" value={form.contatoFiscal ?? ""} onChange={onChange("contatoFiscal")} />
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="fiscalai">
                <div className="space-y-4">
                  {fiscalAi ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {renderFiscalAiCard("Pode emitir NF-e?", fiscalAi.podeEmitirNfe)}
                      {renderFiscalAiCard("Pode emitir NFS-e?", fiscalAi.podeEmitirNfse)}
                      {renderFiscalAiCard("Pode emitir NFC-e?", fiscalAi.podeEmitirNfce)}
                      {renderFiscalAiCard("Pode receber CT-e?", fiscalAi.podeReceberCte)}
                      {renderFiscalAiCard("Necessita IE?", fiscalAi.necessitaIe)}
                      {renderFiscalAiCard("Necessita IM?", fiscalAi.necessitaIm)}
                      {renderFiscalAiCard("Necessita Contador?", fiscalAi.necessitaContador)}
                      {renderFiscalAiCard("Necessita Certificado?", fiscalAi.necessitaCertificado)}
                      {renderFiscalAiCard("Necessita Cadastro Complementar?", fiscalAi.necessitaCadastroComplementar)}
                    </div>
                  ) : (
                    <Card className="p-6 text-center">
                      <Zap className="mx-auto mb-2 h-8 w-8 text-subtle" />
                      <p className="text-sm text-subtle">Realize a busca para ativar a análise FiscalAI</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="historico">
                <Card className="overflow-hidden">
                  {form.historicoJson && form.historicoJson.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="bg-muted/50 text-xs font-bold uppercase text-subtle">
                            <th className="px-4 py-3 text-left">Quem</th>
                            <th className="px-4 py-3 text-left">Quando</th>
                            <th className="px-4 py-3 text-left">Campo</th>
                            <th className="px-4 py-3 text-left">Anterior</th>
                            <th className="px-4 py-3 text-left">Novo</th>
                            <th className="px-4 py-3 text-left">Origem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {form.historicoJson.map((entry: HistoricoEntry, i: number) => (
                            <tr key={i} className="hover:bg-muted/30">
                              <td className="px-4 py-3 text-sm text-ink">{entry.quem}</td>
                              <td className="px-4 py-3 text-sm text-subtle">
                                {entry.quando ? new Date(entry.quando).toLocaleString("pt-BR") : "—"}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-ink">{entry.campo}</td>
                              <td className="px-4 py-3 text-sm text-subtle">{entry.valorAnterior ?? "—"}</td>
                              <td className="px-4 py-3 text-sm text-ink">{entry.valorNovo ?? "—"}</td>
                              <td className="px-4 py-3">
                                <Badge variant={ORIGEM_BADGE[entry.origem] ?? "neutral"}>{entry.origem}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <History className="mx-auto mb-2 h-8 w-8 text-subtle" />
                      <p className="text-sm text-subtle">Nenhum histórico registrado</p>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="w-full space-y-3 lg:w-72 shrink-0">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-ink" />
                <p className="text-sm font-extrabold text-ink">Score do Cadastro</p>
              </div>
              {score ? renderScore() : (
                <div className="py-4 text-center">
                  <p className="text-xs text-subtle">Realize a busca para calcular o score</p>
                </div>
              )}
            </Card>

            {erros.length > 0 && (
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm font-extrabold text-ink">Pendências</p>
                  <Badge variant="danger">{erros.length}</Badge>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {erros.map(renderSmartError)}
                </div>
              </Card>
            )}

            {alertas.length > 0 && (
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-extrabold text-ink">Alertas</p>
                  <Badge variant="warning">{alertas.length}</Badge>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {alertas.map(renderSmartError)}
                </div>
              </Card>
            )}

            {dicas.length > 0 && (
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-indigo-500" />
                  <p className="text-sm font-extrabold text-ink">Dicas</p>
                  <Badge variant="info">{dicas.length}</Badge>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dicas.map(renderSmartError)}
                </div>
              </Card>
            )}

            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-ink" />
                <p className="text-sm font-extrabold text-ink">Ações Rápidas</p>
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => runValidation(form)}>
                  <Shield className="h-3.5 w-3.5" /> Validar Cadastro
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Zap className="h-3.5 w-3.5" /> Diagnóstico Fiscal
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Send className="h-3.5 w-3.5" /> Enviar ao Contador
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      )}

      {hasLookup && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="lime" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            <Button variant="outline" disabled={saveMutation.isPending}>
              <FileText className="h-4 w-4" /> Salvar e Emitir NF-e
            </Button>
            <Button variant="outline" disabled={saveMutation.isPending}>
              <Link2 className="h-4 w-4" /> Salvar e Emitir NFS-e
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab("historico")}>
              <History className="h-4 w-4" /> Ver Histórico
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
