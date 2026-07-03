"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Package,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Save,
  Zap,
  ArrowLeft,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  History,
  Pencil,
  Weight,
  DollarSign,
  TruckIcon,
  Calculator,
  Building2,
  FileText,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { notify } from "@/components/toast-viewport";
import { cn } from "@/lib/utils";
import {
  createProduct,
  updateProduct,
  getProduct,
  lookupNcm,
  getNextCode,
  analyzeNcm,
  simulateFiscal,
} from "@/lib/services/product-service";
import { searchCfops } from "@/lib/services/cfop-service";
import type { PartialProduct, HistoricoProduto, Cfop, NcmAnalysisResult, FiscalSimulationResultV2 } from "@/lib/product-types";
import {
  ORIGEM_MERCADORIA,
  TIPO_ITEM,
  CST_ICMS_LUCRO_PRESUMIDO,
  CSOSN_SIMPLES,
} from "@/lib/product-types";

interface IntelligentProductViewProps {
  productId?: string;
  viewMode?: "create" | "view" | "edit";
  onBack?: () => void;
}

function addHistorico(
  existing: HistoricoProduto[] | null,
  entries: Omit<HistoricoProduto, "data">[],
): HistoricoProduto[] {
  const now = new Date().toISOString();
  return [...(existing ?? []), ...entries.map((e) => ({ ...e, data: now }))];
}

const GROUP_OPTIONS = [
  "Tributado integralmente",
  "Tributado com ST",
  "Tributado monofásico",
  "Isento/Pendente",
  "Serviço",
];

const TAB_ITEMS = [
  { value: "cadastro", label: "Cadastro", Icon: Package },
  { value: "fiscal", label: "Fiscal", Icon: Shield },
  { value: "estoque", label: "Estoque", Icon: TruckIcon },
  { value: "precos", label: "Preços", Icon: DollarSign },
  { value: "fiscalai", label: "FiscalAI", Icon: Zap },
  { value: "historico", label: "Histórico", Icon: History },
];

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const SIM_STEPS = [
  "NCM", "CEST", "Origem", "GTIN", "ICMS", "IBS", "CBS", "CFOP", "CST", "CSOSN", "Base Legal", "Regras SEFAZ", "Reforma Tributária",
];

const PRISMA_FIELDS_SAFE = new Set([
  "name", "code", "barcode", "brand", "unit", "weight", "length", "width", "height",
  "ncm", "ncmDescription", "cest", "exTipi", "origemMercadoria", "anp", "tipoItem",
  "grupoTributario", "cstCsosnPadrao", "cfopPreferencial", "icmsPadrao", "icmsStPadrao",
  "mvaPadrao", "ipiPadrao", "pisPadrao", "cofinsPadrao", "issPadrao",
  "beneficioFiscalCod", "beneficioRedBase", "beneficioDiferimento", "beneficioIsencao",
  "obsFiscal", "price", "costPrice", "stock", "stockMin", "stockMax", "active",
  "fiscalAi", "scoreProduto", "historicoJson",
]);

const PRODUCT_FORM_TO_API_MAP: Record<string, string> = {
  name: "name",
  code: "code",
  barcode: "barcode",
  brand: "brand",
  unit: "unit",
  weight: "weight",
  length: "length",
  width: "width",
  height: "height",
  ncm: "ncm",
  ncmDescription: "ncmDescription",
  cest: "cest",
  exTipi: "exTipi",
  origemMercadoria: "origemMercadoria",
  anp: "anp",
  tipoItem: "tipoItem",
  grupoTributario: "grupoTributario",
  cstCsosnPadrao: "cstCsosnPadrao",
  cfopPreferencial: "cfopPreferencial",
  icmsPadrao: "icmsPadrao",
  icmsStPadrao: "icmsStPadrao",
  mvaPadrao: "mvaPadrao",
  ipiPadrao: "ipiPadrao",
  pisPadrao: "pisPadrao",
  cofinsPadrao: "cofinsPadrao",
  issPadrao: "issPadrao",
  beneficioFiscalCod: "beneficioFiscalCod",
  beneficioRedBase: "beneficioRedBase",
  beneficioDiferimento: "beneficioDiferimento",
  beneficioIsencao: "beneficioIsencao",
  obsFiscal: "obsFiscal",
  price: "price",
  costPrice: "costPrice",
  stock: "stock",
  stockMin: "stockMin",
  stockMax: "stockMax",
  active: "active",
  fiscalAi: "fiscalAi",
  scoreProduto: "scoreProduto",
  historicoJson: "historicoJson",
};

const STRING_FIELDS_REQUIRING_DIGITS = new Set(["ncm", "cest", "barcode"]);
const NUMBER_FIELDS = new Set(["weight", "length", "width", "height", "icmsPadrao", "icmsStPadrao", "mvaPadrao", "ipiPadrao", "pisPadrao", "cofinsPadrao", "issPadrao", "beneficioRedBase", "price", "costPrice", "stock", "stockMin", "stockMax", "scoreProduto", "origemMercadoria", "tipoItem"]);
const BOOLEAN_FIELDS = new Set(["beneficioDiferimento", "beneficioIsencao", "active"]);

function mapProductFormToCreatePayload(formData: PartialProduct): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, apiKey] of Object.entries(PRODUCT_FORM_TO_API_MAP)) {
    const value = formData[formKey as keyof PartialProduct];
    if (value === undefined) continue;

    if (typeof value === "string" && value === "") {
      payload[apiKey] = null;
    } else if (STRING_FIELDS_REQUIRING_DIGITS.has(apiKey) && typeof value === "string" && value !== null) {
      payload[apiKey] = value.replace(/\D/g, "") || null;
    } else if (NUMBER_FIELDS.has(apiKey)) {
      if (value === null || value === undefined || value === "") {
        if (apiKey === "price" || apiKey === "stock") {
          payload[apiKey] = 0;
        } else {
          payload[apiKey] = null;
        }
      } else {
        const num = Number(value);
        payload[apiKey] = Number.isNaN(num) ? null : num;
      }
    } else if (BOOLEAN_FIELDS.has(apiKey)) {
      if (value === "true" || value === true) {
        payload[apiKey] = true;
      } else if (value === "false" || value === false) {
        payload[apiKey] = false;
      } else {
        payload[apiKey] = null;
      }
    } else {
      payload[apiKey] = value ?? null;
    }
  }

  if (payload.cfopPreferencial != null && typeof payload.cfopPreferencial === "string") {
    const cfop = (payload.cfopPreferencial as string).match(/^(\d{4})/);
    payload.cfopPreferencial = cfop ? cfop[1] : (payload.cfopPreferencial as string).replace(/\D/g, "") || null;
  }

  const finalPayload: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (PRISMA_FIELDS_SAFE.has(key)) {
      finalPayload[key] = val;
    }
  }

  return finalPayload;
}

const STRIP_ON_UPDATE = new Set([
  "id", "companyId", "createdAt", "updatedAt", "ownerId",
  "company", "items", "nfeItems",
  "descricaoNcm", "codigoAnp", "beneficioFiscal",
  "tributacaoPersonalizada", "aliquotas", "pendencias",
  "alertas", "dicas", "codigoInterno",
]);

function mapProductFormToUpdatePayload(formData: PartialProduct): Record<string, unknown> {
  const payload = mapProductFormToCreatePayload(formData);
  for (const key of Object.keys(payload)) {
    if (STRIP_ON_UPDATE.has(key) || !PRISMA_FIELDS_SAFE.has(key)) {
      delete payload[key];
    }
  }
  return payload;
}

function mapProductFormToPayload(formData: PartialProduct, mode: "create" | "update"): Record<string, unknown> {
  if (mode === "update") return mapProductFormToUpdatePayload(formData);
  return mapProductFormToCreatePayload(formData);
}

