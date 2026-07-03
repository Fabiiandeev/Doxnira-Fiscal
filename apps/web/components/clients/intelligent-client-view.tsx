"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  MapPinned,
  RefreshCw,
  ScanSearch,
  Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { notify } from "@/components/toast-viewport";
import { buscarCnpj,
  buscarCpf,
  createClient,
  updateClient,
  validarCliente,
  lookupViaCep,
  validarSintegra,
  getClient, } from "@/lib/services/cliente-service";
import { normalizeCnpj, normalizeCpf, maskCnpj, maskCpf, cn, formatPhone } from "@/lib/utils";
import type {
  IntelligentClient,
  ClientLookupResult,
  SmartError,
  FiscalAiResult,
  ScoreDetalhes,
  HistoricoEntry,
  CnaeItem,
} from "@/lib/client-types";
import { ApiError } from "@/lib/api";

interface IntelligentClientViewProps {
  clientId?: string;
  viewMode?: "create" | "view" | "edit";
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

function normalizePorte(raw: string | null | undefined): string {
  if (!raw) return "";
  const v = String(raw).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (!v) return "";
  if (v.includes("MEI")) return "MEI";
  if (v.includes("MICRO") || v === "ME") return "ME";
  if (v.includes("PEQUENO") || v === "EPP") return "EPP";
  if (v.includes("DEMAIS")) return "DEMAIS";
  return raw;
}

interface ClientIssues {
  pendencias: SmartError[];
  alertas: SmartError[];
  dicas: SmartError[];
}

function makeIssue(campo: string, titulo: string, explicacao: string, impacto: string, regra: string, correcao: string, confianca: "ALTA" | "MEDIA" | "BAIXA" | "INFORMATIVO", tipo: "ERRO" | "ALERTA" | "DICA"): SmartError {
  return {
    id: `${tipo}_${campo}_${regra}`,
    campo,
    titulo,
    explicacao,
    impacto,
    regraUtilizada: regra,
    correcaoSugerida: correcao,
    confianca,
    tipo,
    acoes: [{ label: "Editar cadastro", acao: "EDITAR" }],
    corrigido: false,
  };
}

function buildClientIssues(client: Partial<IntelligentClient>): ClientIssues {
  const pendencias: SmartError[] = [];
  const alertas: SmartError[] = [];
  const dicas: SmartError[] = [];

  const isPJ = client.tipoPessoa === "PJ";
  const isPF = client.tipoPessoa === "PF";
  const cidade = client.municipio || null;
  const fromApi = Boolean(client.fonteDados && client.fonteDados !== "MANUAL");

  if (isPJ) {
    if (!client.cnpj) {
      pendencias.push(makeIssue("cnpj", "CNPJ não informado", "O CNPJ é obrigatório para PJ", "Rejeição garantida na emissão", "REQUISITO_CNPJ", "Informe o CNPJ", "ALTA", "ERRO"));
    } else {
      const digits = normalizeCnpj(client.cnpj);
      if (digits.length !== 14) {
        pendencias.push(makeIssue("cnpj", "CNPJ com formato inválido", `CNPJ tem ${digits.length} dígitos, esperado 14`, "Rejeição garantida na emissão", "VALIDACAO_FORMATO_CNPJ", "Corrija o CNPJ", "ALTA", "ERRO"));
      }
    }

    if (!client.razaoSocial) {
      pendencias.push(makeIssue("razaoSocial", "Razão Social não informada", "Campo obrigatório para PJ", "Dados cadastrais incompletos", "REQUISITO_RAZAO_SOCIAL", "Preencha a Razão Social", "ALTA", "ERRO"));
    }

    const situacao = String(client.situacaoCadastral || "").toUpperCase();
    if (situacao && ["BAIXADA", "SUSPENSA", "NULA"].includes(situacao)) {
      pendencias.push(makeIssue("situacaoCadastral", `Situação cadastral: ${situacao}`, `Empresa com cadastro ${situacao.toLowerCase()}`, "Impossível emitir documentos fiscais", "RECEITA_FEDERAL_SITUACAO", "Regularize a situação cadastral", "ALTA", "ERRO"));
    }
    if (situacao === "INAPTA") {
      alertas.push(makeIssue("situacaoCadastral", "Empresa inapta", "Receita Federal classificou como inapta", "Pode ter restrições para emissão", "RECEITA_FEDERAL_INAPTA", "Verifique o motivo da inaptidão", "ALTA", "ALERTA"));
    }

    if (!client.uf) {
      pendencias.push(makeIssue("uf", "UF não informada", "UF é obrigatória para emissão", "Rejeição garantida na emissão", "REQUISITO_UF", "Preencha a UF", "ALTA", "ERRO"));
    }
    if (!cidade) {
      pendencias.push(makeIssue("municipio", "Cidade não informada", "Município é obrigatório para emissão", "Rejeição garantida na emissão", "REQUISITO_CIDADE", "Preencha a cidade", "ALTA", "ERRO"));
    }
    if (!client.logradouro) {
      pendencias.push(makeIssue("logradouro", "Logradouro não informado", "Logradouro é obrigatório para emissão", "Rejeição garantida na emissão", "REQUISITO_LOGRADOURO", "Preencha o logradouro", "ALTA", "ERRO"));
    }

    if (!client.regimeTributario || client.regimeTributario === "PENDENTE_CONFIRMACAO") {
      dicas.push(makeIssue("regimeTributario", "Regime tributário exige confirmação", "Não foi possível confirmar o regime tributário pela fonte pública", "Cálculos fiscais podem ficar incorretos", "REQUISITO_REGIME", "Confirme o regime tributário manualmente", "INFORMATIVO", "DICA"));
    }
    if (!client.cnae) {
      alertas.push(makeIssue("cnae", "CNAE não informado", "Necessário para classificação fiscal", "Classificação fiscal incompleta", "REQUISITO_CNAE", "Informe o CNAE principal", "MEDIA", "ALERTA"));
    }
    if (!client.crt) {
      dicas.push(makeIssue("crt", "CRT não informado — confirme manualmente", "O Código de Regime Tributário será obrigatório para emissão de NF-e", "Rejeição possível na emissão", "REQUISITO_CRT", "Informe o CRT (1=Simples, 2=Simples excesso, 3=Regime Normal, 4=MEI)", "INFORMATIVO", "DICA"));
    }
    if (!client.naturezaJuridica) {
      dicas.push(makeIssue("naturezaJuridica", "Natureza jurídica não informada", "Importante para classificação fiscal", "Classificação tributária pode ficar incorreta", "REQUISITO_NATUREZA", "Informe a natureza jurídica", "BAIXA", "DICA"));
    }
    if (!client.porte) {
      if (fromApi) {
        dicas.push(makeIssue("porte", "Porte não retornado pela fonte pública", "A fonte consultada não informou o porte da empresa", "Sem impacto fiscal direto", "PORTE_FONTE_AUSENTE", "Informe o porte manualmente se disponível", "INFORMATIVO", "DICA"));
      } else {
        dicas.push(makeIssue("porte", "Porte não informado", "Relevante para enquadramento tributário", "Benefícios fiscais podem não ser aplicados", "REQUISITO_PORTE", "Informe o porte", "BAIXA", "DICA"));
      }
    }
    if (!client.bairro) {
      dicas.push(makeIssue("bairro", "Bairro não informado", "Parte do endereço completo", fromApi ? "Dado ausente na fonte pública" : "Pode gerar rejeição na SEFAZ", "ENDERECO_BAIRRO", "Informe o bairro", "BAIXA", "DICA"));
    }
    if (!client.codigoIbge && cidade) {
      alertas.push(makeIssue("codigoIbge", "Código IBGE ausente", "Obrigatório para emissão de NF-e/NFS-e", "Rejeição garantida na emissão", "REQUISITO_IBGE", "Refazer busca com CEP", "ALTA", "ALERTA"));
    }
    if (!client.pais) {
      dicas.push(makeIssue("pais", "País não informado", "Necessário para endereçamento fiscal", "Endereço incompleto", "REQUISITO_PAIS", "Para empresas brasileiras: BRASIL", "BAIXA", "DICA"));
    }

    if (client.mei === true && client.crt !== "4") {
      dicas.push(makeIssue("crt", "CRT ajustado automaticamente para MEI", "MEI exige CRT = 4", "CRT será corrigido antes do envio", "CRT_MEI_AUTO", "CRT definido como 4", "INFORMATIVO", "DICA"));
    }
    if (client.inscricaoEstadual && client.indicadorIe !== "1") {
      dicas.push(makeIssue("indicadorIe", "Indicador IE ajustado automaticamente", "IE preenchida exige indicador = 1 (Contribuinte ICMS)", "Indicador foi corrigido automaticamente", "IE_AUTO_DERIVE", "Indicador IE definido como 1", "INFORMATIVO", "DICA"));
    }
    if (!client.inscricaoEstadual && client.indicadorIe === "1") {
      alertas.push(makeIssue("indicadorIe", "Indicador IE sem IE", "Indicador diz Contribuinte mas sem IE", "Rejeição possível na emissão", "IE_SEM_IE", "Informe a IE ou mude indicador para 9", "MEDIA", "ALERTA"));
    }
  }

  if (isPF) {
    if (!client.cpf) {
      pendencias.push(makeIssue("cpf", "CPF não informado", "Obrigatório para PF", "Impossível emitir documento fiscal", "REQUISITO_CPF", "Informe o CPF", "ALTA", "ERRO"));
    }
    if (!client.nome) {
      pendencias.push(makeIssue("nome", "Nome não informado", "Obrigatório para PF", "Dados pessoais incompletos", "REQUISITO_NOME", "Preencha o nome completo", "ALTA", "ERRO"));
    }
  }

  const telDigits = client.telefone ? String(client.telefone).replace(/\D/g, "") : "";
  if (telDigits.length > 0 && (telDigits.length < 8 || telDigits.length > 11)) {
    alertas.push(makeIssue("telefone", "Telefone com formato inválido", "O telefone deve ter entre 8 e 11 dígitos", "Contato pode falhar", "VALIDACAO_TELEFONE", "Informe telefone com DDD (ex: 61999999999)", "BAIXA", "ALERTA"));
  } else if (telDigits.length === 8) {
    dicas.push(makeIssue("telefone", "Telefone sem DDD", `Fixo local ${formatPhone(telDigits)} sem DDD — informe o DDD para completar`, "Telefone sem DDD pode não ser alcançável", "VALIDACAO_TELEFONE_SEM_DDD", `Adicione o DDD antes do número ${formatPhone(telDigits)}`, "INFORMATIVO", "DICA"));
  } else if (telDigits.length === 9) {
    dicas.push(makeIssue("telefone", "Telefone sem DDD", `Celular local ${formatPhone(telDigits)} sem DDD — informe o DDD para completar`, "Telefone sem DDD pode não ser alcançável", "VALIDACAO_TELEFONE_SEM_DDD", `Adicione o DDD antes do número ${formatPhone(telDigits)}`, "INFORMATIVO", "DICA"));
  } else if (telDigits.length === 0 && !client.email) {
    dicas.push(makeIssue("contato", "Nenhum telefone ou email informado", "Ao menos um contato é recomendado", "Comunicação impossibilitada", "CONTATO_AUSENTE", "Informe telefone ou email", "BAIXA", "DICA"));
  } else if (telDigits.length === 0) {
    dicas.push(makeIssue("telefone", "Telefone não informado", "Recomenda-se cadastrar telefone", "Contato com cliente pode falhar", "REQUISITO_TELEFONE", "Informe um telefone com DDD", "BAIXA", "DICA"));
  }

  if (client.cep) {
    const cepDigits = String(client.cep).replace(/\D/g, "");
    if (cepDigits.length > 0 && cepDigits.length !== 8) {
      alertas.push(makeIssue("cep", "CEP com formato inválido", "CEP deve conter 8 dígitos", "Endereço pode ser rejeitado", "VALIDACAO_CEP", "Informe CEP com 8 dígitos", "MEDIA", "ALERTA"));
    }
  }

  if (client.email) {
    const email = String(client.email);
    if (!email.includes("@") || !email.includes(".")) {
      alertas.push(makeIssue("email", "Email com formato inválido", "Email informado não parece válido", "Comunicação pode falhar", "VALIDACAO_EMAIL", "Informe email válido", "BAIXA", "ALERTA"));
    }
  }

  if (isPJ && client.capitalSocial != null && String(client.capitalSocial).replace(/\D/g, "") === "0") {
    dicas.push(makeIssue("capitalSocial", "Capital social não informado pela fonte", "Valor zerado retornado pela fonte pública", "Sem impacto fiscal direto", "CAPITAL_SOCIAL_ZERADO", "Informe o capital social se disponível", "INFORMATIVO", "DICA"));
  }

  if (isPJ && Array.isArray(client.cnaeSecundarios) && client.cnaeSecundarios.length === 0) {
    dicas.push(makeIssue("cnaeSecundarios", "Empresa sem CNAEs secundários registrados", "Muitas empresas não possuem CNAEs secundários", "Sem impacto fiscal direto", "CNAE_SECUNDARIO_VAZIO", "Normal se a empresa tem atividade única", "INFORMATIVO", "DICA"));
  }

  return { pendencias, alertas, dicas };
}

function mapClientFormToCreatePayload(formData: Partial<IntelligentClient>): Record<string, unknown> {
  const nullIfEmpty = (v: unknown): unknown => (v === "" || v === undefined || v === null) ? null : v;
  const digitsOnly = (v: unknown): string | null => {
    if (!v) return null;
    const d = String(v).replace(/\D/g, "");
    return d.length > 0 ? d : null;
  };
  const parseNum = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  const cnpj = digitsOnly(formData.cnpj);
  const cpf = digitsOnly(formData.cpf);

  return {
    tipoPessoa: formData.tipoPessoa || "PJ",
    cnpj,
    cpf,
    razaoSocial: nullIfEmpty(formData.razaoSocial),
    nomeFantasia: nullIfEmpty(formData.nomeFantasia),
    nome: nullIfEmpty(formData.nome),
    naturezaJuridica: nullIfEmpty(formData.naturezaJuridica),
    porte: nullIfEmpty(formData.porte),
    capitalSocial: nullIfEmpty(formData.capitalSocial),
    dataAbertura: nullIfEmpty(formData.dataAbertura),
    situacaoCadastral: nullIfEmpty(formData.situacaoCadastral),
    situacaoMotivo: nullIfEmpty(formData.situacaoMotivo),
    optanteSimples: formData.optanteSimples ?? null,
    mei: formData.mei ?? null,
    empresaPublica: formData.empresaPublica ?? null,
    filial: formData.filial ?? null,
    matriz: formData.matriz ?? null,
    regimeTributario: nullIfEmpty(formData.regimeTributario),
    crt: nullIfEmpty(formData.crt),
    indicadorIe: nullIfEmpty(formData.indicadorIe),
    inscricaoEstadual: nullIfEmpty(formData.inscricaoEstadual),
    ieStatus: nullIfEmpty(formData.ieStatus),
    inscricaoMunicipal: nullIfEmpty(formData.inscricaoMunicipal),
    imStatus: nullIfEmpty(formData.imStatus),
    tipoContribuinte: nullIfEmpty(formData.tipoContribuinte),
    contribuinteIcms: formData.contribuinteIcms ?? null,
    contribuinteIss: formData.contribuinteIss ?? null,
    substituicaoTributaria: formData.substituicaoTributaria ?? null,
    retencoes: formData.retencoes ?? null,
    cnae: nullIfEmpty(formData.cnae),
    atividadeEconomica: nullIfEmpty(formData.atividadeEconomica),
    cnaeSecundarios: formData.cnaeSecundarios ?? null,
    riscoFiscalCnae: nullIfEmpty(formData.riscoFiscalCnae),
    cep: digitsOnly(formData.cep),
    logradouro: nullIfEmpty(formData.logradouro),
    numero: nullIfEmpty(formData.numero),
    complemento: nullIfEmpty(formData.complemento),
    bairro: nullIfEmpty(formData.bairro),
    municipio: nullIfEmpty(formData.municipio),
    uf: nullIfEmpty(formData.uf),
    codigoIbge: nullIfEmpty(formData.codigoIbge),
    codigoUfIbge: nullIfEmpty(formData.codigoUfIbge),
    pais: nullIfEmpty(formData.pais) ?? (cnpj ? "BRASIL" : null),
    latitude: parseNum(formData.latitude),
    longitude: parseNum(formData.longitude),
    telefone: digitsOnly(formData.telefone),
    whatsapp: digitsOnly(formData.whatsapp),
    email: nullIfEmpty(formData.email),
    site: nullIfEmpty(formData.site),
    contatoFinanceiro: nullIfEmpty(formData.contatoFinanceiro),
    contatoFiscal: nullIfEmpty(formData.contatoFiscal),
    observacoes: nullIfEmpty(formData.observacoes),
    fonteDados: nullIfEmpty(formData.fonteDados),
    dadosOriginaisJson: nullIfEmpty(formData.dadosOriginaisJson),
    alertasJson: nullIfEmpty(formData.alertasJson),
    historicoJson: formData.historicoJson ?? null,
    fiscalAi: formData.fiscalAi ?? null,
    scoreCadastro: parseNum(formData.scoreCadastro),
    scoreDetalhes: formData.scoreDetalhes ?? null,
    reformaPrep: formData.reformaPrep ?? null,
    validadoPorIa: formData.validadoPorIa ?? false,
    ultimaConsulta: formData.ultimaConsulta ?? null,
  };
}

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

export function IntelligentClientView({ clientId, viewMode: viewModeProp, onBack }: IntelligentClientViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"PJ" | "PF">("PJ");
  const [docValue, setDocValue] = useState("");
  const [form, setForm] = useState<Partial<IntelligentClient>>({ tipoPessoa: "PJ" });
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});
  const [manualEdited, setManualEdited] = useState<Set<string>>(new Set());
  const manualEditedRef = useRef(manualEdited);
  manualEditedRef.current = manualEdited;
  const [smartErrors, setSmartErrors] = useState<SmartError[]>([]);
  const [clientIssues, setClientIssues] = useState<ClientIssues>({ pendencias: [], alertas: [], dicas: [] });
  const [fiscalAi, setFiscalAi] = useState<FiscalAiResult | null>(null);
  const [score, setScore] = useState<{ overall: number; detalhes: ScoreDetalhes } | null>(null);
  const [activeTab, setActiveTab] = useState("cadastro");
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientLoadError, setClientLoadError] = useState<string | null>(null);

  const resolvedMode = viewModeProp ?? (clientId ? "edit" : "create");
  const isReadOnly = resolvedMode === "view";

  const runValidation = useCallback(async (data: Partial<IntelligentClient>) => {
    try {
      const result = await validarCliente(data as Record<string, unknown>);
      const allErrors: SmartError[] = [
        ...(result.alertas ?? []),
        ...(result.pendencias ?? []),
        ...(result.dicas ?? []),
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

  const recalcIssues = useCallback((data: Partial<IntelligentClient>) => {
    const issues = buildClientIssues(data);
    setClientIssues(issues);
  }, []);

  const scheduleValidation = useCallback((data: Partial<IntelligentClient>) => {
    recalcIssues(data);
    const key = "validation";
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => runValidation(data), 800);
  }, [runValidation, recalcIssues]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoadingClient(true);
    setClientLoadError(null);
    getClient(clientId)
      .then((data) => {
        if (cancelled) return;
        setForm(data);
        setTab(data.tipoPessoa ?? "PJ");
        setDocValue(
          data.tipoPessoa === "PJ" && data.cnpj
            ? maskCnpj(data.cnpj)
            : data.cpf
              ? maskCpf(data.cpf)
              : "",
        );
        recalcIssues(data);
        if (data.scoreCadastro != null) {
          setScore({ overall: data.scoreCadastro, detalhes: data.scoreDetalhes ?? { cadastrais: 0, fiscais: 0, endereco: 0, contato: 0, sped: 0, nfse: 0 } });
        }
        if (data.fiscalAi) setFiscalAi(data.fiscalAi);
      })
      .catch(() => {
        if (cancelled) return;
        setClientLoadError("Não foi possível carregar os dados do cliente.");
        notify({ title: "Erro ao carregar cliente", tone: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoadingClient(false);
      });
    return () => { cancelled = true; };
  }, [clientId, recalcIssues]);

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
    if (isReadOnly) return;
    const raw = e.target.value;
    let value: unknown = raw || null;
    if (field === "optanteSimples" || field === "mei" || field === "empresaPublica" || field === "substituicaoTributaria" || field === "contribuinteIcms" || field === "contribuinteIss" || field === "matriz" || field === "filial" || field === "validadoPorIa") {
      if (raw === "true") value = true;
      else if (raw === "false") value = false;
      else value = null;
    }
    setForm((f) => {
      const updated = { ...f, [field]: value };
      scheduleValidation(updated);
      return updated;
    });
    setAutoFilled((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setManualEdited((prev) => new Set(prev).add(field));
  }, [scheduleValidation, isReadOnly]);

  const markAutoFilled = useCallback((fields: string[]) => {
    setAutoFilled((prev) => {
      const next = { ...prev };
      for (const f of fields) next[f] = true;
      return next;
    });
  }, []);


  const RESET_FIELDS: (keyof IntelligentClient)[] = [
    "razaoSocial", "nomeFantasia", "nome", "naturezaJuridica", "porte",
    "capitalSocial", "dataAbertura", "situacaoCadastral", "situacaoMotivo",
    "situacaoData", "optanteSimples", "mei",
    "empresaPublica", "matriz", "filial", "regimeTributario", "crt",
    "descricaoCrt", "indicadorIe", "inscricaoEstadual", "ieStatus",
    "inscricaoMunicipal", "imStatus", "tipoContribuinte", "contribuinteIcms",
    "contribuinteIss", "substituicaoTributaria", "retencoes", "cnae",
    "atividadeEconomica", "cnaeSecundarios", "riscoFiscalCnae",
    "atividadesPermitidas", "atividadesIncompativeis", "cep", "logradouro",
    "numero", "complemento", "bairro", "municipio", "uf", "codigoIbge",
    "codigoUfIbge", "pais", "latitude", "longitude", "telefone", "whatsapp",
    "email", "site", "contatoFinanceiro", "contatoFiscal", "observacoes",
    "fonteDados", "dadosOriginaisJson", "alertasJson", "fiscalAi",
    "scoreCadastro", "scoreDetalhes", "reformaPrep", "validadoPorIa",
    "ultimaConsulta", "historicoJson",
  ];

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
    onMutate: () => {
      const docDigit = tab === "PJ" ? normalizeCnpj(docValue) : normalizeCpf(docValue);
      const docField = tab === "PJ" ? "cnpj" : "cpf";
      const reset: Partial<IntelligentClient> = { tipoPessoa: tab, [docField]: docDigit };
      for (const key of RESET_FIELDS) {
        (reset as Record<string, unknown>)[key] = null;
      }
      setForm(reset);
      setAutoFilled({});
      setManualEdited(new Set());
      setSmartErrors([]);
      setClientIssues({ pendencias: [], alertas: [], dicas: [] });
      setFiscalAi(null);
      setScore(null);
    },
    onSuccess: (data: ClientLookupResult) => {
      const filled: string[] = [];
      const updates: Partial<IntelligentClient> = { tipoPessoa: tab };
      const histEntries: Omit<HistoricoEntry, "quando">[] = [];

      const autoSet = (field: keyof IntelligentClient, value: unknown, label?: string) => {
        if (value == null || value === "") return;
        if (manualEditedRef.current.has(field)) return;
        const prev = formRef.current[field];
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
        autoSet("situacaoData", data.situacaoData, "Data Situação");
        autoSet("optanteSimples", data.optanteSimples, "Optante Simples");
        autoSet("mei", data.mei, "MEI");
        autoSet("matriz", data.matriz, "Matriz");
        autoSet("filial", data.filial, "Filial");
        autoSet("indicadorIe", data.indicadorIe, "Indicador IE");
        autoSet("tipoContribuinte", data.tipoContribuinte, "Tipo de Contribuinte");
        autoSet("inscricaoEstadual", data.inscricaoEstadual, "Inscrição Estadual");
        autoSet("cnae", data.cnae, "CNAE Principal");
        autoSet("atividadeEconomica", data.atividadeEconomica, "Atividade Econômica");
        autoSet("contribuinteIcms", data.contribuinteIcms ?? (data.indicadorIe === "1" ? true : data.indicadorIe === "9" ? false : null), "Contribuinte ICMS");
        autoSet("ieStatus", data.ieStatus, "IE Status");
        autoSet("imStatus", data.imStatus, "IM Status");
        autoSet("inscricaoMunicipal", data.inscricaoMunicipal, "Inscrição Municipal");
        autoSet("retencoes", data.retencoes, "Retenções");
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

        const rawTel = data.telefone || data.telefone1 || null;
        const rawTelDigits = rawTel ? String(rawTel).replace(/\D/g, "") : "";
        if (rawTelDigits.length >= 10 && rawTelDigits.length <= 11) {
          autoSet("telefone", formatPhone(rawTelDigits), "Telefone");
        } else if (rawTelDigits.length === 8 || rawTelDigits.length === 9) {
          const ddd = data.ddd || null;
          if (ddd) {
            autoSet("telefone", formatPhone(ddd + rawTelDigits), "Telefone");
          } else {
            autoSet("telefone", formatPhone(rawTelDigits), "Telefone");
          }
        } else if (rawTel) {
          autoSet("telefone", rawTel, "Telefone");
        }

        autoSet("email", data.email, "Email");
        autoSet("cnaeSecundarios", data.cnaeSecundarios, "CNAEs Secundários");
      }

      if (tab === "PJ" && updates.inscricaoEstadual) {
        (updates as Record<string, unknown>).indicadorIe = "1";
        (updates as Record<string, unknown>).tipoContribuinte = "Contribuinte ICMS";
        (updates as Record<string, unknown>).contribuinteIcms = true;
      }

      if (tab === "PJ") {
        const mei = updates.mei != null ? updates.mei : formRef.current.mei;
        const optanteSimples = updates.optanteSimples != null ? updates.optanteSimples : formRef.current.optanteSimples;
        if (mei === true) {
          (updates as Record<string, unknown>).crt = "4";
          (updates as Record<string, unknown>).regimeTributario = "MEI";
          (updates as Record<string, unknown>).descricaoCrt = "4 — MEI";
        } else if (optanteSimples === true) {
          (updates as Record<string, unknown>).crt = "1";
          (updates as Record<string, unknown>).regimeTributario = "Simples Nacional";
          (updates as Record<string, unknown>).descricaoCrt = "1 — Simples Nacional";
        } else {
          (updates as Record<string, unknown>).crt = null;
          (updates as Record<string, unknown>).regimeTributario = "PENDENTE_CONFIRMACAO";
          (updates as Record<string, unknown>).descricaoCrt = null;
        }
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
        recalcIssues(merged);
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
      const payload = mapClientFormToCreatePayload(formRef.current);
      if (clientId) return updateClient(clientId, payload);
      return createClient(payload);
    },
    onSuccess: () => {
      notify({ title: clientId ? "Cliente atualizado com sucesso" : "Cliente salvo com sucesso", tone: "success" });
      setTimeout(() => {
        router.push("/clients");
        router.refresh();
      }, 600);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        const fieldMsg = err.field ? ` — ${err.field}` : "";
        const details = Array.isArray(err.details) && err.details.length > 0
          ? ": " + err.details.map((d: Record<string, unknown>) => `${d.field ?? ""} ${d.message ?? ""}`).join(", ")
          : "";
        notify({ title: "Não foi possível salvar cliente", description: `${err.message}${fieldMsg}${details}`, tone: "error" });
      } else {
        notify({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Erro desconhecido", tone: "error" });
      }
    },
  });

  const sintegraMutation = useMutation({
    mutationFn: async () => {
      const cnpj = normalizeCnpj(form.cnpj ?? "");
      if (cnpj.length !== 14) throw new Error("CNPJ não informado");
      return validarSintegra(cnpj, form.uf ?? undefined);
    },
    onSuccess: (data) => {
      const updates: Partial<IntelligentClient> = {};
      const histEntries: Omit<HistoricoEntry, "quando">[] = [];

      if (data.inscricaoEstadual && !manualEditedRef.current.has("inscricaoEstadual")) {
        const prev = form.inscricaoEstadual;
        if (prev !== data.inscricaoEstadualFormatada) {
          updates.inscricaoEstadual = data.inscricaoEstadualFormatada ?? data.inscricaoEstadual;
          histEntries.push({ quem: "FiscalAI", campo: "Inscrição Estadual", valorAnterior: prev ?? null, valorNovo: String(updates.inscricaoEstadual), origem: "FISCAL_AI" });
        }
      }
      if (data.indicadorIe && !manualEditedRef.current.has("indicadorIe")) {
        const prev = form.indicadorIe;
        if (prev !== data.indicadorIe) {
          updates.indicadorIe = data.indicadorIe;
          histEntries.push({ quem: "FiscalAI", campo: "Indicador IE", valorAnterior: prev ?? null, valorNovo: data.indicadorIe, origem: "FISCAL_AI" });
        }
      }
      if (data.contribuinteIcms !== undefined && !manualEditedRef.current.has("contribuinteIcms")) {
        const prev = form.contribuinteIcms;
        if (prev !== data.contribuinteIcms) {
          updates.contribuinteIcms = data.contribuinteIcms;
          histEntries.push({ quem: "FiscalAI", campo: "Contribuinte ICMS", valorAnterior: prev != null ? String(prev) : null, valorNovo: String(data.contribuinteIcms), origem: "FISCAL_AI" });
        }
      }
      if (data.ieStatus && !manualEditedRef.current.has("ieStatus")) {
        updates.ieStatus = data.ieStatus;
        histEntries.push({ quem: "FiscalAI", campo: "IE Status", valorAnterior: form.ieStatus ?? null, valorNovo: data.ieStatus, origem: "FISCAL_AI" });
      }
      if (data.tipoContribuinte && !manualEditedRef.current.has("tipoContribuinte")) {
        const prev = form.tipoContribuinte;
        if (prev !== data.tipoContribuinte) {
          updates.tipoContribuinte = data.tipoContribuinte;
          histEntries.push({ quem: "FiscalAI", campo: "Tipo Contribuinte", valorAnterior: prev ?? null, valorNovo: data.tipoContribuinte, origem: "FISCAL_AI" });
        }
      }

      if (Object.keys(updates).length > 0) {
        setForm((prev) => {
          const merged = { ...prev, ...updates };
          merged.historicoJson = addHistorico(prev.historicoJson ?? null, histEntries);
          return merged;
        });
        markAutoFilled(Object.keys(updates));
      }

      const desc = data.situacao === "HABILITADO" || data.ieStatus === "ENCONTRADA"
        ? `IE ${data.inscricaoEstadualFormatada ?? data.inscricaoEstadual} — ${data.ieStatus}`
        : data.situacao;
      notify({ title: "Sintegra validado", description: desc, tone: "success" });
      scheduleValidation({ ...form, ...updates });
    },
    onError: (err: Error) => {
      notify({ title: "Erro na validação Sintegra", description: err.message, tone: "error" });
    },
  });

  const enderecoMutation = useMutation({
    mutationFn: async () => {
      const cep = String(form.cep ?? "").replace(/\D/g, "");
      if (cep.length !== 8) throw new Error("CEP inválido ou não informado");
      return lookupViaCep(cep);
    },
    onSuccess: (data) => {
      if (!data) {
        notify({ title: "CEP não encontrado", tone: "error" });
        return;
      }
      const updates: Partial<IntelligentClient> = {};
      const histEntries: Omit<HistoricoEntry, "quando">[] = [];
      const setIfEmpty = (field: keyof IntelligentClient, value: unknown, label: string) => {
        if (value == null || value === "") return;
        if (manualEditedRef.current.has(field)) return;
        const prev = form[field];
        if (prev != null && prev !== "") return;
        (updates as Record<string, unknown>)[field] = value;
        if (prev !== value) {
          histEntries.push({ quem: "FiscalAI", campo: label, valorAnterior: prev != null ? String(prev) : null, valorNovo: String(value), origem: "FISCAL_AI" });
        }
      };
      setIfEmpty("logradouro", data.logradouro, "Logradouro");
      setIfEmpty("bairro", data.bairro, "Bairro");
      setIfEmpty("complemento", data.complemento, "Complemento");
      setIfEmpty("municipio", data.cidade, "Município");
      setIfEmpty("uf", data.uf, "UF");
      setIfEmpty("codigoIbge", data.codigoIbge, "Código IBGE");

      if (Object.keys(updates).length > 0) {
        setForm((prev) => {
          const merged = { ...prev, ...updates };
          merged.historicoJson = addHistorico(prev.historicoJson ?? null, histEntries);
          return merged;
        });
        markAutoFilled(Object.keys(updates));
        notify({ title: "Endereço completado", description: `${Object.keys(updates).length} campos preenchidos via ViaCEP`, tone: "success" });
      } else {
        notify({ title: "Endereço já completo", description: "Nenhum campo vazio para preencher", tone: "success" });
      }
      recalcIssues({ ...formRef.current, ...updates });
    },
    onError: (err: Error) => {
      notify({ title: "Erro ao buscar CEP", description: err.message, tone: "error" });
    },
  });

  const fiscalAiMutation = useMutation({
    mutationFn: async () => {
      return validarCliente(form as Record<string, unknown>);
    },
    onSuccess: (result) => {
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
      setForm((f) => ({
        ...f,
        historicoJson: addHistorico(f.historicoJson ?? null, [
          { quem: "FiscalAI", campo: "Diagnóstico Fiscal", valorAnterior: null, valorNovo: `Score ${result.scoreCadastro}% | ${allErrors.length} pendências`, origem: "FISCAL_AI" },
        ]),
      }));
      recalcIssues(formRef.current);
      notify({ title: "Diagnóstico Fiscal concluído", description: `Score: ${result.scoreCadastro}% — ${allErrors.length} pendências`, tone: "success" });
    },
    onError: () => {
      notify({ title: "Diagnóstico indisponível", tone: "error" });
    },
  });

  const recalcularMutation = useMutation({
    mutationFn: async () => {
      return validarCliente(form as Record<string, unknown>);
    },
    onSuccess: (result) => {
      setScore({ overall: result.scoreCadastro, detalhes: result.scoreDetalhes });
      setForm((f) => ({
        ...f,
        historicoJson: addHistorico(f.historicoJson ?? null, [
          { quem: "Usuário", campo: "Score", valorAnterior: f.scoreCadastro != null ? String(f.scoreCadastro) : null, valorNovo: String(result.scoreCadastro), origem: "USUARIO" },
        ]),
      }));
      recalcIssues(formRef.current);
      notify({ title: "Score recalculado", description: `${result.scoreCadastro}%`, tone: "success" });
    },
    onError: () => {
      notify({ title: "Erro ao recalcular score", tone: "error" });
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
      const next = { ...formRef.current, crt: "4" };
      setForm(next);
      setSmartErrors((prev) => prev.map((e) => (e.id === err.id ? { ...e, corrigido: true } : e)));
      const entry: Omit<HistoricoEntry, "quando"> = {
        quem: "FiscalAI",
        campo: "CRT",
        valorAnterior: form.crt ?? null,
        valorNovo: "4",
        origem: "FISCAL_AI",
      };
      setForm((f) => ({ ...f, historicoJson: addHistorico(f.historicoJson ?? null, [entry]) }));
      recalcIssues(next);
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
  const dedupIssues = <T extends SmartError>(base: T[], extra: T[]): T[] => {
    const seenIds = new Set(base.map((e) => e.id));
    const seenFields = new Set(base.map((e) => `${e.tipo}_${e.campo}`));
    return [...base, ...extra.filter((e) => !seenIds.has(e.id) && !seenFields.has(`${e.tipo}_${e.campo}`))];
  };
  const apiErros = smartErrors.filter((e) => e.tipo === "ERRO");
  const apiAlertas = smartErrors.filter((e) => e.tipo === "ALERTA");
  const apiDicas = smartErrors.filter((e) => e.tipo === "DICA");
  const erros = dedupIssues(clientIssues.pendencias, apiErros);
  const alertas = dedupIssues(clientIssues.alertas, apiAlertas);
  const dicas = dedupIssues(clientIssues.dicas, apiDicas);

  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    recalcIssues(formRef.current);
    if (hasLookup) runValidation(formRef.current);
  }, [hasLookup, runValidation, recalcIssues]);

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
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <button type="button" onClick={onBack ?? (() => router.push("/clients"))} className="flex items-center gap-2 text-sm text-subtle hover:text-ink transition">
        <ArrowLeft className="h-4 w-4" /> Voltar para lista
      </button>

      {loadingClient && (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-subtle" />
          <p className="text-sm text-subtle">Carregando dados do cliente...</p>
        </Card>
      )}

      {clientLoadError && !loadingClient && (
        <Card className="p-12 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-red-500" />
          <p className="text-sm text-red-600">{clientLoadError}</p>
          <Button variant="outline" className="mt-4" onClick={onBack ?? (() => router.push("/clients"))}>Voltar para lista</Button>
        </Card>
      )}

      {!loadingClient && !clientLoadError && (
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="h-12">
              <Tabs value={tab} onValueChange={(v) => { setTab(v as "PJ" | "PF"); setDocValue(""); setForm({ tipoPessoa: v as "PJ" | "PF" }); setAutoFilled({}); setManualEdited(new Set()); }}>
                <TabsList className="h-12">
                  <TabsTrigger value="PJ" className="h-10 px-4"><Building2 className="mr-1.5 h-3.5 w-3.5" /> PJ</TabsTrigger>
                  <TabsTrigger value="PF" className="h-10 px-4"><User className="mr-1.5 h-3.5 w-3.5" /> PF</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="w-64">
              <Input
                label={tab === "PJ" ? "CNPJ" : "CPF"}
                value={maskedDocument}
                onChange={(e) => setDocValue(e.target.value)}
                placeholder={tab === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                disabled={isReadOnly}
                className="h-12"
              />
            </div>
            {!isReadOnly && (
            <Button
              variant="lime"
              onClick={() => lookupMutation.mutate()}
              disabled={lookupMutation.isPending || !docValue}
              className="h-12 px-6 whitespace-nowrap"
            >
              {lookupMutation.isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Search className="h-4 w-4 shrink-0" />}
              Buscar Dados
            </Button>
            )}
            {isReadOnly && (
            <Badge variant="outline" className="h-12 px-4 text-sm">Modo visualização</Badge>
            )}
          </div>
        </div>
      </Card>
      )}

      {!loadingClient && !clientLoadError && hasLookup && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex justify-center mb-5">
                <TabsList className="inline-flex gap-1.5 rounded-2xl bg-surface p-2 shadow-sm border border-line">
                  {TAB_ITEMS.map(({ value, label, Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className={cn(
                        "flex min-w-[130px] h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap px-5",
                        "text-subtle hover:text-ink hover:bg-white/60",
                        "data-[state=active]:bg-lime data-[state=active]:text-ink data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-lime-dark/40"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="cadastro">
                <Card className="p-6 space-y-6">
                  <h2 className="text-base font-extrabold text-ink">Dados Cadastrais</h2>
                  {tab === "PJ" ? (
                    <>
                      <div>
                        <h3 className="text-sm font-bold text-subtle uppercase tracking-wide mb-3">Identificação</h3>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          <Input label="CNPJ" value={form.cnpj ? maskCnpj(form.cnpj) : ""} readOnly disabled={isReadOnly} className={greenRing("cnpj")} />
                          <Input label="Razão Social" value={form.razaoSocial ?? ""} onChange={onChange("razaoSocial")} disabled={isReadOnly} className={cn("lg:col-span-2", greenRing("razaoSocial"))} />
                          <Input label="Nome Fantasia" value={form.nomeFantasia ?? ""} onChange={onChange("nomeFantasia")} disabled={isReadOnly} className={cn("lg:col-span-2", greenRing("nomeFantasia"))} />
                          <Input label="Natureza Jurídica" value={form.naturezaJuridica ?? ""} onChange={onChange("naturezaJuridica")} disabled={isReadOnly} className={cn("lg:col-span-2", greenRing("naturezaJuridica"))} />
                        </div>
                      </div>
                      <hr className="border-line" />
                      <div>
                        <h3 className="text-sm font-bold text-subtle uppercase tracking-wide mb-3">Situação & Enquadramento</h3>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                                <span className="text-sm text-subtle italic">Pendente de confirmação</span>
                              )}
                            </div>
                          </div>
                          <Input label="Porte" value={normalizePorte(form.porte)} readOnly disabled={isReadOnly} className={greenRing("porte")} />
                          <Input label="Capital Social" value={form.capitalSocial ?? ""} onChange={onChange("capitalSocial")} disabled={isReadOnly} className={greenRing("capitalSocial")} />
                          <Input label="Data de Abertura" value={form.dataAbertura ? new Date(form.dataAbertura).toLocaleDateString("pt-BR") : ""} readOnly disabled={isReadOnly} className={greenRing("dataAbertura")} />
                          <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-ink">Optante Simples</label>
                            <select
                              value={form.optanteSimples === null ? "" : form.optanteSimples ? "true" : "false"}
                              onChange={onChange("optanteSimples")}
                              disabled={isReadOnly}
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
                              disabled={isReadOnly}
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
                              {form.matriz === true ? (
                                <Badge variant="info">MATRIZ</Badge>
                              ) : form.filial === true ? (
                                <Badge variant="neutral">FILIAL</Badge>
                              ) : (
                                <span className="text-sm text-subtle italic">Não informado</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <Input label="CPF" value={form.cpf ? maskCpf(form.cpf) : ""} readOnly disabled={isReadOnly} className={greenRing("cpf")} />
                      <Input label="Nome Completo" value={form.nome ?? ""} onChange={onChange("nome")} disabled={isReadOnly} className={cn("lg:col-span-2", greenRing("nome"))} />
                      <Input label="RG" value={form.rg ?? ""} onChange={onChange("rg")} disabled={isReadOnly} />
                      <Input label="Data de Nascimento" value={form.dataNascimento ?? ""} onChange={onChange("dataNascimento")} disabled={isReadOnly} />
                    </div>
                  )}

                  {tab === "PJ" && form.cnaeSecundarios && form.cnaeSecundarios.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-subtle uppercase tracking-wide flex items-center gap-1.5">
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
                <Card className="p-6 space-y-6">
                  <h2 className="text-base font-extrabold text-ink">Dados Fiscais</h2>
                  <div>
                    <h3 className="text-sm font-bold text-subtle uppercase tracking-wide mb-3">Regime & Tributação</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Regime Tributário</label>
                        <select
                          value={form.regimeTributario ?? ""}
                          onChange={onChange("regimeTributario")}
                          disabled={isReadOnly}
                          className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("regimeTributario"))}
                        >
                          <option value="">Selecione</option>
                          <option value="MEI">MEI</option>
                          <option value="Simples Nacional">Simples Nacional</option>
                          <option value="Simples Nacional - Excesso de sublimite">Simples Nacional - Excesso sublimite</option>
                          <option value="Lucro Presumido">Lucro Presumido</option>
                          <option value="Lucro Real">Lucro Real</option>
                          <option value="PENDENTE_CONFIRMACAO">Pendente de confirmação</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">CRT</label>
                         <select value={form.crt ?? ""} onChange={onChange("crt")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("crt"))}>
                           <option value="">Selecione</option>
                           <option value="1">1 — Simples Nacional</option>
                           <option value="2">2 — Simples com ST</option>
                           <option value="3">3 — Regime Normal</option>
                           <option value="4">4 — MEI / Simei</option>
                         </select>
                         {form.descricaoCrt && <span className="text-xs text-subtle mt-0.5">{form.descricaoCrt}</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Indicador IE</label>
                        <select value={form.indicadorIe ?? ""} onChange={onChange("indicadorIe")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("indicadorIe"))}>
                          <option value="">Selecione</option>
                          <option value="1">1 — Contribuinte ICMS</option>
                          <option value="2">2 — Isento</option>
                          <option value="9">9 — Não contribuinte</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Tipo de Contribuinte</label>
                        <select value={form.tipoContribuinte ?? ""} onChange={onChange("tipoContribuinte")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5", greenRing("tipoContribuinte"))}>
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
                        <label className="text-sm font-medium text-ink">Substituição Tributária</label>
                        <select
                          value={form.substituicaoTributaria === null ? "" : form.substituicaoTributaria ? "true" : "false"}
                          onChange={onChange("substituicaoTributaria")}
                          disabled={isReadOnly}
                          className="flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5"
                        >
                          <option value="">Selecione</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <hr className="border-line" />
                  <div>
                    <h3 className="text-sm font-bold text-subtle uppercase tracking-wide mb-3">Inscrições & CNAE</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Inscrição Estadual</label>
                        <div className="flex items-center gap-2">
                          <Input value={form.inscricaoEstadual ?? ""} onChange={onChange("inscricaoEstadual")} disabled={isReadOnly} className={greenRing("inscricaoEstadual")} />
                          {form.ieStatus && <Badge variant={form.ieStatus === "ENCONTRADA" ? "success" : "danger"}>{form.ieStatus}</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Inscrição Municipal</label>
                        <div className="flex items-center gap-2">
                          <Input value={form.inscricaoMunicipal ?? ""} onChange={onChange("inscricaoMunicipal")} disabled={isReadOnly} className={greenRing("inscricaoMunicipal")} />
                          {form.imStatus && <Badge variant={form.imStatus === "ATIVA" ? "success" : "danger"}>{form.imStatus}</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-ink">Contribuinte ISS</label>
                        <div className="flex items-center gap-2 h-11 rounded-xl border border-line bg-white px-3.5">
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
                      <Input label="CNAE Principal" value={form.cnae ?? ""} onChange={onChange("cnae")} disabled={isReadOnly} className={greenRing("cnae")} />
                      <Input label="Atividade Econômica" value={form.atividadeEconomica ?? ""} onChange={onChange("atividadeEconomica")} disabled={isReadOnly} className={cn("lg:col-span-2", greenRing("atividadeEconomica"))} />
                    </div>
                  </div>
                  <hr className="border-line" />
                  <div>
                    <h3 className="text-sm font-bold text-subtle uppercase tracking-wide mb-3">Retenções</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {([
                        { key: "irrf" as const, label: "IRRF", tooltip: "Imposto de Renda Retido na Fonte — aplicável sobre pagamentos de serviços profissionais, rendimentos de capital, etc." },
                        { key: "csll" as const, label: "CSLL", tooltip: "Contribuição Social sobre o Lucro Líquido — incidente sobre lucro, receitas ou pagamentos a prestadores de serviço PJ." },
                        { key: "pis" as const, label: "PIS", tooltip: "Programa de Integração Social — retido sobre pagamentos por serviços PJ (1,65% sobre a base)." },
                        { key: "cofins" as const, label: "COFINS", tooltip: "Contribuição para Financiamento da Seguridade Social — retido sobre pagamentos por serviços PJ (7,6% sobre a base)." },
                        { key: "iss" as const, label: "ISS", tooltip: "Imposto Sobre Serviços — municipal, retido pelo tomador quando o prestador não é optante do Simples ou excede o sublimite." },
                      ]).map(({ key, label, tooltip }) => {
                        const checked = !!form.retencoes?.[key];
                        return (
                          <label
                            key={key}
                            title={tooltip}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-200",
                              checked
                                ? "border-emerald-300 bg-emerald-50 shadow-sm"
                                : "border-line bg-white hover:border-ink/20"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isReadOnly}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  retencoes: {
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
                            <span className={cn("text-sm font-bold", checked ? "text-emerald-700" : "text-ink")}>
                              {label}
                            </span>
                            <Info className="ml-auto h-3.5 w-3.5 text-subtle shrink-0" />
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-subtle">
                      Retenções não são marcadas automaticamente — marque apenas quando Sintegra ou fonte confiável confirmar.
                    </p>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="endereco">
                <Card className="p-6 space-y-6">
                  <h2 className="text-base font-extrabold text-ink">Endereço</h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Input label="CEP" value={form.cep ?? ""} onChange={onChange("cep")} disabled={isReadOnly} className={greenRing("cep")} />
                    <Input label="Logradouro" value={form.logradouro ?? ""} onChange={onChange("logradouro")} disabled={isReadOnly} className={cn("lg:col-span-2", greenRing("logradouro"))} />
                    <Input label="Número" value={form.numero ?? ""} onChange={onChange("numero")} disabled={isReadOnly} className={greenRing("numero")} />
                    <Input label="Complemento" value={form.complemento ?? ""} onChange={onChange("complemento")} disabled={isReadOnly} className={greenRing("complemento")} />
                    <Input label="Bairro" value={form.bairro ?? ""} onChange={onChange("bairro")} disabled={isReadOnly} className={greenRing("bairro")} />
                    <Input label="Cidade / Município" value={form.municipio ?? ""} onChange={onChange("municipio")} disabled={isReadOnly} className={greenRing("municipio")} />
                    <Input label="UF" value={form.uf ?? ""} onChange={onChange("uf")} disabled={isReadOnly} className={greenRing("uf")} />
                    <Input label="Código Município IBGE" value={form.codigoIbge ?? ""} onChange={onChange("codigoIbge")} disabled={isReadOnly} className={greenRing("codigoIbge")} />
                    <Input label="Código UF IBGE" value={form.codigoUfIbge ?? ""} onChange={onChange("codigoUfIbge")} disabled={isReadOnly} className={greenRing("codigoUfIbge")} />
                    <Input label="País" value={form.pais ?? ""} onChange={onChange("pais")} disabled={isReadOnly} className={greenRing("pais")} />
                  </div>
                  <hr className="border-line" />
                  <h2 className="text-base font-extrabold text-ink">Contato</h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Input label="Telefone" value={form.telefone ?? ""} onChange={onChange("telefone")} disabled={isReadOnly} className={greenRing("telefone")} />
                    <Input label="WhatsApp" value={form.whatsapp ?? ""} onChange={onChange("whatsapp")} disabled={isReadOnly} />
                    <Input label="Email" value={form.email ?? ""} onChange={onChange("email")} disabled={isReadOnly} className={greenRing("email")} />
                    <Input label="Site" value={form.site ?? ""} onChange={onChange("site")} disabled={isReadOnly} />
                    <Input label="Contato Financeiro" value={form.contatoFinanceiro ?? ""} onChange={onChange("contatoFinanceiro")} disabled={isReadOnly} />
                    <Input label="Contato Fiscal" value={form.contatoFiscal ?? ""} onChange={onChange("contatoFiscal")} disabled={isReadOnly} />
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
                                {entry.quando ? new Date(entry.quando).toLocaleString("pt-BR") : "Não informado"}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-ink">{entry.campo}</td>
                              <td className="px-4 py-3 text-sm text-subtle">{entry.valorAnterior ?? "Não informado"}</td>
                              <td className="px-4 py-3 text-sm text-ink">{entry.valorNovo ?? "Não informado"}</td>
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

          <aside className="w-full space-y-3 lg:w-80 shrink-0">
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

            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm font-extrabold text-ink">Pendências</p>
                <Badge variant={erros.length > 0 ? "danger" : "neutral"}>{erros.length}</Badge>
              </div>
              {erros.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {erros.map(renderSmartError)}
                </div>
              ) : (
                <p className="text-xs text-subtle py-2">Cadastro sem pendências críticas</p>
              )}
            </Card>

            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-extrabold text-ink">Alertas</p>
                <Badge variant={alertas.length > 0 ? "warning" : "neutral"}>{alertas.length}</Badge>
              </div>
              {alertas.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {alertas.map(renderSmartError)}
                </div>
              ) : (
                <p className="text-xs text-subtle py-2">Nenhum alerta encontrado</p>
              )}
            </Card>

            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-indigo-500" />
                <p className="text-sm font-extrabold text-ink">Dicas</p>
                <Badge variant={dicas.length > 0 ? "info" : "neutral"}>{dicas.length}</Badge>
              </div>
              {dicas.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dicas.map(renderSmartError)}
                </div>
              ) : (
                <p className="text-xs text-subtle py-2">Nenhuma dica pendente</p>
              )}
            </Card>

            {!isReadOnly && (
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-ink" />
                <p className="text-sm font-extrabold text-ink">Ações Rápidas</p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => lookupMutation.mutate()}
                  disabled={lookupMutation.isPending || !docValue}
                >
                  {lookupMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Buscar CNPJ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => fiscalAiMutation.mutate()}
                  disabled={fiscalAiMutation.isPending}
                >
                  {fiscalAiMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                  Validar Fiscal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => sintegraMutation.mutate()}
                  disabled={sintegraMutation.isPending || !form.cnpj}
                >
                  {sintegraMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                  Validar Sintegra
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => enderecoMutation.mutate()}
                  disabled={enderecoMutation.isPending || !form.cep}
                >
                  {enderecoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
                  Completar Endereço
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => recalcularMutation.mutate()}
                  disabled={recalcularMutation.isPending}
                >
                  {recalcularMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Recalcular Score
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => { setActiveTab("fiscalai"); fiscalAiMutation.mutate(); }}
                  disabled={fiscalAiMutation.isPending}
                >
                  {fiscalAiMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Gerar FiscalAI
                </Button>
                <Button
                  variant="lime"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
              </div>
            </Card>
            )}
          </aside>
        </div>
      )}

      {hasLookup && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {isReadOnly ? (
              <>
                <Button variant="outline" onClick={() => router.push(`/clients/${clientId}?edit=1`)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button variant="ghost" onClick={() => setActiveTab("historico")}>
                  <History className="h-4 w-4" /> Ver Histórico
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="lime"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    saveMutation.mutate();
                  }}
                  disabled={saveMutation.isPending}
                >
                  <FileText className="h-4 w-4" /> Salvar e Emitir NF-e
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    saveMutation.mutate();
                  }}
                  disabled={saveMutation.isPending}
                >
                  <Link2 className="h-4 w-4" /> Salvar e Emitir NFS-e
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      historicoJson: addHistorico(f.historicoJson ?? null, [
                        { quem: "Usuário", campo: "Contador", valorAnterior: null, valorNovo: "Enviado ao contador", origem: "USUARIO" },
                      ]),
                    }));
                    notify({ title: "Dados enviados ao contador", tone: "success" });
                  }}
                >
                  <Send className="h-4 w-4" /> Enviar ao Contador
                </Button>
                <Button variant="ghost" onClick={() => setActiveTab("historico")}>
                  <History className="h-4 w-4" /> Ver Histórico
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