export function IntelligentProductView({ productId, viewMode: viewModeProp, onBack }: IntelligentProductViewProps) {
  const router = useRouter();
  const [form, setForm] = useState<PartialProduct>({ unit: "UN", active: true });
  const [activeTab, setActiveTab] = useState("cadastro");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [ncmValidating, setNcmValidating] = useState(false);
  const [ncmLookupResult, setNcmLookupResult] = useState<{ descricao: string; cestObrigatorio: boolean; st: boolean } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(["classificacao", "regras", "beneficios"]));
  const [codeReadOnly, setCodeReadOnly] = useState(true);
  const [cfopSearch, setCfopSearch] = useState("");
  const [cfopResults, setCfopResults] = useState<Cfop[]>([]);
  const [cfopDropdownOpen, setCfopDropdownOpen] = useState(false);
  const [cfopLoading, setCfopLoading] = useState(false);
  const cfopDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ncmAnalysis, setNcmAnalysis] = useState<NcmAnalysisResult | null>(null);
  const [ncmAnalysisLoading, setNcmAnalysisLoading] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simForm, setSimForm] = useState({
    ufOrigem: "",
    ufDestino: "",
    crt: "3",
    regimeTributario: "presumido",
    cnae: "",
    porte: "",
    consumidorFinal: false,
    contribuinteIcms: "sim",
    finalidade: "normal",
    tipoOperacao: "desconhecido",
    valorProduto: "",
    frete: "",
    seguro: "",
    desconto: "",
    selectedCfop: null as string | null,
  });
  const [simLoading, setSimLoading] = useState(false);
  const [simSteps, setSimSteps] = useState<string[]>([]);
  const [simProgress, setSimProgress] = useState(0);
  const [simPhase, setSimPhase] = useState<"input" | "calculating" | "result">("input");

  const [simResult, setSimResult] = useState<FiscalSimulationResultV2 | null>(null);

  const resolvedMode = viewModeProp ?? (productId ? "edit" : "create");
  const isReadOnly = resolvedMode === "view";

  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    const ncm = String(form.ncm ?? "").replace(/\D/g, "");
    if (ncm.length !== 8) {
      setNcmAnalysis(null);
      return;
    }
    let cancelled = false;
    setNcmAnalysisLoading(true);
    analyzeNcm(ncm)
      .then((result) => {
        if (cancelled) return;
        setNcmAnalysis(result);
        setForm((f) => ({
          ...f,
          ncmDescription: result.classification.descricao,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setNcmAnalysis(null);
      })
      .finally(() => {
        if (!cancelled) setNcmAnalysisLoading(false);
      });
    return () => { cancelled = true; };
  }, [form.ncm]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoadingProduct(true);
    setProductLoadError(null);
    getProduct(productId)
      .then((data) => {
        if (cancelled) return;
        setForm(data);
        if (data.cfopPreferencial) {
          setCfopSearch(data.cfopPreferencial);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProductLoadError("Não foi possível carregar os dados do produto.");
        notify({ title: "Erro ao carregar produto", tone: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoadingProduct(false);
      });
    return () => { cancelled = true; };
  }, [productId]);

  useEffect(() => {
    if (resolvedMode !== "create" || productId) return;
    let cancelled = false;
    getNextCode()
      .then((code) => {
        if (cancelled) return;
        setForm((f) => ({ ...f, code }));
      })
      .catch(() => {
        if (cancelled) return;
        setCodeReadOnly(false);
      });
    return () => { cancelled = true; };
  }, [resolvedMode, productId]);

  const handleCfopSearch = useCallback((value: string) => {
    setCfopSearch(value);
    if (cfopDebounceRef.current) clearTimeout(cfopDebounceRef.current);
    if (!value || value.length < 1) {
      setCfopResults([]);
      setCfopDropdownOpen(false);
      return;
    }
    setCfopLoading(true);
    cfopDebounceRef.current = setTimeout(() => {
      searchCfops(value, "saída")
        .then((results) => {
          setCfopResults(results);
          setCfopDropdownOpen(results.length > 0);
        })
        .catch(() => {
          setCfopResults([]);
          setCfopDropdownOpen(false);
        })
        .finally(() => setCfopLoading(false));
    }, 250);
  }, []);

  const selectCfop = useCallback((cfop: Cfop) => {
    setForm((f) => ({ ...f, cfopPreferencial: cfop.codigo }));
    setCfopSearch(`${cfop.codigo} — ${cfop.descricao}`);
    setCfopDropdownOpen(false);
  }, []);

  const handleCfopFocus = useCallback(() => {
    if (form.cfopPreferencial && !cfopSearch) {
      const found = cfopResults.find((c) => c.codigo === form.cfopPreferencial);
      if (found) {
        setCfopSearch(`${found.codigo} — ${found.descricao}`);
      } else if (form.cfopPreferencial) {
        setCfopSearch(form.cfopPreferencial);
      }
    }
  }, [form.cfopPreferencial, cfopSearch, cfopResults]);

  const handleCfopBlur = useCallback(() => {
    setTimeout(() => setCfopDropdownOpen(false), 200);
    const match = cfopSearch.match(/^(\d{4})/);
    if (match && match[1] !== form.cfopPreferencial) {
      setForm((f) => ({ ...f, cfopPreferencial: match[1] }));
    } else if (!cfopSearch) {
      setForm((f) => ({ ...f, cfopPreferencial: null }));
    }
  }, [cfopSearch, form.cfopPreferencial]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const mode = productId ? "update" : "create";
      const payload = mapProductFormToPayload(formRef.current, mode);
      payload.historicoJson = addHistorico(formRef.current.historicoJson ?? null, [
        { quem: "Usuário", campo: "Produto", valorAnterior: null, valorNovo: productId ? "Atualizado" : "Criado", origem: "USUARIO" },
      ]);
      if (productId) return updateProduct(productId, payload);
      return createProduct(payload);
    },
    onSuccess: () => {
      notify({ title: productId ? "Produto atualizado" : "Produto criado", tone: "success" });
      setTimeout(() => {
        router.push("/products");
        router.refresh();
      }, 600);
    },
    onError: () => {
      notify({ title: "Erro ao salvar produto", tone: "error" });
    },
  });

  const ncmMutation = useMutation({
    mutationFn: (ncm: string) => lookupNcm(ncm),
    onSuccess: (result) => {
      setNcmLookupResult(result);
      setForm((f) => ({
        ...f,
        ncmDescription: result.descricao,
      }));
      notify({ title: "NCM validado", tone: "success" });
    },
    onError: () => {
      notify({ title: "NCM não encontrado ou inválido", tone: "error" });
    },
  });

  const onChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (isReadOnly) return;
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value === "" ? null : value }));
  }, [isReadOnly]);

  const onNumberChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value === "" ? null : Number(value) }));
  }, [isReadOnly]);

  const onSelectNumberChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isReadOnly) return;
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value === "" ? null : Number(value) }));
  }, [isReadOnly]);

  const onCheckChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    setForm((f) => ({ ...f, [field]: e.target.checked }));
  }, [isReadOnly]);

  const handleNcmLookup = useCallback(async () => {
    const ncm = String(form.ncm ?? "").replace(/\D/g, "");
    if (ncm.length !== 8) {
      notify({ title: "NCM deve ter 8 dígitos", tone: "error" });
      return;
    }
    setNcmValidating(true);
    try {
      await ncmMutation.mutateAsync(ncm);
    } finally {
      setNcmValidating(false);
    }
  }, [form.ncm, ncmMutation]);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fieldGroup = (id: string, title: string, children: React.ReactNode) => (
    <Card className="p-5 space-y-4">
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => toggleCard(id)}
      >
        <h3 className="text-sm font-extrabold text-ink">{title}</h3>
        {expandedCards.has(id) ? <ChevronUp className="h-4 w-4 text-subtle" /> : <ChevronDown className="h-4 w-4 text-subtle" />}
      </button>
      {expandedCards.has(id) && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>}
    </Card>
  );

  const scoreProduto = form.scoreProduto;

  const calculateFiscalScore = useCallback(() => {
    let score = 0;
    const ncm = String(form.ncm ?? "").replace(/\D/g, "");
    if (ncm.length === 8 && ncmAnalysis?.valid) score += 30;
    if (form.cest || !ncmAnalysis?.classification.cestObrigatorio) score += 15;
    if (form.origemMercadoria != null) score += 15;
    if (form.cfopPreferencial) score += 10;
    const hasConflicts = ncmAnalysis?.alerts.some((a) => a.type === "error") ?? false;
    if (!hasConflicts) score += 15;
    score += 15;
    return Math.min(score, 100);
  }, [form.ncm, form.cest, form.origemMercadoria, form.cfopPreferencial, ncmAnalysis]);

  const canGenerateCfops =
    !!form.ncm &&
    !!simForm.ufOrigem &&
    !!simForm.ufDestino &&
    !!simForm.crt &&
    !!simForm.regimeTributario &&
    !!simForm.tipoOperacao &&
    Number(simForm.valorProduto) > 0;

  const canCalculateWithCfop =
    canGenerateCfops && !!simForm.selectedCfop;

  const handleGenerateCfopsAndSimulate = useCallback(() => {
    setSimPhase("calculating");
    setSimSteps([]);
    setSimProgress(0);
    setSimResult(null);
    setSimLoading(true);

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < SIM_STEPS.length) {
        setSimSteps((prev) => [...prev, SIM_STEPS[stepIndex]]);
        setSimProgress(Math.round(((stepIndex + 1) / SIM_STEPS.length) * 100));
        stepIndex++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    simulateFiscal({
      ncm: String(form.ncm).replace(/\D/g, ""),
      ufOrigem: simForm.ufOrigem,
      ufDestino: simForm.ufDestino,
      crt: simForm.crt || "3",
      regime: simForm.regimeTributario || "presumido",
      tipoOperacao: simForm.tipoOperacao || "desconhecido",
      consumidorFinal: simForm.consumidorFinal,
      contribuinteIcms: simForm.contribuinteIcms !== "nao",
      finalidade: simForm.finalidade || "normal",
      valorProduto: Number(simForm.valorProduto) || 0,
      frete: Number(simForm.frete) || 0,
      seguro: Number(simForm.seguro) || 0,
      desconto: Number(simForm.desconto) || 0,
      selectedCfop: simForm.selectedCfop || undefined,
    })
      .then((result) => {
        const options = result.cfop?.options ?? [];
        if (!simForm.selectedCfop && options.length > 0) {
          const recommended = options.find((o) => o.recomendado) ?? options[0];
          setSimForm((f) => ({ ...f, selectedCfop: recommended.codigo }));
          simulateFiscal({
            ncm: String(form.ncm).replace(/\D/g, ""),
            ufOrigem: simForm.ufOrigem,
            ufDestino: simForm.ufDestino,
            crt: simForm.crt || "3",
            regime: simForm.regimeTributario || "presumido",
            tipoOperacao: simForm.tipoOperacao || "desconhecido",
            consumidorFinal: simForm.consumidorFinal,
            contribuinteIcms: simForm.contribuinteIcms !== "nao",
            finalidade: simForm.finalidade || "normal",
            valorProduto: Number(simForm.valorProduto) || 0,
            frete: Number(simForm.frete) || 0,
            seguro: Number(simForm.seguro) || 0,
            desconto: Number(simForm.desconto) || 0,
            selectedCfop: recommended.codigo,
          })
            .then((recalcResult) => {
              setSimResult(recalcResult);
              setSimLoading(false);
              setSimPhase("result");
            })
            .catch(() => {
              setSimResult(result);
              setSimLoading(false);
              setSimPhase("result");
            });
          return;
        }
        setSimResult(result);
        setSimLoading(false);
        setSimPhase("result");
      })
      .catch(() => {
        setSimLoading(false);
        setSimPhase("input");
        notify({ title: "Erro na simulação fiscal", tone: "error" });
      });
  }, [form.ncm, simForm]);

  const handleSimulate = useCallback(() => {
    if (!canCalculateWithCfop) {
      handleGenerateCfopsAndSimulate();
      return;
    }
    setSimPhase("calculating");
    setSimSteps([]);
    setSimProgress(0);
    setSimResult(null);
    setSimLoading(true);

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < SIM_STEPS.length) {
        setSimSteps((prev) => [...prev, SIM_STEPS[stepIndex]]);
        setSimProgress(Math.round(((stepIndex + 1) / SIM_STEPS.length) * 100));
        stepIndex++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    simulateFiscal({
      ncm: String(form.ncm).replace(/\D/g, ""),
      ufOrigem: simForm.ufOrigem,
      ufDestino: simForm.ufDestino,
      crt: simForm.crt || "3",
      regime: simForm.regimeTributario || "presumido",
      tipoOperacao: simForm.tipoOperacao || "desconhecido",
      consumidorFinal: simForm.consumidorFinal,
      contribuinteIcms: simForm.contribuinteIcms !== "nao",
      finalidade: simForm.finalidade || "normal",
      valorProduto: Number(simForm.valorProduto) || 0,
      frete: Number(simForm.frete) || 0,
      seguro: Number(simForm.seguro) || 0,
      desconto: Number(simForm.desconto) || 0,
      selectedCfop: simForm.selectedCfop || undefined,
    })
      .then((result) => {
        setSimResult(result);
        setSimLoading(false);
        setSimPhase("result");
      })
      .catch(() => {
        setSimLoading(false);
        setSimPhase("input");
        notify({ title: "Erro na simulação fiscal", tone: "error" });
      });
  }, [form.ncm, simForm, canCalculateWithCfop, handleGenerateCfopsAndSimulate]);

  if (loadingProduct) {
    return (
      <div className="space-y-4">
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-subtle" />
          <p className="text-sm text-subtle">Carregando dados do produto...</p>
        </Card>
      </div>
    );
  }

  if (productLoadError) {
    return (
      <div className="space-y-4">
        <Card className="p-12 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-red-500" />
          <p className="text-sm text-red-600">{productLoadError}</p>
          <Button variant="outline" className="mt-4" onClick={onBack ?? (() => router.push("/products"))}>Voltar para lista</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack ?? (() => router.push("/products"))} className="flex items-center gap-2 text-sm text-subtle hover:text-ink transition">
        <ArrowLeft className="h-4 w-4" /> Voltar para lista
      </button>

      <Card className="p-6 bg-lime/10 border-lime/30">
        <div className="flex items-center gap-2 mb-1">
          <Package className="h-5 w-5 text-lime-dark" />
          <h1 className="text-xl font-extrabold text-ink">
            {resolvedMode === "create" ? "Novo Produto" : resolvedMode === "view" ? form.name : "Editar Produto"}
          </h1>
          {isReadOnly && <Badge variant="outline" className="ml-2">Visualização</Badge>}
          {resolvedMode === "edit" && <Badge variant="info" className="ml-2">Edição</Badge>}
        </div>
        <p className="text-sm text-subtle">
          {resolvedMode === "create"
            ? "Cadastre o produto com classificação fiscal. A tributação final será calculada na emissão da NF-e."
            : "Configurações fiscais base do produto. Tributos são calculados automaticamente na emissão."}
        </p>
        {scoreProduto != null && (
          <div className="mt-2 flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold",
              scoreProduto >= 70 ? "text-emerald-600 bg-emerald-50" : scoreProduto >= 40 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50",
            )}>
              {scoreProduto}
            </span>
            <span className="text-xs text-subtle">Score fiscal</span>
          </div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mx-auto flex w-fit justify-center gap-2 rounded-2xl bg-white/80 p-2 shadow-sm border border-line">
          {TAB_ITEMS.map(({ value, label, Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex min-w-[100px] h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-sm font-medium text-zinc-500 transition-all duration-200 whitespace-nowrap hover:text-zinc-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-zinc-200"
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cadastro">
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <h2 className="text-base font-extrabold text-ink">Dados Cadastrais</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Código interno</label>
                  <div className="flex gap-2">
                    <Input value={form.code ?? ""} onChange={onChange("code")} disabled={isReadOnly || (codeReadOnly && resolvedMode === "create")} className="flex-1" />
                    {!isReadOnly && resolvedMode === "create" && (
                      <Button variant="ghost" size="sm" onClick={() => setCodeReadOnly(!codeReadOnly)} className="h-11 whitespace-nowrap text-xs">
                        {codeReadOnly ? "Editar manualmente" : "Automático"}
                      </Button>
                    )}
                  </div>
                </div>
                <Input label="Descrição" value={form.name ?? ""} onChange={onChange("name")} disabled={isReadOnly} />
                <Input label="Código de barras (EAN)" value={form.barcode ?? ""} onChange={onChange("barcode")} disabled={isReadOnly} />
                <Input label="Marca" value={form.brand ?? ""} onChange={onChange("brand")} disabled={isReadOnly} />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Unidade</label>
                  <select value={form.unit ?? "UN"} onChange={onChange("unit")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5 disabled:opacity-50")}>
                    <option value="UN">UN - Unidade</option>
                    <option value="PC">PC - Peça</option>
                    <option value="KG">KG - Quilograma</option>
                    <option value="L">L - Litro</option>
                    <option value="M">M - Metro</option>
                    <option value="M2">M² - Metro quadrado</option>
                    <option value="M3">M³ - Metro cúbico</option>
                    <option value="CX">CX - Caixa</option>
                    <option value="FD">FD - Fardo</option>
                    <option value="PCT">PCT - Pacote</option>
                    <option value="RL">RL - Rolo</option>
                    <option value="PAR">PAR - Par</option>
                    <option value="DZ">DZ - Dúzia</option>
                    <option value="TON">TON - Tonelada</option>
                    <option value="G">G - Grama</option>
                    <option value="ML">ML - Mililitro</option>
                    <option value="MM">MM - Milímetro</option>
                    <option value="H">H - Hora</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                <Shield className="h-4 w-4 text-ink" /> Classificação Fiscal
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">NCM</label>
                  <div className="flex gap-2">
                    <Input value={form.ncm ?? ""} onChange={onChange("ncm")} disabled={isReadOnly} placeholder="00000000" className="flex-1" />
                    {!isReadOnly && (
                      <Button variant="outline" size="sm" onClick={handleNcmLookup} disabled={ncmValidating || !form.ncm} className="h-11 whitespace-nowrap">
                        {ncmValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                        Validar
                      </Button>
                    )}
                  </div>
                  {form.ncmDescription && <p className="text-xs text-subtle">{form.ncmDescription}</p>}
                  {ncmLookupResult?.cestObrigatorio && <Badge variant="warning" className="w-fit text-xs">CEST obrigatório para este NCM</Badge>}
                  {ncmLookupResult?.st && <Badge variant="danger" className="w-fit text-xs">NCM com Substituição Tributária</Badge>}
                </div>
                <Input label="Descrição NCM" value={form.ncmDescription ?? ""} onChange={onChange("ncmDescription")} disabled={isReadOnly} className="md:col-span-2" />
                <Input label="CEST" value={form.cest ?? ""} onChange={onChange("cest")} disabled={isReadOnly} placeholder="00.000.00" />
                <Input label="EX TIPI" value={form.exTipi ?? ""} onChange={onChange("exTipi")} disabled={isReadOnly} />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Origem da Mercadoria</label>
                  <select value={form.origemMercadoria != null ? String(form.origemMercadoria) : ""} onChange={onSelectNumberChange("origemMercadoria")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5 disabled:opacity-50")}>
                    <option value="">Selecione...</option>
                    {Object.entries(ORIGEM_MERCADORIA).map(([k, v]) => (
                      <option key={k} value={k}>{k} — {v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Tipo do Item</label>
                  <select value={form.tipoItem != null ? String(form.tipoItem) : ""} onChange={onSelectNumberChange("tipoItem")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5 disabled:opacity-50")}>
                    <option value="">Selecione...</option>
                    {Object.entries(TIPO_ITEM).map(([k, v]) => (
                      <option key={k} value={k}>{k} — {v}</option>
                    ))}
                  </select>
                </div>
                <Input label="Código ANP" value={form.anp ?? ""} onChange={onChange("anp")} disabled={isReadOnly} />
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
                <Weight className="h-4 w-4 text-ink" /> Peso e Dimensões
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Input label="Peso (kg)" type="number" step="0.0001" value={form.weight ?? ""} onChange={onNumberChange("weight")} disabled={isReadOnly} />
                <Input label="Comprimento (cm)" type="number" step="0.0001" value={form.length ?? ""} onChange={onNumberChange("length")} disabled={isReadOnly} />
                <Input label="Largura (cm)" type="number" step="0.0001" value={form.width ?? ""} onChange={onNumberChange("width")} disabled={isReadOnly} />
                <Input label="Altura (cm)" type="number" step="0.0001" value={form.height ?? ""} onChange={onNumberChange("height")} disabled={isReadOnly} />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fiscal">
          <div className="space-y-4">
            {fieldGroup("regras", "Regras Fiscais Avançadas", (
              <>
                <div className="flex flex-col gap-1 relative">
                  <label className="text-sm font-medium text-ink">CFOP Preferencial</label>
                  <div className="relative">
                    <Input
                      value={isReadOnly ? (form.cfopPreferencial ?? "") : cfopSearch}
                      onChange={(e) => { if (!isReadOnly) handleCfopSearch(e.target.value); }}
                      onFocus={() => { if (!isReadOnly) handleCfopFocus(); }}
                      onBlur={() => { if (!isReadOnly) handleCfopBlur(); }}
                      disabled={isReadOnly}
                      placeholder="Pesquisar CFOP..."
                      className="w-full"
                    />
                    {cfopLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-subtle" />
                    )}
                  </div>
                  {cfopDropdownOpen && cfopResults.length > 0 && !isReadOnly && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-line bg-white shadow-lg">
                      {cfopResults.map((cfop) => (
                        <button
                          key={cfop.codigo}
                          type="button"
                          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition"
                          onClick={() => selectCfop(cfop)}
                        >
                          <span className="text-sm font-bold text-ink shrink-0">{cfop.codigo}</span>
                          <span className="text-xs text-subtle break-words">— {cfop.descricao}</span>
                          <div className="ml-auto flex shrink-0 gap-1">
                            {cfop.dentroEstado && <Badge variant="neutral" className="text-[10px] px-1 py-0">Interno</Badge>}
                            {cfop.interestadual && <Badge variant="info" className="text-[10px] px-1 py-0">Interestadual</Badge>}
                            {cfop.exterior && <Badge variant="dark" className="text-[10px] px-1 py-0">Exterior</Badge>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-subtle mt-1">
                    Opcional. Se preenchido, será sugerido automaticamente na emissão da NF-e. O FiscalAI validará se o CFOP é compatível com a operação, cliente e UF.
                  </p>
                  {form.cfopPreferencial && (
                    <Badge variant="lime" className="w-fit text-xs mt-1">CFOP preferencial: {form.cfopPreferencial}</Badge>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">CST/CSOSN Padrão</label>
                  <select value={form.cstCsosnPadrao ?? ""} onChange={onChange("cstCsosnPadrao")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5 disabled:opacity-50")}>
                    <option value="">Selecione...</option>
                    <optgroup label="CSOSN (Simples Nacional)">
                      {CSOSN_SIMPLES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </optgroup>
                    <optgroup label="CST (Lucro Presumido/Real)">
                      {CST_ICMS_LUCRO_PRESUMIDO.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Grupo Tributário</label>
                  <select value={form.grupoTributario ?? ""} onChange={onChange("grupoTributario")} disabled={isReadOnly} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5 disabled:opacity-50")}>
                    <option value="">Selecione...</option>
                    {GROUP_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <Input label="Código Benefício Fiscal" value={form.beneficioFiscalCod ?? ""} onChange={onChange("beneficioFiscalCod")} disabled={isReadOnly} />
                <Input label="Redução de Base (%)" type="number" step="0.01" value={form.beneficioRedBase ?? ""} onChange={onNumberChange("beneficioRedBase")} disabled={isReadOnly} />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Diferimento</label>
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5">
                    <input type="checkbox" checked={form.beneficioDiferimento ?? false} onChange={onCheckChange("beneficioDiferimento")} disabled={isReadOnly} className="h-4 w-4 rounded border-line accent-lime-dark" />
                    <span className="text-sm text-ink">Sim</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Isenção</label>
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5">
                    <input type="checkbox" checked={form.beneficioIsencao ?? false} onChange={onCheckChange("beneficioIsencao")} disabled={isReadOnly} className="h-4 w-4 rounded border-line accent-lime-dark" />
                    <span className="text-sm text-ink">Sim</span>
                  </div>
                </div>
                <Input label="Observação Fiscal" value={form.obsFiscal ?? ""} onChange={onChange("obsFiscal")} disabled={isReadOnly} className="md:col-span-2" />
              </>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="estoque">
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-extrabold text-ink">Estoque</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Input label="Estoque atual" type="number" value={form.stock ?? 0} onChange={onNumberChange("stock")} disabled={isReadOnly} />
              <Input label="Estoque mínimo" type="number" value={form.stockMin ?? ""} onChange={onNumberChange("stockMin")} disabled={isReadOnly} />
              <Input label="Estoque máximo" type="number" value={form.stockMax ?? ""} onChange={onNumberChange("stockMax")} disabled={isReadOnly} />
            </div>
            {form.stockMin != null && form.stock != null && form.stock <= (form.stockMin ?? 0) && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Estoque abaixo do mínimo</span>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="precos">
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-extrabold text-ink">Preços</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input label="Preço de venda" type="number" step="0.01" value={form.price ?? ""} onChange={onNumberChange("price")} disabled={isReadOnly} />
              <Input label="Preço de custo" type="number" step="0.01" value={form.costPrice ?? ""} onChange={onNumberChange("costPrice")} disabled={isReadOnly} />
              {form.price != null && form.costPrice != null && Number(form.costPrice) > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Margem</label>
                  <div className="flex h-11 items-center rounded-xl border border-line bg-white px-3.5">
                    <span className={cn("text-sm font-bold", ((Number(form.price) - Number(form.costPrice)) / Number(form.costPrice) * 100) >= 30 ? "text-emerald-600" : "text-amber-600")}>
                      {(((Number(form.price) - Number(form.costPrice)) / Number(form.costPrice)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="fiscalai">
          {!form.ncm && !ncmAnalysis && !ncmAnalysisLoading ? (
            <Card className="p-16 text-center border border-line">
              <div className="relative mx-auto mb-6 h-24 w-24 flex items-center justify-center rounded-full bg-lime/10">
                <Zap className="h-10 w-10 text-lime-dark" />
                <div className="absolute inset-0 rounded-full bg-lime/5 animate-pulse" />
              </div>
              <h2 className="text-xl font-extrabold text-ink mb-2">Preencha o NCM para ativar a análise FiscalAI</h2>
              <p className="text-sm text-subtle max-w-md mx-auto">
                O motor de inteligência tributária analisa automaticamente o NCM para classificar tributos, gerar recomendações e simular cenários fiscais.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 lg:w-3/4 space-y-6">
                {ncmAnalysisLoading && (
                  <Card className="p-8 text-center">
                    <Loader2 className="h-6 w-6 mx-auto mb-3 animate-spin text-lime-dark" />
                    <p className="text-sm text-subtle">Analisando NCM...</p>
                  </Card>
                )}

                {form.ncm && !ncmAnalysis && !ncmAnalysisLoading && (
                  <Card className="p-8 text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                    <p className="text-sm text-amber-600">NCM inválido ou não encontrado. Informe um NCM com 8 dígitos.</p>
                  </Card>
                )}

                {ncmAnalysis && (
                  <>
                    <Card className="p-5">
                      <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-4">
                        <FileText className="h-4 w-4" /> Classificação Fiscal
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">NCM</p>
                          <p className="text-sm text-ink font-bold">{ncmAnalysis.classification.ncm}</p>
                        </div>
                        <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
                          <p className="text-xs font-medium text-subtle">Descrição</p>
                          <p className="text-sm text-ink font-bold">{ncmAnalysis.classification.descricao}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Capítulo</p>
                          <p className="text-sm text-ink font-bold">{ncmAnalysis.classification.capitulo}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Desc. Capítulo</p>
                          <p className="text-sm text-ink">{ncmAnalysis.classification.capituloDescricao}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Posição</p>
                          <p className="text-sm text-ink font-bold">{ncmAnalysis.classification.posicao}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Subposição</p>
                          <p className="text-sm text-ink font-bold">{ncmAnalysis.classification.subposicao}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">CEST</p>
                          <p className="text-sm text-ink font-bold">{ncmAnalysis.classification.cestObrigatorio ? "Obrigatório" : "Não obrigatório"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">EX TIPI</p>
                          <p className="text-sm text-ink font-bold">{ncmAnalysis.classification.exTipi ? "Aplicável" : "Não"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Origem</p>
                          <p className="text-sm text-ink font-bold">{form.origemMercadoria != null ? `${form.origemMercadoria} — ${ORIGEM_MERCADORIA[form.origemMercadoria] ?? ""}` : "Não definida"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">GTIN</p>
                          <p className="text-sm text-ink">{form.barcode ? String(form.barcode) : "Sem validação"}</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-5">
                      <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-4">
                        <Shield className="h-4 w-4" /> Incidências Tributárias
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ncmAnalysis.incidences).map(([key, value]) => {
                          const label = {
                            icms: "ICMS",
                            icmsSt: "ICMS ST",
                            pis: "PIS",
                            cofins: "COFINS",
                            ipi: "IPI",
                            fcp: "FCP",
                            difal: "DIFAL",
                          }[key] ?? key;
                          const dotColor = value === "Pode Incidir" ? "bg-amber-400" :
                            value === "Monofásico" ? "bg-blue-400" :
                            value === "Depende da Operação" ? "bg-violet-400" :
                            "bg-gray-300";
                          return (
                            <div key={key} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5">
                              <span className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />
                              <span className="text-xs font-bold text-ink">{label}</span>
                              <span className="text-xs text-subtle">{value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    <Card className="p-5">
                      <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-4">
                        <Building2 className="h-4 w-4" /> Regras que Influenciam
                      </h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        {ncmAnalysis.rules.map((rule, i) => (
                          <div key={i} className="space-y-0.5">
                            <p className="text-xs font-medium text-subtle">{rule.label}</p>
                            <p className="text-sm text-ink font-bold">{rule.value}</p>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-5 bg-blue-50/50 border-blue-100">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-extrabold text-ink">Reforma Tributária (IBS/CBS)</h3>
                        <Badge variant="info" className="text-[10px]">NT 2025.002</Badge>
                      </div>
                      <p className="text-xs text-subtle mb-4">Estrutura preparada conforme Nota Técnica 2025.002</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">IBS</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">CBS</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Imposto Seletivo</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Split Payment</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Crédito Financeiro</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Transição</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Alíquota IBS</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Alíquota CBS</p>
                          <p className="text-sm text-ink">Calculado na emissão</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-5 bg-lime/5 border-lime/30">
                      <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-lime-dark" /> Recomendações FiscalAI
                      </h3>
                      <div className="space-y-2">
                        {ncmAnalysis.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-ink">
                            {rec.icon === "check" && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />}
                            {rec.icon === "warning" && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />}
                            {rec.icon === "info" && <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />}
                            <span>{rec.message}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </>
                )}

                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Simulador de Tributação
                      </h3>
                      <p className="text-xs text-subtle mt-1">
                        Informe os dados da operação para simular a tributação. O resultado é estimativo.
                      </p>
                    </div>
                    <Button
                      variant="lime"
                      size="lg"
                      disabled={!form.ncm || String(form.ncm).replace(/\D/g, "").length !== 8}
                      onClick={() => { setSimPhase("input"); setSimulationOpen(true); }}
                    >
                      <Calculator className="h-4 w-4" /> Simular Tributação
                    </Button>
                  </div>
                </Card>

                {fieldGroup("tributos", "Alíquotas Manuais (Substituem FiscalAI)", (
                  <>
                    <Input label="ICMS padrão (%)" type="number" step="0.01" value={form.icmsPadrao ?? ""} onChange={onNumberChange("icmsPadrao")} disabled={isReadOnly} />
                    <Input label="ICMS ST padrão (%)" type="number" step="0.01" value={form.icmsStPadrao ?? ""} onChange={onNumberChange("icmsStPadrao")} disabled={isReadOnly} />
                    <Input label="MVA padrão (%)" type="number" step="0.01" value={form.mvaPadrao ?? ""} onChange={onNumberChange("mvaPadrao")} disabled={isReadOnly} />
                    <Input label="IPI padrão (%)" type="number" step="0.01" value={form.ipiPadrao ?? ""} onChange={onNumberChange("ipiPadrao")} disabled={isReadOnly} />
                    <Input label="PIS padrão (%)" type="number" step="0.01" value={form.pisPadrao ?? ""} onChange={onNumberChange("pisPadrao")} disabled={isReadOnly} />
                    <Input label="COFINS padrão (%)" type="number" step="0.01" value={form.cofinsPadrao ?? ""} onChange={onNumberChange("cofinsPadrao")} disabled={isReadOnly} />
                    <Input label="ISS padrão (%)" type="number" step="0.01" value={form.issPadrao ?? ""} onChange={onNumberChange("issPadrao")} disabled={isReadOnly} />
                  </>
                ))}
              </div>

              <div className="hidden lg:flex lg:w-1/4 flex-col gap-6">
                <Card className="p-5">
                  <h3 className="text-sm font-extrabold text-ink mb-4">Score Fiscal</h3>
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-4 border-lime/40">
                      <span className={cn(
                        "text-3xl font-extrabold",
                        calculateFiscalScore() >= 70 ? "text-emerald-600" : calculateFiscalScore() >= 40 ? "text-amber-600" : "text-red-600",
                      )}>
                        {calculateFiscalScore()}
                      </span>
                    </div>
                    <p className="text-xs text-subtle font-medium">{calculateFiscalScore()} / 100</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      { label: "Produto Classificado", ok: ncmAnalysis?.valid ?? false },
                      { label: "Tributação Validada", ok: !!ncmAnalysis },
                      { label: "NCM OK", ok: !!form.ncm && (ncmAnalysis?.valid ?? false) },
                      { label: "CFOP Compatível", ok: !!form.cfopPreferencial },
                      { label: "Sem inconsistências", ok: !(ncmAnalysis?.alerts.some((a) => a.type === "error") ?? false) },
                      { label: "Baixo risco fiscal", ok: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        {item.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                        <span className={cn("text-xs", item.ok ? "text-ink" : "text-subtle")}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-sm font-extrabold text-ink mb-3">Base Legal</h3>
                  <div className="space-y-2">
                    {["Convênio ICMS", "Ajuste SINIEF", "TIPI", "Tabela NCM", "Lei Complementar 155/16", "Reforma Tributária (LC 214/2025)"].map((base) => (
                      <div key={base} className="flex items-center gap-2 text-xs text-ink">
                        <FileText className="h-3.5 w-3.5 text-subtle shrink-0" />
                        <span>{base}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge variant="info" className="text-[10px]">NT 2025.002</Badge>
                    <Badge variant="info" className="text-[10px]">NT 2026.001</Badge>
                  </div>
                </Card>

                {ncmAnalysis && ncmAnalysis.alerts.length > 0 && (
                  <Card className="p-5">
                    <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas
                    </h3>
                    <div className="space-y-2">
                      {ncmAnalysis.alerts.map((alert, i) => (
                        <div key={i} className={cn(
                          "rounded-lg border-l-4 p-2.5 text-xs",
                          alert.type === "warning" ? "border-l-amber-400 bg-amber-50 text-amber-700" :
                          alert.type === "error" ? "border-l-red-400 bg-red-50 text-red-700" :
                          "border-l-blue-400 bg-blue-50 text-blue-700",
                        )}>
                          {alert.message}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          <Dialog open={simulationOpen} onOpenChange={setSimulationOpen}>
            <DialogContent className="min-w-[1180px] max-w-[95vw] max-h-[92vh] flex flex-col overflow-hidden p-0">
              <div className="flex items-center gap-3 border-b border-line px-6 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime/20">
                  <Zap className="h-4.5 w-4.5 text-lime-dark" />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold text-ink">FiscalAI — Simulação Tributária Inteligente</DialogTitle>
                  <DialogDescription className="text-xs text-subtle">Motor de inteligência tributária da Doxnira Fiscal</DialogDescription>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {simPhase === "input" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-sm font-extrabold text-ink flex items-center gap-2">
                          <Package className="h-4 w-4" /> Produto
                        </h4>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">NCM</p>
                          <p className="text-sm text-ink font-bold">{form.ncm ?? "—"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Descrição NCM</p>
                          <p className="text-sm text-ink">{ncmAnalysis?.classification.descricao ?? "—"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">CEST</p>
                          <p className="text-sm text-ink">{form.cest ?? "Não aplicável"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">GTIN</p>
                          <p className="text-sm text-ink">{form.barcode ? String(form.barcode) : "Sem validação"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-subtle">Origem</p>
                          <p className="text-sm text-ink">{form.origemMercadoria != null ? `${form.origemMercadoria} — ${ORIGEM_MERCADORIA[form.origemMercadoria] ?? ""}` : "Não definida"}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">Tipo de Operação</label>
                          <select value={simForm.tipoOperacao} onChange={(e) => setSimForm((f) => ({ ...f, tipoOperacao: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="desconhecido">Não informado</option>
                            <option value="producao_propria">Produção própria</option>
                            <option value="revenda">Revenda</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-extrabold text-ink flex items-center gap-2">
                          <Building2 className="h-4 w-4" /> Empresa
                        </h4>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">UF Origem</label>
                          <select value={simForm.ufOrigem} onChange={(e) => setSimForm((f) => ({ ...f, ufOrigem: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="">Selecione...</option>
                            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">CRT</label>
                          <select value={simForm.crt} onChange={(e) => setSimForm((f) => ({ ...f, crt: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="">Selecione...</option>
                            <option value="1">1 — Simples Nacional</option>
                            <option value="2">2 — Simples Nacional excesso</option>
                            <option value="3">3 — Regime Normal</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">Regime Tributário</label>
                          <select value={simForm.regimeTributario} onChange={(e) => setSimForm((f) => ({ ...f, regimeTributario: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="">Selecione...</option>
                            <option value="simples">Simples Nacional</option>
                            <option value="presumido">Lucro Presumido</option>
                            <option value="real">Lucro Real</option>
                          </select>
                        </div>
                        <Input label="CNAE Principal" value={simForm.cnae} onChange={(e) => setSimForm((f) => ({ ...f, cnae: e.target.value }))} />
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">Porte</label>
                          <select value={simForm.porte} onChange={(e) => setSimForm((f) => ({ ...f, porte: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="">Selecione...</option>
                            <option value="micro">Micro</option>
                            <option value="pequeno">Pequeno</option>
                            <option value="medio">Médio</option>
                            <option value="grande">Grande</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-extrabold text-ink flex items-center gap-2">
                          <TruckIcon className="h-4 w-4" /> Operação
                        </h4>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">UF Destino</label>
                          <select value={simForm.ufDestino} onChange={(e) => setSimForm((f) => ({ ...f, ufDestino: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="">Selecione...</option>
                            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">Consumidor Final</label>
                          <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5">
                            <input type="checkbox" checked={simForm.consumidorFinal} onChange={(e) => setSimForm((f) => ({ ...f, consumidorFinal: e.target.checked }))} className="h-4 w-4 rounded border-line accent-lime-dark" />
                            <span className="text-sm text-ink">Sim</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">Contribuinte ICMS</label>
                          <select value={simForm.contribuinteIcms} onChange={(e) => setSimForm((f) => ({ ...f, contribuinteIcms: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="">Selecione...</option>
                            <option value="sim">Sim</option>
                            <option value="nao">Não</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-subtle">Finalidade</label>
                          <select value={simForm.finalidade} onChange={(e) => setSimForm((f) => ({ ...f, finalidade: e.target.value }))} className={cn("flex h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/5")}>
                            <option value="">Selecione...</option>
                            <option value="normal">Normal</option>
                            <option value="complementar">Complementar</option>
                            <option value="ajuste">Ajuste</option>
                            <option value="devolucao">Devolução</option>
                          </select>
                        </div>
                        <Input label="Valor do Produto (R$)" type="number" step="0.01" value={simForm.valorProduto} onChange={(e) => setSimForm((f) => ({ ...f, valorProduto: e.target.value }))} />
                        <Input label="Frete (R$)" type="number" step="0.01" value={simForm.frete} onChange={(e) => setSimForm((f) => ({ ...f, frete: e.target.value }))} />
                        <Input label="Seguro (R$)" type="number" step="0.01" value={simForm.seguro} onChange={(e) => setSimForm((f) => ({ ...f, seguro: e.target.value }))} />
                        <Input label="Desconto (R$)" type="number" step="0.01" value={simForm.desconto} onChange={(e) => setSimForm((f) => ({ ...f, desconto: e.target.value }))} />
                      </div>
                    </div>

                    <Button
                      variant="lime"
                      size="lg"
                      className="w-full h-14 text-base"
                      disabled={simLoading || !canGenerateCfops}
                      onClick={handleGenerateCfopsAndSimulate}
                    >
                      <Calculator className="h-5 w-5" /> {simForm.selectedCfop ? `CALCULAR COM CFOP ${simForm.selectedCfop}` : "GERAR CFOPS E SIMULAR"}
                    </Button>
                  </div>
                )}

                {simPhase === "calculating" && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-8">
                    <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-lime/10">
                      <Zap className="h-8 w-8 text-lime-dark animate-pulse" />
                    </div>
                    <div className="w-full max-w-md space-y-4">
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-lime-dark transition-all duration-300" style={{ width: `${simProgress}%` }} />
                      </div>
                      <p className="text-center text-sm font-bold text-ink">{simProgress}%</p>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                      {SIM_STEPS.map((step) => (
                        <div key={step} className={cn(
                          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                          simSteps.includes(step) ? "bg-lime/10 text-lime-dark" : "bg-muted text-subtle",
                        )}>
                          {simSteps.includes(step) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <div className="h-3.5 w-3.5 rounded-full bg-line" />}
                          <span>✓ {step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {simPhase === "result" && simResult && (
                  <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-1 min-w-0 space-y-6">

                        <Card className="p-5">
                          <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-4">
                            <FileText className="h-4 w-4" /> CFOPs Compatíveis
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {simResult.cfop.options.map((cfop) => (
                              <button
                                key={cfop.codigo}
                                type="button"
                                onClick={() => {
                                  setSimForm((f) => ({ ...f, selectedCfop: cfop.codigo }));
                                }}
                                className={cn(
                                  "rounded-xl border p-4 text-left transition-all",
                                  simForm.selectedCfop === cfop.codigo
                                    ? "border-lime bg-lime/10 ring-2 ring-lime/40"
                                    : cfop.recomendado
                                      ? "border-lime/50 bg-lime/5 hover:bg-lime/10"
                                      : "border-line bg-white hover:bg-muted/50",
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-ink">{cfop.codigo}</span>
                                  {cfop.recomendado && <Badge variant="lime" className="text-[10px]">Recomendado</Badge>}
                                  {simForm.selectedCfop === cfop.codigo && <Badge variant="success" className="text-[10px]">Selecionado</Badge>}
                                </div>
                                <p className="text-xs text-ink">{cfop.descricao}</p>
                                <p className="text-xs text-subtle">{cfop.aplicacao}</p>
                              </button>
                            ))}
                          </div>
                        </Card>

                        <Card className="p-5">
                          <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-4">
                            <Shield className="h-4 w-4" /> ICMS
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-subtle">{simResult.cstCsosn.tipo}</p>
                              <p className="text-sm text-ink font-bold">{simResult.cstCsosn.codigo} — {simResult.cstCsosn.descricao}</p>
                              <p className="text-[10px] text-subtle">{simResult.cstCsosn.fonte}</p>
                            </div>
                            {simResult.taxes.icms && (
                              <>
                                <div className="space-y-0.5">
                                  <p className="text-xs font-medium text-subtle">ICMS</p>
                                  <p className="text-sm text-ink font-bold">
                                    {simResult.taxes.icms.status === "CALCULATED" && simResult.taxes.icms.rate != null
                                      ? `${(simResult.taxes.icms.rate * 100).toFixed(2)}% — R$ ${simResult.taxes.icms.value}`
                                      : simResult.taxes.icms.status === "ZERO_BY_REGIME"
                                        ? "R$ 0,00 (Simples Nacional)"
                                        : simResult.taxes.icms.status === "NOT_APPLICABLE"
                                          ? "Não se aplica"
                                          : simResult.taxes.icms.explanation || "Pendente"}
                                  </p>
                                  {simResult.taxes.icms.source && simResult.taxes.icms.source !== "pending" && (
                                    <p className="text-[10px] text-subtle">{simResult.taxes.icms.source}</p>
                                  )}
                                  {simResult.taxes.icms.rule && (
                                    <p className="text-[10px] text-subtle">{simResult.taxes.icms.rule}</p>
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-xs font-medium text-subtle">Base de Cálculo</p>
                                  <p className="text-sm text-ink font-bold">R$ {(simResult.taxes.icms.base ?? 0).toFixed(2)}</p>
                                </div>
                              </>
                            )}
                            {simResult.taxes.difal && simResult.taxes.difal.status !== "NOT_APPLICABLE" && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">DIFAL</p>
                                <p className="text-sm text-amber-600 font-bold">
                                  {simResult.taxes.difal.status === "CALCULATED" && simResult.taxes.difal.value != null
                                    ? `R$ ${simResult.taxes.difal.value}`
                                    : simResult.taxes.difal.explanation}
                                </p>
                              </div>
                            )}
                            {simResult.taxes.fcp && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">FCP</p>
                                <p className="text-sm text-ink font-bold">
                                  {simResult.taxes.fcp.status === "CALCULATED" && simResult.taxes.fcp.rate != null
                                    ? `${(simResult.taxes.fcp.rate * 100).toFixed(2)}% — R$ ${simResult.taxes.fcp.value}`
                                    : simResult.taxes.fcp.status === "NOT_APPLICABLE"
                                      ? "Não se aplica"
                                      : simResult.taxes.fcp.explanation}
                                </p>
                              </div>
                            )}
                            {simResult.taxes.icmsSt && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">ICMS ST</p>
                                <p className={cn(
                                  "text-sm font-bold",
                                  simResult.taxes.icmsSt.status === "CALCULATED" ? "text-amber-600" :
                                  simResult.taxes.icmsSt.status === "PENDING_RULE" ? "text-subtle" : "text-ink",
                                )}>
                                  {simResult.taxes.icmsSt.status === "CALCULATED" && simResult.taxes.icmsSt.value != null
                                    ? `R$ ${simResult.taxes.icmsSt.value}`
                                    : simResult.taxes.icmsSt.status === "PENDING_RULE"
                                      ? "Pendente"
                                      : "Não se aplica"}
                                </p>
                                {simResult.taxes.icmsSt.explanation && (
                                  <p className="text-[10px] text-subtle">{simResult.taxes.icmsSt.explanation}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>

                        <Card className="p-5">
                          <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-4">
                            <DollarSign className="h-4 w-4" /> PIS / COFINS / IPI
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                            {simResult.taxes.pis && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">PIS</p>
                                <p className="text-sm text-ink font-bold">
                                  {simResult.taxes.pis.status === "CALCULATED" && simResult.taxes.pis.rate != null
                                    ? `${(simResult.taxes.pis.rate * 100).toFixed(2)}% — R$ ${simResult.taxes.pis.value}`
                                    : simResult.taxes.pis.status === "ZERO_BY_REGIME"
                                      ? "R$ 0,00 (Simples Nacional)"
                                      : simResult.taxes.pis.explanation ?? "—"}
                                </p>
                                {simResult.taxes.pis.source && simResult.taxes.pis.source !== "pending" && (
                                  <p className="text-[10px] text-subtle">{simResult.taxes.pis.source}</p>
                                )}
                              </div>
                            )}
                            {simResult.taxes.cofins && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">COFINS</p>
                                <p className="text-sm text-ink font-bold">
                                  {simResult.taxes.cofins.status === "CALCULATED" && simResult.taxes.cofins.rate != null
                                    ? `${(simResult.taxes.cofins.rate * 100).toFixed(2)}% — R$ ${simResult.taxes.cofins.value}`
                                    : simResult.taxes.cofins.status === "ZERO_BY_REGIME"
                                      ? "R$ 0,00 (Simples Nacional)"
                                      : simResult.taxes.cofins.explanation ?? "—"}
                                </p>
                                {simResult.taxes.cofins.source && simResult.taxes.cofins.source !== "pending" && (
                                  <p className="text-[10px] text-subtle">{simResult.taxes.cofins.source}</p>
                                )}
                              </div>
                            )}
                            {simResult.taxes.ipi && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">IPI</p>
                                <p className="text-sm text-ink font-bold">
                                  {simResult.taxes.ipi.status === "CALCULATED" && simResult.taxes.ipi.rate != null
                                    ? `${(simResult.taxes.ipi.rate * 100).toFixed(2)}% — R$ ${simResult.taxes.ipi.value}`
                                    : simResult.taxes.ipi.explanation ?? "—"}
                                </p>
                                {simResult.taxes.ipi.source && simResult.taxes.ipi.source !== "pending" && (
                                  <p className="text-[10px] text-subtle">{simResult.taxes.ipi.source}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>

                        <Card className="p-5 bg-blue-50/50 border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-extrabold text-ink">Reforma Tributária (IBS/CBS/IS)</h3>
                            <Badge variant="info" className="text-[10px]">NT 2025.002</Badge>
                          </div>
                          <p className="text-xs text-subtle mb-4">Tributos do novo sistema — separados da carga tributária atual</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                            {simResult.taxes.ibs && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">IBS</p>
                                <p className="text-sm text-subtle italic">{simResult.taxes.ibs.explanation || "Calculado na emissão conforme vigência"}</p>
                              </div>
                            )}
                            {simResult.taxes.cbs && (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-subtle">CBS</p>
                                <p className="text-sm text-subtle italic">{simResult.taxes.cbs.explanation || "Calculado na emissão conforme vigência"}</p>
                              </div>
                            )}
                          </div>
                        </Card>

                        {simResult.nfeRules && simResult.nfeRules.blocks.length > 0 && (
                          <Card className="p-5 bg-red-50/50 border-red-100">
                            <h3 className="text-sm font-extrabold text-red-700 flex items-center gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4" /> Bloqueios NFe
                            </h3>
                            <div className="space-y-2">
                              {simResult.nfeRules.blocks.map((block, i) => (
                                <div key={block.id ?? i} className="rounded-lg border-l-4 border-l-red-400 bg-red-50 p-2.5 text-xs text-red-700">
                                  {block.message}
                                </div>
                              ))}
                            </div>
                          </Card>
                        )}

                        {simResult.nfeRules && simResult.nfeRules.warnings.length > 0 && (
                          <Card className="p-5 bg-amber-50/50 border-amber-100">
                            <h3 className="text-sm font-extrabold text-amber-700 flex items-center gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4" /> Alertas NFe
                            </h3>
                            <div className="space-y-2">
                              {simResult.nfeRules.warnings.map((w, i) => (
                                <div key={w.id ?? i} className="rounded-lg border-l-4 border-l-amber-400 bg-amber-50 p-2.5 text-xs text-amber-700">
                                  {w.message}
                                </div>
                              ))}
                            </div>
                          </Card>
                        )}

                        <Card className="p-5">
                          <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-4">
                            <BarChart3 className="h-4 w-4" /> Resultado
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-subtle">Valor Produtos</p>
                              <p className="text-sm text-ink font-bold">R$ {simResult.totals.valorProdutos.toFixed(2)}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-subtle">Total Tributos</p>
                              <p className="text-sm text-ink font-bold">R$ {simResult.totals.totalTributos.toFixed(2)}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-subtle">% Carga Tributária</p>
                              <p className="text-sm text-ink font-bold">{simResult.totals.percentualCarga.toFixed(2)}%</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-subtle">Risco Fiscal</p>
                              <p className={cn(
                                "text-sm font-bold",
                                simResult.audit.riskLevel === "LOW" ? "text-emerald-600" :
                                simResult.audit.riskLevel === "MEDIUM" ? "text-amber-600" : "text-red-600",
                              )}>{simResult.audit.riskLabel}</p>
                            </div>
                          </div>
                          <p className="text-xs text-subtle mt-4">{simResult.audit.auditSummary}</p>
                        </Card>

                        <Card className="p-5">
                          <h3 className="text-sm font-extrabold text-ink flex items-center gap-2 mb-3">
                            <FileText className="h-4 w-4" /> Notas Técnicas
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {simResult.notasTecnicas.map((nt) => (
                              <Badge key={nt} variant="info" className="text-[10px]">{nt}</Badge>
                            ))}
                          </div>
                        </Card>
                      </div>

                      <div className="lg:w-1/4 lg:sticky lg:top-0 space-y-6">
                        <Card className="p-5">
                          <h3 className="text-sm font-extrabold text-ink mb-4">Score Fiscal</h3>
                          <div className="flex flex-col items-center gap-3">
                            <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-4 border-lime/40">
                              <span className={cn(
                                "text-3xl font-extrabold",
                                simResult.audit.score >= 70 ? "text-emerald-600" : simResult.audit.score >= 40 ? "text-amber-600" : "text-red-600",
                              )}>
                                {simResult.audit.score}
                              </span>
                            </div>
                            <p className="text-xs text-subtle font-medium">{simResult.audit.score} / 100</p>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-subtle">Risco Fiscal</span>
                              <span className={cn("font-bold", simResult.audit.riskLevel === "LOW" ? "text-emerald-600" : "text-amber-600")}>{simResult.audit.riskLabel}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-subtle">Pode emitir NF-e?</span>
                              <span className={cn("font-bold", simResult.audit.canEmitNfe ? "text-emerald-600" : "text-red-600")}>{simResult.audit.canEmitNfe ? "Sim" : "Não — bloqueios"}</span>
                            </div>
                          </div>
                          {simResult.camposPendentes.length > 0 && (
                            <div className="mt-4 border-t border-line pt-3 space-y-1">
                              <p className="text-xs font-bold text-amber-600 mb-1">Campos Pendentes</p>
                              {simResult.camposPendentes.map((campo) => (
                                <div key={campo} className="flex items-center gap-2 text-xs text-amber-600">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <span>{campo}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {simResult.audit.requireHumanConfirm && (
                            <div className="mt-3 rounded-lg border-l-4 border-l-amber-400 bg-amber-50 p-2.5 text-xs text-amber-700">
                              Confirmar manualmente: produção própria ou revenda?
                            </div>
                          )}
                          {simResult.audit.issues.length > 0 && (
                            <div className="mt-4 border-t border-line pt-3 space-y-2">
                              <p className="text-xs font-bold text-ink mb-1">Auditoria FiscalAI</p>
                              {simResult.audit.issues.map((issue, i) => (
                                <div key={issue.id ?? i} className={cn(
                                  "rounded-lg border-l-4 p-2 text-xs",
                                  issue.severity === "BLOCKED" ? "border-l-red-400 bg-red-50 text-red-700" :
                                  issue.severity === "WARNING" ? "border-l-amber-400 bg-amber-50 text-amber-700" :
                                  "border-l-blue-400 bg-blue-50 text-blue-700",
                                )}>
                                  {issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="lime"
                        size="lg"
                        className="flex-1 h-12"
                        disabled={simLoading}
                        onClick={() => handleSimulate()}
                      >
                        <Calculator className="h-4 w-4" /> Recalcular com CFOP {simForm.selectedCfop ?? ""}
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-12"
                        onClick={() => {
                          setSimPhase("input");
                          setSimForm((f) => ({ ...f, selectedCfop: null }));
                        }}
                      >
                        Refazer Simulação
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="historico">
          <Card className="overflow-hidden">
            {form.historicoJson && form.historicoJson.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-muted/50 text-xs font-bold uppercase text-subtle">
                      <th className="px-4 py-3 text-left">Quem</th>
                      <th className="px-4 py-3 text-left">Campo</th>
                      <th className="px-4 py-3 text-left">Anterior</th>
                      <th className="px-4 py-3 text-left">Novo</th>
                      <th className="px-4 py-3 text-left">Origem</th>
                      <th className="px-4 py-3 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {form.historicoJson.map((entry, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm">{entry.quem}</td>
                        <td className="px-4 py-3 text-sm font-medium">{entry.campo}</td>
                        <td className="px-4 py-3 text-sm text-subtle">{entry.valorAnterior ?? "--"}</td>
                        <td className="px-4 py-3 text-sm">{entry.valorNovo ?? "--"}</td>
                        <td className="px-4 py-3 text-sm"><Badge variant="neutral">{entry.origem}</Badge></td>
                        <td className="px-4 py-3 text-xs text-subtle">{new Date(entry.data).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <History className="h-8 w-8 mx-auto mb-2 text-subtle" />
                <p className="text-sm text-subtle">Nenhum registro de alteração</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {isReadOnly ? (
            <>
              <Button variant="outline" onClick={() => router.push(`/products/${productId}?edit=1`)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button variant="ghost" onClick={() => setActiveTab("historico")}>
                <History className="h-4 w-4" /> Ver Histórico
              </Button>
            </>
          ) : (
            <>
              <Button variant="lime" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setActiveTab("historico")}>
                <History className="h-4 w-4" /> Ver Histórico
              </Button>
            </>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-xs text-subtle">
            {form.ncm && <Badge variant="neutral">NCM: {form.ncm}</Badge>}
            {form.cest && <Badge variant="neutral">CEST: {form.cest}</Badge>}
            {form.cstCsosnPadrao && <Badge variant={CSOSN_SIMPLES.includes(form.cstCsosnPadrao) ? "info" : "dark"}>{CSOSN_SIMPLES.includes(form.cstCsosnPadrao) ? "CSOSN" : "CST"}: {form.cstCsosnPadrao}</Badge>}
            {form.grupoTributario && <Badge variant="neutral">{form.grupoTributario}</Badge>}
            {form.cfopPreferencial && <Badge variant="lime">CFOP: {form.cfopPreferencial}</Badge>}
          </div>
        </div>
      </Card>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent>
          <DialogTitle>Sair sem salvar?</DialogTitle>
          <DialogDescription>Alterações não salvas serão perdidas.</DialogDescription>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { setConfirmLeave(false); router.push("/products"); }}>Sair</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
