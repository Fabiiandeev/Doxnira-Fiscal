"use client";

import { type LucideIcon, ArrowLeft, ArrowRight, Calendar, Check, CheckCircle2, ChevronDown, Clock, Copy, Download, Edit2, Eye, ExternalLink, FileDown, FileText, Grid2X2, HelpCircle, Info, ListChecks, Mail, MessageCircle, MoreHorizontal, Plus, Printer, Save, Search, Send, Settings, Share2, ShieldCheck, Trash2, Truck, Upload } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { IntelligentClient } from "@/lib/client-types";
import type { NfeDocumentDetail, NfeItem, NfeTotal } from "@/lib/nfe-types";
import type { Cfop, Product } from "@/lib/product-types";
import {
  addNfeItem,
  deleteNfeItem,
  getNfe,
  searchNfeCfops,
  searchNfeClients,
  searchNfeProducts,
  transmitNfe,
  updateNfe,
  validateNfe,
} from "@/lib/services/nfe-service";

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11;

type FlowStep = {
  id: number;
  label: string;
};

type Row = {
  label: string;
  value: ReactNode;
  strong?: boolean;
  green?: boolean;
};

const panelClass =
  "rounded-lg border border-[#dfe5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";

type NoteFormState = {
  cfop: string;
  finalidade: string;
  tipoOperacao: string;
  indicadorPresenca: string;
  consumoFinal: "0" | "1";
  pedidoRef: string;
  additionalInfo: string;
  fiscoInfo: string;
  destinatarioId: string;
  justificativa: string;
};

type ItemFormState = {
  productId: string;
  cfop: string;
  quantity: string;
  unitValue: string;
  discountValue: string;
  cst: string;
  csosn: string;
  origem: string;
};

const finalidadeOptions = [
  { value: "1", label: "1 - Normal" },
  { value: "2", label: "2 - Complementar" },
  { value: "3", label: "3 - Ajuste" },
  { value: "4", label: "4 - Devolucao" },
];

const tipoOperacaoOptions = [
  { value: "0", label: "0 - Entrada" },
  { value: "1", label: "1 - Saida" },
];

const indicadorPresencaOptions = [
  { value: "0", label: "0 - Nao se aplica" },
  { value: "1", label: "1 - Operacao presencial" },
  { value: "2", label: "2 - Internet" },
  { value: "3", label: "3 - Teleatendimento" },
  { value: "4", label: "4 - NFC-e entrega em domicilio" },
  { value: "5", label: "5 - Presencial fora do estabelecimento" },
  { value: "9", label: "9 - Outros" },
];

const consumidorFinalOptions = [
  { value: "0", label: "0 - Nao" },
  { value: "1", label: "1 - Sim" },
];

const origemOptions = [
  { value: "0", label: "0 - Nacional" },
  { value: "1", label: "1 - Estrangeira importacao direta" },
  { value: "2", label: "2 - Estrangeira mercado interno" },
  { value: "3", label: "3 - Nacional importacao superior a 40%" },
  { value: "4", label: "4 - Nacional PPB" },
  { value: "5", label: "5 - Nacional importacao inferior a 40%" },
  { value: "6", label: "6 - Estrangeira sem similar nacional" },
  { value: "7", label: "7 - Estrangeira mercado interno sem similar" },
  { value: "8", label: "8 - Nacional importacao superior a 70%" },
];

const cstCsosnOptions = [
  { value: "", label: "Selecione" },
  { value: "00", label: "00 - Tributada integralmente" },
  { value: "20", label: "20 - Com reducao de base" },
  { value: "40", label: "40 - Isenta" },
  { value: "41", label: "41 - Nao tributada" },
  { value: "60", label: "60 - ICMS cobrado anteriormente" },
  { value: "90", label: "90 - Outras" },
  { value: "101", label: "101 - CSOSN com credito" },
  { value: "102", label: "102 - CSOSN sem credito" },
  { value: "500", label: "500 - CSOSN ICMS ST anterior" },
  { value: "900", label: "900 - CSOSN outros" },
];

function formatCurrency(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(number) ? number : 0);
}

function formatNumber(value: unknown, fractionDigits = 2) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDateDisplay(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function formatDocument(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value || "";
}

function clientName(client: IntelligentClient | null | undefined) {
  if (!client) return "";
  return client.razaoSocial || client.nomeFantasia || client.nome || "";
}

function productLabel(product: Product) {
  return `${product.code} - ${product.name}`;
}

function cfopCode(cfop: Cfop) {
  return cfop.cfop || cfop.code || cfop.codigo;
}

function cfopDescription(cfop: Cfop) {
  return cfop.description || cfop.descricao;
}

function cfopOption(cfop: Cfop) {
  return { value: cfopCode(cfop), label: `${cfopCode(cfop)} - ${cfopDescription(cfop)}` };
}

function buildNoteForm(note: NfeDocumentDetail | null): NoteFormState {
  return {
    cfop: note?.cfop || "",
    finalidade: note?.finalidade || "1",
    tipoOperacao: note?.tipoOperacao || "1",
    indicadorPresenca: note?.indicadorPresenca || "1",
    consumoFinal: note?.consumoFinal ? "1" : "0",
    pedidoRef: note?.pedidoRef || "",
    additionalInfo: note?.additionalInfo || "",
    fiscoInfo: note?.fiscoInfo || "",
    destinatarioId: note?.destinatarioId || "",
    justificativa: note?.justificativa || "",
  };
}

function emptyItemForm(note: NfeDocumentDetail | null): ItemFormState {
  return {
    productId: "",
    cfop: note?.cfop || "5102",
    quantity: "1",
    unitValue: "0",
    discountValue: "0",
    cst: "",
    csosn: "",
    origem: "0",
  };
}

function totalRowsFromTotals(totals: NfeTotal | null | undefined): Row[] {
  return [
    { label: "Total dos Produtos", value: formatCurrency(totals?.valorProdutos) },
    { label: "Total dos Servicos", value: formatCurrency(0) },
    { label: "Descontos", value: `- ${formatCurrency(totals?.desconto)}` },
    { label: "Acrescimos", value: formatCurrency(Number(totals?.frete || 0) + Number(totals?.seguro || 0) + Number(totals?.outrasDespesas || 0)) },
    { label: "Valor Total da Nota", value: formatCurrency(totals?.valorTotal), strong: true, green: true },
  ];
}

const fiscalItems = [
  {
    no: "1",
    code: "PROD001",
    description: "PRODUTO EXEMPLO 01",
    detail: "Marca: EXEMPLO | Modelo: PADRÃO",
    ncm: "1234.56.78",
    cfop: "5102",
    unit: "UN",
    qty: "10,0000",
    unitValue: "100,00",
    discount: "0,00",
    total: "1.000,00",
    cst: "00",
    origin: "0",
  },
  {
    no: "2",
    code: "PROD002",
    description: "PRODUTO EXEMPLO 02",
    detail: "Marca: EXEMPLO | Modelo: PADRÃO",
    ncm: "2345.67.89",
    cfop: "5102",
    unit: "UN",
    qty: "20,0000",
    unitValue: "250,00",
    discount: "100,00",
    total: "4.900,00",
    cst: "00",
    origin: "0",
  },
  {
    no: "3",
    code: "PROD003",
    description: "PRODUTO EXEMPLO 03",
    detail: "Marca: EXEMPLO | Modelo: PADRÃO",
    ncm: "3456.78.90",
    cfop: "5102",
    unit: "UN",
    qty: "30,0000",
    unitValue: "150,00",
    discount: "0,00",
    total: "4.500,00",
    cst: "00",
    origin: "0",
  },
];

const summaryRows: Row[] = [
  { label: "Total dos Produtos", value: "R$ 10.400,00" },
  { label: "Total dos Serviços", value: "R$ 0,00" },
  { label: "Descontos", value: "- R$ 100,00" },
  { label: "Acréscimos", value: "R$ 0,00" },
  { label: "Valor Total da Nota", value: "R$ 10.300,00", strong: true, green: true },
];

const totalsRows: Row[] = [
  { label: "Base de Cálculo ICMS", value: "R$ 9.500,00" },
  { label: "Valor do ICMS", value: "R$ 1.710,00" },
  { label: "Valor do ICMS ST", value: "R$ 0,00" },
  { label: "Valor Total do FCP", value: "R$ 0,00" },
  { label: "Valor do IPI", value: "R$ 300,00" },
  { label: "Valor do PIS", value: "R$ 156,75" },
  { label: "Valor da COFINS", value: "R$ 722,00" },
  { label: "Outras Despesas", value: "R$ 0,00" },
  { label: "Frete", value: "R$ 150,00" },
  { label: "Seguro", value: "R$ 0,00" },
  { label: "Outras Despesas Acessórias", value: "R$ 0,00" },
];

const operationRows: Row[] = [
  { label: "Finalidade", value: "1 - Normal" },
  { label: "Natureza da Operação", value: "VENDA DE MERCADORIA" },
  { label: "Tipo de Operação", value: "1 - Saída" },
  { label: "Forma de Emissão", value: "1 - Normal" },
  { label: "Ambiente", value: "1 - Produção" },
];

const filesRows = [
  ["DANFE", "Documento Auxiliar da NF-e", "danfe_000123456.pdf", "26/06/2026 15:42:18", "186 KB"],
  ["XML da NF-e", "Arquivo XML da NF-e", "nfe_000123456.xml", "26/06/2026 15:42:18", "32 KB"],
  ["Protocolo de Autorização", "Comprovante de autorização", "protocolo_135260000123456.pdf", "26/06/2026 15:42:18", "98 KB"],
];

const sefazLogRows = [
  ["26/06/2026 15:31:28", "Recebimento", "103", "Lote recebido com sucesso", "0,215 s"],
  ["26/06/2026 15:31:29", "Validação", "108", "Lote em processamento", "0,842 s"],
  ["26/06/2026 15:31:31", "Processamento", "150", "Lote processado", "2,785 s"],
  ["26/06/2026 15:42:18", "Autorização", "100", "Autorizado o uso da NF-e", "3,842 s"],
];

export function EmitirNotaView({ nfeId }: { nfeId: string }) {
  const [step, setStep] = useState<StepId>(1);
  const [note, setNote] = useState<NfeDocumentDetail | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormState>(() => buildNoteForm(null));
  const [itemForm, setItemForm] = useState<ItemFormState>(() => emptyItemForm(null));
  const [cfops, setCfops] = useState<Cfop[]>([]);
  const [clients, setClients] = useState<IntelligentClient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);

  async function reloadNote() {
    const response = await getNfe(nfeId);
    setNote(response.data);
    setNoteForm(buildNoteForm(response.data));
    setItemForm(emptyItemForm(response.data));
    return response.data;
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [noteResponse, cfopRows, clientRows, productRows] = await Promise.all([
          getNfe(nfeId),
          searchNfeCfops({ q: "", limit: 50 }),
          searchNfeClients("", 25),
          searchNfeProducts("", 25),
        ]);
        if (!active) return;
        setNote(noteResponse.data);
        setNoteForm(buildNoteForm(noteResponse.data));
        setItemForm(emptyItemForm(noteResponse.data));
        setCfops(cfopRows);
        setClients(clientRows);
        setProducts(productRows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Nao foi possivel carregar a NF-e.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [nfeId]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [step]);
  
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [step]);

  function goNext() {
    setStep((current) => {
      if (current === 1) return 2;
      if (current === 2) return 3;
      if (current === 3) return 4;
      if (current === 4) return 5;
      if (current === 5) return 6;
      if (current === 6) return 8;
      if (current === 8) return 9;
      if (current === 9) return 10;
      if (current === 10) return 11;
      return 11;
    });
  }

  function goBack() {
    setStep((current) => {
      if (current === 11) return 10;
      if (current === 10) return 9;
      if (current === 9) return 8;
      if (current === 8) return 6;
      if (current === 6) return 5;
      if (current === 5) return 4;
      if (current === 4) return 3;
      if (current === 3) return 2;
      return 1;
    });
  }

  async function saveNoteForm(options: { rethrow?: boolean } = {}) {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      const response = await updateNfe(note.id, {
        cfop: noteForm.cfop,
        finNFe: noteForm.finalidade,
        tpNF: noteForm.tipoOperacao,
        indPres: noteForm.indicadorPresenca,
        indFinal: noteForm.consumoFinal,
        recipientId: noteForm.destinatarioId || null,
        pedidoRef: noteForm.pedidoRef,
        additionalInfo: noteForm.additionalInfo,
        fiscoInfo: noteForm.fiscoInfo,
        justificativa: noteForm.justificativa,
      });
      setNote(response.data);
      setNoteForm(buildNoteForm(response.data));
      setMessage("Rascunho salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar a NF-e.");
      if (options.rethrow) throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      await saveNoteForm({ rethrow: true });
      const response = await validateNfe(note.id);
      setMessage(response.message || "NF-e validada.");
      await reloadNote();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel validar a NF-e.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransmit() {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      await saveNoteForm({ rethrow: true });
      const response = await transmitNfe(note.id);
      setMessage(response.message || "Transmissao iniciada.");
      await reloadNote();
      setStep(9);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel transmitir a NF-e.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem() {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      const response = await addNfeItem(note.id, {
        productId: itemForm.productId,
        cfop: itemForm.cfop,
        quantity: itemForm.quantity,
        unitValue: itemForm.unitValue,
        discountValue: itemForm.discountValue,
        cst: itemForm.cst,
        csosn: itemForm.csosn,
        origem: itemForm.origem,
      });
      setNote(response.data);
      setItemForm(emptyItemForm(response.data));
      setMessage("Item incluido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel incluir o item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      const response = await deleteNfeItem(note.id, itemId);
      setNote(response.data);
      setMessage("Item removido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel remover o item.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 py-6 text-[13px] font-semibold text-[#334155]">
        Carregando NF-e...
      </div>
    );
  }

  if (error && !note) {
    return (
      <div className="px-5 py-6 text-[13px] font-semibold text-[#b42318]">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-line bg-white px-4 py-3 md:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Stepper current={step} onSelect={(id) => setStep(normalizeStep(id))} />
          <TopActions
            step={step}
            setStep={setStep}
            saving={saving}
            onSave={saveNoteForm}
            onValidate={handleValidate}
            onTransmit={handleTransmit}
          />
        </div>
      </div>
      <div ref={mainRef as React.RefObject<HTMLDivElement>} className="py-4">
        {(message || error) && (
          <div className={cn("mx-4 mb-3 rounded-md border px-3 py-2 text-[12px] font-semibold md:mx-5", error ? "border-[#fecaca] bg-[#fff1f2] text-[#b42318]" : "border-[#bbf7d0] bg-[#f0fdf4] text-[#166a00]")}>
            {error || message}
          </div>
        )}
        {step === 1 && note && (
          <DadosPage
            note={note}
            form={noteForm}
            setForm={setNoteForm}
            cfops={cfops}
            clients={clients}
            saving={saving}
            onSave={saveNoteForm}
            goNext={goNext}
          />
        )}
        {step === 2 && note && (
          <ItensPage
            note={note}
            form={itemForm}
            setForm={setItemForm}
            cfops={cfops}
            products={products}
            saving={saving}
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
            goBack={goBack}
            goNext={goNext}
          />
        )}
        {step === 3 && note && <TotaisPage note={note} goBack={goBack} goNext={goNext} />}
        {step === 4 && <TransportePage goBack={goBack} goNext={goNext} />}
        {step === 5 && <CobrancaPage goBack={goBack} goNext={goNext} />}
        {step === 6 && <ObservacoesPage goBack={goBack} goNext={goNext} />}
        {step === 8 && <TransmitirPage goBack={goBack} goNext={goNext} />}
        {step === 9 && <RetornoSefazPage goBack={goBack} goNext={goNext} />}
        {step === 10 && <AutorizacaoPage goBack={goBack} goNext={goNext} />}
        {step === 11 && <DanfePage goBack={goBack} />}
      </div>
    </>
  );
}

function normalizeStep(id: number): StepId {
  if (id === 7) return 8;
  if ([1, 2, 3, 4, 5, 6, 8, 9, 10, 11].includes(id)) return id as StepId;
  return 1;
}



function getStepper(step: StepId): FlowStep[] {
  if (step === 1) {
    return [
      { id: 1, label: "Dados da Nota" },
      { id: 2, label: "Itens" },
      { id: 3, label: "Totais" },
      { id: 4, label: "Transporte" },
      { id: 5, label: "Cobrança" },
      { id: 6, label: "Observações" },
      { id: 7, label: "Revisão" },
    ];
  }

  if (step <= 6) {
    return [
      { id: 1, label: "Dados da Nota" },
      { id: 2, label: "Itens" },
      { id: 3, label: "Totais" },
      { id: 4, label: step === 6 ? "Transportador" : "Transporte" },
      { id: 5, label: "Cobrança" },
      { id: 6, label: step === 6 ? "Observações e Referências" : "Observações" },
    ];
  }

  if (step === 8) {
    return [
      { id: 1, label: "Dados da Nota" },
      { id: 2, label: "Itens" },
      { id: 3, label: "Totais" },
      { id: 4, label: "Transporte" },
      { id: 5, label: "Cobrança" },
      { id: 6, label: "Observações" },
      { id: 8, label: "Transmitir" },
    ];
  }

  const advanced = [
    { id: 1, label: "Dados da Nota" },
    { id: 2, label: "Itens" },
    { id: 3, label: "Totais" },
    { id: 4, label: "Transportador" },
    { id: 5, label: "Cobrança" },
    { id: 6, label: "Observações" },
    { id: 7, label: "Emitir NF-e" },
    { id: 8, label: "Transmitir NF-e" },
    { id: 9, label: step === 9 ? "Retorno da SEFAZ" : "Retorno SEFAZ" },
  ];

  if (step >= 10) advanced.push({ id: 10, label: "Autorização" });
  if (step >= 11) advanced.push({ id: 11, label: "DANFE" });
  return advanced;
}







function Stepper({ current, onSelect }: { current: StepId; onSelect: (id: number) => void }) {
  const steps = getStepper(current);
  const dense = steps.length > 7;
  return (
    <div className="min-w-0 overflow-x-auto">
      <div className={cn("flex min-w-max items-center", dense ? "gap-0.5" : "gap-1")}>
        {steps.map((item, index) => {
          const active = item.id === current || (item.id === 7 && current === 8);
          return (
            <div key={item.id} className={cn("flex items-center", dense ? "gap-0.5" : "gap-1")}>
              <button
                onClick={() => onSelect(item.id)}
                className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-[#0f172a]"
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold",
                    active
                      ? "border-[#b7e500] bg-[#b7e500] text-[#0f172a]"
                      : "border-[#dbe3ec] bg-[#eef2f6] text-[#64748b]",
                    current > item.id && item.id !== 7 && current >= 9 && "border-[#dbe3ec] bg-[#eef2f6]",
                  )}
                >
                  {item.id}
                </span>
                <span className={cn(active && "font-extrabold")}>{item.label}</span>
              </button>
              {index < steps.length - 1 && (
                <span className={cn("h-px bg-[#cbd5e1]", dense ? "w-1 md:w-2" : "w-3 md:w-4")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopActions({
  step,
  setStep,
  saving,
  onSave,
  onValidate,
  onTransmit,
}: {
  step: StepId;
  setStep: (step: StepId) => void;
  saving?: boolean;
  onSave: () => void;
  onValidate: () => void;
  onTransmit: () => void;
}) {
  if (step === 9) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <IconButton icon={MoreHorizontal} />
        <ActionButton icon={Printer}>Imprimir</ActionButton>
        <PrimaryButton icon={Download}>Download do Protocolo</PrimaryButton>
      </div>
    );
  }

  if (step === 10) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton icon={Printer}>Imprimir DANFE</ActionButton>
        <PrimaryButton icon={Download} onClick={() => setStep(11)}>Download XML</PrimaryButton>
      </div>
    );
  }

  if (step === 11) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton icon={Printer}>Imprimir DANFE</ActionButton>
        <PrimaryButton icon={Download}>Download DANFE</PrimaryButton>
        <IconButton icon={MoreHorizontal} />
      </div>
    );
  }

  if (step === 8) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton icon={Eye} onClick={() => setStep(11)}>Pre-visualizar DANFE</ActionButton>
        <ActionButton icon={Save} onClick={onSave}>{saving ? "Salvando..." : "Salvar Rascunho"}</ActionButton>
        <PrimaryButton icon={Send} onClick={onTransmit}>{saving ? "Transmitindo..." : "Transmitir NF-e"}</PrimaryButton>
        <IconButton icon={MoreHorizontal} />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <ActionButton icon={Eye} onClick={() => setStep(11)}>Pre-visualizar DANFE</ActionButton>
      <ActionButton icon={Check} onClick={onValidate}>Validar</ActionButton>
      <ActionButton icon={Save} onClick={onSave}>{saving ? "Salvando..." : "Salvar Rascunho"}</ActionButton>
      <PrimaryButton icon={step === 1 ? Send : undefined} onClick={onTransmit}>
        {step === 1 ? "Transmitir NF-e" : "Emitir NF-e"}
      </PrimaryButton>
      <IconButton icon={MoreHorizontal} />
    </div>
  );
}

function IconButton({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <button className="grid h-8 w-8 place-items-center rounded-md border border-[#d6dee9] bg-white text-[#0f172a] hover:bg-[#f8fafc]">
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ActionButton({
  children,
  icon: Icon,
  onClick,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-[#d6dee9] bg-white px-3 text-[12px] font-bold text-[#0f172a] hover:bg-[#f8fafc]"
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  icon: Icon,
  onClick,
  className,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md bg-[#0d6900] px-3.5 text-[12px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-[#0b5700]",
        className,
      )}
    >
      {children}
      {Icon ? <Icon className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );
}

function DadosPage({
  note,
  form,
  setForm,
  cfops,
  clients,
  saving,
  onSave,
  goNext,
}: {
  note: NfeDocumentDetail;
  form: NoteFormState;
  setForm: (updater: (current: NoteFormState) => NoteFormState) => void;
  cfops: Cfop[];
  clients: IntelligentClient[];
  saving: boolean;
  onSave: () => void;
  goNext: () => void;
}) {
  const selectedClient = clients.find((client) => client.id === form.destinatarioId);
  const emitter = note.emitente;
  const totals = totalRowsFromTotals(note.totals);
  const cfopOptions = cfops.map(cfopOption);
  const clientOptions = [
    { value: "", label: "Selecione" },
    ...clients.map((client) => ({
      value: client.id,
      label: `${clientName(client)}${client.cnpj || client.cpf ? ` - ${formatDocument(client.cnpj || client.cpf)}` : ""}`,
    })),
  ];

  const update = (key: keyof NoteFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Natureza da Operacao">
              <Field label="Natureza da Operacao" required>
                <SelectControl value={form.cfop} options={cfopOptions} onChange={(value) => update("cfop", value)} />
              </Field>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Finalidade de Emissao" required>
                  <SelectControl value={form.finalidade} options={finalidadeOptions} onChange={(value) => update("finalidade", value)} />
                </Field>
                <Field label="Tipo de Operacao" required>
                  <SelectControl value={form.tipoOperacao} options={tipoOperacaoOptions} onChange={(value) => update("tipoOperacao", value)} />
                </Field>
              </div>
              {form.finalidade === "3" && (
                <div className="mt-3">
                  <Field label="Justificativa do Ajuste" required>
                    <Control value={form.justificativa} onChange={(value) => update("justificativa", value)} />
                  </Field>
                </div>
              )}
            </Panel>

            <Panel title="Identificacao">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Serie" required>
                  <Control value={String(note.serie || "")} readOnly />
                </Field>
                <Field label="Numero" required>
                  <Control value={note.numero ? String(note.numero).padStart(9, "0") : ""} readOnly />
                </Field>
                <Field label="Data de Emissao" required>
                  <Control value={formatDateDisplay(note.dataEmissao)} icon={Calendar} readOnly />
                </Field>
                <Field label="Data de Saida/Entrada">
                  <Control value={formatDateDisplay(note.dataSaida)} icon={Calendar} readOnly />
                </Field>
                <Field label="Hora de Saida">
                  <Control value={note.horaSaida || ""} readOnly />
                </Field>
                <Field label="Tipo do Documento" required>
                  <Control value="55 - NF-e" readOnly />
                </Field>
              </div>
            </Panel>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Emitente">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Razao Social" required>
                  <Control value={emitter?.legalName || ""} readOnly />
                </Field>
                <Field label="CNPJ" required>
                  <Control value={formatDocument(emitter?.cnpj)} icon={Search} readOnly />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Inscricao Estadual">
                  <Control value={emitter?.stateRegistration || ""} readOnly />
                </Field>
                <Field label="Inscricao Municipal">
                  <Control value={emitter?.municipalRegistration || ""} readOnly />
                </Field>
                <Field label="CNAE">
                  <Control value={emitter?.cnae || ""} readOnly />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Municipio">
                  <Control value={emitter?.city || ""} readOnly />
                </Field>
                <Field label="UF">
                  <Control value={emitter?.uf || ""} readOnly />
                </Field>
                <Field label="CRT">
                  <Control value={emitter?.crt || ""} readOnly />
                </Field>
              </div>
            </Panel>

            <Panel
              title="Destinatario / Remetente"
              actions={
                <>
                  <ActionButton icon={Search}>Buscar Cliente</ActionButton>
                  <ActionButton onClick={() => update("destinatarioId", "")}>Limpar</ActionButton>
                </>
              }
            >
              <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                <Field label="Tipo de Pessoa" required>
                  <Segmented options={["Fisica", "Juridica"]} active={selectedClient?.tipoPessoa === "PF" ? "Fisica" : "Juridica"} />
                </Field>
                <Field label="Cliente" required>
                  <SelectControl value={form.destinatarioId} options={clientOptions} onChange={(value) => update("destinatarioId", value)} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="CPF/CNPJ" required>
                  <Control value={formatDocument(selectedClient?.cnpj || selectedClient?.cpf || note.destinatarioCnpj || note.destinatarioCpf)} readOnly />
                </Field>
                <Field label="Razao Social / Nome" required>
                  <Control value={clientName(selectedClient) || note.destinatarioNome || ""} readOnly />
                </Field>
                <Field label="Inscricao Estadual">
                  <Control value={selectedClient?.inscricaoEstadual || note.destinatarioIe || ""} readOnly />
                </Field>
                <Field label="Municipio">
                  <Control value={selectedClient?.municipio || ""} readOnly />
                </Field>
                <Field label="UF">
                  <Control value={selectedClient?.uf || note.destinatarioUf || ""} readOnly />
                </Field>
              </div>
            </Panel>
          </div>

          <Panel title="Informacoes Adicionais">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Indicador de Presenca do Comprador" required>
                <SelectControl value={form.indicadorPresenca} options={indicadorPresencaOptions} onChange={(value) => update("indicadorPresenca", value)} />
              </Field>
              <Field label="Consumidor Final" required>
                <SelectControl value={form.consumoFinal} options={consumidorFinalOptions} onChange={(value) => update("consumoFinal", value as "0" | "1")} />
              </Field>
              <Field label="Ambiente" required>
                <Control value={note.ambiente === "1" ? "1 - Producao" : "2 - Homologacao"} readOnly />
              </Field>
              <Field label="Processo / Pedido">
                <Control value={form.pedidoRef} onChange={(value) => update("pedidoRef", value)} />
              </Field>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Informacoes Complementares">
                <TextAreaControl value={form.additionalInfo} onChange={(value) => update("additionalInfo", value)} counter={`${form.additionalInfo.length}/1000`} />
              </Field>
              <Field label="Informacoes de Interesse do Fisco">
                <TextAreaControl value={form.fiscoInfo} onChange={(value) => update("fiscoInfo", value)} placeholder="Informacoes de interesse do fisco (opcional)..." counter={`${form.fiscoInfo.length}/200`} />
              </Field>
            </div>
          </Panel>

          <FooterNav
            left="Salvar Rascunho"
            leftIcon={Save}
            right={saving ? "Salvando..." : "Continuar para Itens"}
            onLeft={onSave}
            onRight={async () => {
              await onSave();
              goNext();
            }}
          />
        </div>
      }
      aside={
        <>
          <RowsCard title="Resumo da Nota" rows={totals} />
          <RowsCard
            title="Totais da Nota"
            rows={[
              ...totals,
              { label: "Status", value: note.status, strong: true },
            ]}
          />
          <ProcessCard />
        </>
      }
    />
  );
}

export function LegacyDadosPage({ goNext }: { goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Natureza da Operação">
              <Field label="Natureza da Operação" required>
                <SelectControl value="5102 - Venda de mercadoria adquirida ou recebida de terceiros" />
              </Field>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Finalidade de Emissão" required>
                  <SelectControl value="1 - Normal" />
                </Field>
                <Field label="Tipo de Operação" required>
                  <SelectControl value="1 - Saída" />
                </Field>
              </div>
            </Panel>

            <Panel title="Identificação">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Série" required>
                  <Control value="1" />
                </Field>
                <Field label="Número" required>
                  <Control value="000.123.456" />
                </Field>
                <Field label="Data de Emissão" required>
                  <Control value="25/06/2026" icon={Calendar} />
                </Field>
                <Field label="Data de Saída/Entrada" required>
                  <Control value="25/06/2026" icon={Calendar} />
                </Field>
                <Field label="Hora de Saída" required>
                  <Control value="15:30" icon={Clock} />
                </Field>
                <Field label="Tipo do Documento" required>
                  <SelectControl value="1 - NF-e" />
                </Field>
              </div>
            </Panel>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Emitente">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Razão Social" required>
                  <Control value="EMPRESA EXEMPLO LTDA" />
                </Field>
                <Field label="CNPJ" required>
                  <Control value="12.345.678/0001-90" icon={Search} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Inscrição Estadual">
                  <Control value="123.456.789.111" />
                </Field>
                <Field label="Inscrição Municipal">
                  <Control value="1234567" />
                </Field>
                <Field label="CNAE">
                  <Control value="46.51-6-01" />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                <Field label="CEP">
                  <Control value="01234-567" icon={Search} />
                </Field>
                <Field label="Endereço">
                  <Control value="RUA DAS FLORES, 123" />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Número">
                  <Control value="123" />
                </Field>
                <Field label="Complemento">
                  <Control value="SALA 01" />
                </Field>
                <Field label="Bairro">
                  <Control value="CENTRO" />
                </Field>
                <Field label="Município">
                  <SelectControl value="São Paulo" />
                </Field>
                <Field label="UF">
                  <SelectControl value="SP" />
                </Field>
                <Field label="Telefone">
                  <Control value="(11) 3333-4444" />
                </Field>
              </div>
            </Panel>

            <Panel
              title="Destinatário / Remetente"
              actions={
                <>
                  <ActionButton icon={Search}>Buscar Cliente</ActionButton>
                  <ActionButton>Limpar</ActionButton>
                </>
              }
            >
              <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                <Field label="Tipo de Pessoa" required>
                  <Segmented options={["Física", "Jurídica"]} active="Jurídica" />
                </Field>
                <Field label="CNPJ" required>
                  <Control value="98.765.432/0001-10" icon={Search} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Razão Social" required>
                  <Control value="CLIENTE EXEMPLO LTDA" />
                </Field>
                <Field label="Inscrição Estadual">
                  <Control value="987.654.321.111" />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                <Field label="Inscrição Municipal">
                  <Control value="04567-890" icon={Search} />
                </Field>
                <Field label="Endereço">
                  <Control value="AVENIDA BRASIL, 1000" />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Número">
                  <Control value="1000" />
                </Field>
                <Field label="Complemento">
                  <Control value="GALPÃO 2" />
                </Field>
                <Field label="Bairro">
                  <Control value="VILA NOVA" />
                </Field>
                <Field label="Município">
                  <SelectControl value="São Paulo" />
                </Field>
                <Field label="UF">
                  <SelectControl value="SP" />
                </Field>
              </div>
            </Panel>
          </div>

          <Panel title="Informações Adicionais">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Indicador de Presença do Comprador" required>
                <SelectControl value="1 - Operação presencial" />
              </Field>
              <Field label="Consumidor Final" required>
                <SelectControl value="0 - Não" />
              </Field>
              <Field label="Tipo de Atendimento" required>
                <SelectControl value="1 - Operação não presencial" />
              </Field>
              <Field label="Processo / Pedido">
                <Control value="12345/2026" />
              </Field>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Informações Complementares">
                <TextAreaControl
                  value={"DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.\nNAO GERA DIREITO A CREDITO FISCAL DE IPI.\nTRIB APROX R$ 1.358,07 FEDERAL E R$ 1.845,60 ESTADUAL FONTE: IBPT 5.0.1."}
                  counter="152/1000"
                />
              </Field>
              <Field label="Informações de Interesse do Fisco">
                <TextAreaControl placeholder="Informações de interesse do fisco (opcional)..." counter="0/200" />
              </Field>
            </div>
          </Panel>

          <FooterNav
            left="Cancelar Emissão"
            leftIcon={ArrowLeft}
            right="Continuar para Itens"
            onRight={goNext}
          />
        </div>
      }
      aside={
        <>
          <RowsCard title="Resumo da Nota" rows={summaryRows.slice(0, 5)} />
          <RowsCard
            title="Totais da Nota"
            rows={[
              ...summaryRows.slice(0, 3),
              { label: "Total da Nota", value: "R$ 10.300,00", strong: true },
              ...totalsRows.slice(0, 5),
              { label: "Valor Líquido", value: "R$ 10.200,00", strong: true, green: true },
            ]}
          />
          <ProcessCard />
        </>
      }
    />
  );
}

function ItensPage({
  note,
  form,
  setForm,
  cfops,
  products,
  saving,
  onAddItem,
  onDeleteItem,
  goBack,
  goNext,
}: {
  note: NfeDocumentDetail;
  form: ItemFormState;
  setForm: (updater: (current: ItemFormState) => ItemFormState) => void;
  cfops: Cfop[];
  products: Product[];
  saving: boolean;
  onAddItem: () => void;
  onDeleteItem: (itemId: string) => void;
  goBack: () => void;
  goNext: () => void;
}) {
  const selectedProduct = products.find((product) => product.id === form.productId);
  const itemCount = note.items.length;
  const quantityTotal = note.items.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalRows = totalRowsFromTotals(note.totals);
  const productOptions = [
    { value: "", label: "Selecione" },
    ...products.map((product) => ({ value: product.id, label: productLabel(product) })),
  ];
  const cfopOptions = cfops.map(cfopOption);
  const update = (key: keyof ItemFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const selectProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    setForm((current) => ({
      ...current,
      productId,
      cfop: product?.cfopPreferencial || note.cfop || current.cfop,
      unitValue: product?.price != null ? String(product.price) : current.unitValue,
      cst: product?.cstCsosnPadrao && product.cstCsosnPadrao.length <= 2 ? product.cstCsosnPadrao : current.cst,
      csosn: product?.cstCsosnPadrao && product.cstCsosnPadrao.length > 2 ? product.cstCsosnPadrao : current.csosn,
      origem: product?.origemMercadoria != null ? String(product.origemMercadoria) : current.origem,
    }));
  };
  const previewTotal = Number(form.quantity || 0) * Number(String(form.unitValue || "0").replace(",", ".")) - Number(String(form.discountValue || "0").replace(",", "."));

  return (
    <TwoColumnLayout
      main={
        <div className="space-y-4">
          <Panel
            title="Itens da Nota Fiscal"
            subtitle="Adicione os produtos e servicos da sua nota fiscal"
            actions={
              <>
                <ActionButton icon={Plus} onClick={onAddItem}>{saving ? "Incluindo..." : "Adicionar Item"}</ActionButton>
                <ActionButton icon={Search}>Buscar Produto</ActionButton>
              </>
            }
          >
            <div className="grid gap-3 xl:grid-cols-[1.8fr_1fr_0.8fr_0.8fr_0.65fr_0.65fr]">
              <Field label="Produto / Servico" required>
                <SelectControl value={form.productId} options={productOptions} onChange={selectProduct} />
              </Field>
              <Field label="NCM / CEST" required>
                <Control value={[selectedProduct?.ncm, selectedProduct?.cest].filter(Boolean).join(" / ")} readOnly />
              </Field>
              <Field label="CFOP" required>
                <SelectControl value={form.cfop} options={cfopOptions} onChange={(value) => update("cfop", value)} />
              </Field>
              <Field label="Unidade" required>
                <Control value={selectedProduct?.unit || "UN"} readOnly />
              </Field>
              <Field label="Quantidade" required>
                <Control value={form.quantity} onChange={(value) => update("quantity", value)} />
              </Field>
              <Field label="Valor Unitario" required>
                <Control value={form.unitValue} onChange={(value) => update("unitValue", value)} />
              </Field>
            </div>
            <div className="mt-3 grid items-end gap-3 xl:grid-cols-[0.8fr_1.35fr_0.8fr_0.8fr_auto]">
              <Field label="CST / CSOSN" required>
                <SelectControl value={form.cst || form.csosn} options={cstCsosnOptions} onChange={(value) => (value.length > 2 ? update("csosn", value) : update("cst", value))} />
              </Field>
              <Field label="Origem" required>
                <SelectControl value={form.origem} options={origemOptions} onChange={(value) => update("origem", value)} />
              </Field>
              <Field label="Vlr. Desconto">
                <Control value={form.discountValue} onChange={(value) => update("discountValue", value)} />
              </Field>
              <Field label="Valor Total">
                <Control value={formatCurrency(previewTotal)} muted readOnly />
              </Field>
              <PrimaryButton icon={Plus} className="mb-0" onClick={onAddItem}>{saving ? "Incluindo..." : "Incluir Item"}</PrimaryButton>
            </div>
          </Panel>

          <ItemsTable expanded items={note.items} onDelete={onDeleteItem} />

          <Panel title="Informacoes Fiscais dos Itens">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Produto Selecionado">
                <Control value={selectedProduct?.name || ""} readOnly />
              </Field>
              <Field label="NCM">
                <Control value={selectedProduct?.ncm || ""} readOnly />
              </Field>
              <Field label="CFOP Preferencial">
                <Control value={selectedProduct?.cfopPreferencial || ""} readOnly />
              </Field>
              <Field label="Tributacao Padrao">
                <Control value={selectedProduct?.cstCsosnPadrao || ""} readOnly />
              </Field>
            </div>
          </Panel>

          <FooterNav
            left="Voltar para Dados da Nota"
            right="Continuar para Totais"
            onLeft={goBack}
            onRight={goNext}
          />
        </div>
      }
      aside={
        <>
          <RowsCard
            title="Resumo dos Itens"
            rows={[
              { label: "Total de Itens", value: String(itemCount) },
              { label: "Quantidade Total", value: formatNumber(quantityTotal, 4) },
              { label: "Valor dos Produtos", value: formatCurrency(note.totals?.valorProdutos) },
              { label: "Descontos", value: `- ${formatCurrency(note.totals?.desconto)}` },
              { label: "Valor Total dos Itens", value: formatCurrency(note.totals?.valorTotal), strong: true },
            ]}
          />
          <RowsCard title="Totais da Nota" rows={totalRows} />
          <QuickActions
            title="Acoes Rapidas"
            actions={[
              ["Consultar Produto", "Buscar produto por codigo ou descricao", Search],
              ["Adicionar Item", "Incluir produto do cadastro", Plus],
              ["Verificacao de Impostos", "Recalcular totais da nota", ShieldCheck],
            ]}
          />
        </>
      }
    />
  );
}

export function LegacyItensPage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <div className="space-y-4">
          <Panel
            title="Itens da Nota Fiscal"
            subtitle="Adicione os produtos e serviços da sua nota fiscal"
            actions={
              <>
                <ActionButton icon={Plus}>Adicionar Item</ActionButton>
                <ActionButton icon={Upload}>Importar Itens</ActionButton>
                <ActionButton icon={FileText}>Importar do Pedido</ActionButton>
                <ActionButton icon={Copy}>Copiar Itens</ActionButton>
                <ActionButton>Limpar Todos</ActionButton>
              </>
            }
          >
            <div className="grid gap-3 xl:grid-cols-[1.8fr_1fr_0.8fr_0.8fr_0.65fr_0.65fr]">
              <Field label="Produto / Serviço" required>
                <Control placeholder="Digite o código ou descrição do produto" icon={Search} />
              </Field>
              <Field label="NCM / CEST" required>
                <Control placeholder="Buscar NCM" />
              </Field>
              <Field label="CFOP" required>
                <SelectControl value="Selecione" muted />
              </Field>
              <Field label="Unidade" required>
                <SelectControl value="Selecione" muted />
              </Field>
              <Field label="Quantidade" required>
                <Control value="1,0000" />
              </Field>
              <Field label="Valor Unitário" required>
                <Control value="0,00" muted />
              </Field>
            </div>
            <div className="mt-3 grid items-end gap-3 xl:grid-cols-[0.8fr_1.35fr_0.8fr_0.8fr_auto]">
              <Field label="CST / CSOSN" required>
                <SelectControl value="Selecione" muted />
              </Field>
              <Field label="Origem" required>
                <SelectControl value="0 - Nacional, exceto as indicadas nos..." />
              </Field>
              <Field label="Vlr. Desconto">
                <Control value="0,00" />
              </Field>
              <Field label="Valor Total">
                <Control value="0,00" muted />
              </Field>
              <PrimaryButton icon={Plus} className="mb-0">Incluir Item</PrimaryButton>
            </div>
          </Panel>

          <ItemsTable expanded />

          <Panel title="Informações Adicionais dos Itens">
            <div className="grid gap-3 md:grid-cols-5">
              <Field label="Frete">
                <SelectControl value="1 - Por conta do destinatário" />
              </Field>
              <Field label="Seguro">
                <SelectControl value="1 - Por conta do destinatário" />
              </Field>
              <Field label="Outras Despesas">
                <SelectControl value="1 - Por conta do destinatário" />
              </Field>
              <Field label="Desconto">
                <SelectControl value="1 - Desconto incondicional" />
              </Field>
              <Field label="Tipo de Desconto">
                <SelectControl value="Valor" />
              </Field>
            </div>
          </Panel>

          <FooterNav
            left="Voltar para Dados da Nota"
            right="Continuar para Totais"
            onLeft={goBack}
            onRight={goNext}
          />
        </div>
      }
      aside={
        <>
          <RowsCard
            title="Resumo dos Itens"
            rows={[
              { label: "Total de Itens", value: "3" },
              { label: "Quantidade Total", value: "60,0000" },
              { label: "Valor dos Produtos", value: "R$ 10.400,00" },
              { label: "Descontos", value: "- R$ 100,00" },
              { label: "Valor Total dos Itens", value: "R$ 10.300,00", strong: true },
            ]}
          />
          <RowsCard
            title="Totais da Nota"
            rows={[
              { label: "Total dos Produtos", value: "R$ 10.400,00" },
              { label: "Total dos Serviços", value: "R$ 0,00" },
              { label: "Descontos", value: "- R$ 100,00" },
              { label: "Base de Cálculo ICMS", value: "R$ 9.500,00" },
              { label: "Total ICMS", value: "R$ 1.710,00" },
              { label: "Total IPI", value: "R$ 300,00" },
              { label: "Frete", value: "R$ 150,00" },
              { label: "Seguro", value: "R$ 0,00" },
              { label: "Outras Despesas", value: "R$ 0,00" },
              { label: "Valor Total da Nota", value: "R$ 9.950,00", strong: true, green: true },
            ]}
          />
          <QuickActions
            title="Ações Rápidas"
            actions={[
              ["Consultar Produto (F2)", "Buscar produto por código ou descrição", Search],
              ["Adicionar Serviço (F3)", "Cadastrar item de serviço", Plus],
              ["Importar Itens (XML)", "Importar itens de outra NF-e", Upload],
              ["Verificação de Impostos", "Simular cálculos de impostos", ShieldCheck],
            ]}
          />
        </>
      }
    />
  );
}

function TotaisPage({
  note,
  goBack,
  goNext,
}: {
  note: NfeDocumentDetail;
  goBack: () => void;
  goNext: () => void;
}) {
  const totals = note.totals;
  return (
    <TwoColumnLayout
      main={
        <Panel title="Totais da Nota Fiscal">
          <div className="grid gap-3 xl:grid-cols-3">
            <MiniTotalCard
              title="Valores dos Produtos e Servicos"
              rows={[
                ["Total dos Produtos", formatCurrency(totals?.valorProdutos)],
                ["Total dos Servicos", formatCurrency(0)],
                ["Valor Total dos Produtos/Servicos", formatCurrency(totals?.valorProdutos)],
                ["Descontos", `- ${formatCurrency(totals?.desconto)}`],
                ["Acrescimos", formatCurrency(Number(totals?.frete || 0) + Number(totals?.seguro || 0) + Number(totals?.outrasDespesas || 0))],
              ]}
              total={["Valor Total da Nota", formatCurrency(totals?.valorTotal)]}
            />
            <MiniTotalCard
              title="Calculo do ICMS"
              rows={[
                ["Base de Calculo do ICMS", formatCurrency(totals?.totalIcmsBase)],
                ["Valor do ICMS", formatCurrency(totals?.totalIcms)],
                ["Base de Calculo do ICMS ST", formatCurrency(totals?.totalIcmsStBase)],
                ["Valor do ICMS ST", formatCurrency(totals?.totalIcmsSt)],
                ["Valor Total do FCP", formatCurrency(totals?.totalFcp)],
                ["Outras Despesas Acessorias", formatCurrency(totals?.outrasDespesas)],
              ]}
            />
            <MiniTotalCard
              title="IPI / PIS / COFINS"
              rows={[
                ["Valor do IPI", formatCurrency(totals?.totalIpi)],
                ["Valor do PIS", formatCurrency(totals?.totalPis)],
                ["Valor da COFINS", formatCurrency(totals?.totalCofins)],
              ]}
            />
          </div>
          <FooterNav
            left="Voltar para Itens"
            right="Continuar para Transporte"
            onLeft={goBack}
            onRight={goNext}
          />
        </Panel>
      }
      aside={
        <>
          <RowsCard title="Resumo da Nota" rows={totalRowsFromTotals(totals)} />
          <RowsCard
            title="Operacao"
            rows={[
              { label: "Finalidade", value: finalidadeOptions.find((option) => option.value === note.finalidade)?.label || note.finalidade || "" },
              { label: "Natureza da Operacao", value: note.naturezaOperacao || "" },
              { label: "Tipo de Operacao", value: tipoOperacaoOptions.find((option) => option.value === note.tipoOperacao)?.label || note.tipoOperacao || "" },
              { label: "Ambiente", value: note.ambiente === "1" ? "1 - Producao" : "2 - Homologacao" },
            ]}
          />
        </>
      }
    />
  );
}

export function LegacyTotaisPage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <Panel title="Totais da Nota Fiscal">
          <div className="grid gap-3 xl:grid-cols-3">
            <MiniTotalCard
              title="Valores dos Produtos e Serviços"
              rows={[
                ["Total dos Produtos", "R$ 10.400,00"],
                ["Total dos Serviços", "R$ 0,00"],
                ["Valor Total dos Produtos/Serviços", "R$ 10.400,00"],
                ["Descontos", "- R$ 100,00"],
                ["Acréscimos", "R$ 0,00"],
              ]}
              total={["Valor Total da Nota", "R$ 10.300,00"]}
            />
            <MiniTotalCard
              title="Cálculo do ICMS"
              rows={[
                ["Base de Cálculo do ICMS", "R$ 9.500,00"],
                ["Valor do ICMS", "R$ 1.710,00"],
                ["Base de Cálculo do ICMS ST", "R$ 0,00"],
                ["Valor do ICMS ST", "R$ 0,00"],
                ["Valor Total do FCP", "R$ 0,00"],
                ["Outras Despesas Acessórias", "R$ 0,00"],
              ]}
            />
            <MiniTotalCard
              title="Cálculo do IPI"
              rows={[
                ["Base de Cálculo do IPI", "R$ 10.400,00"],
                ["Valor do IPI", "R$ 300,00"],
              ]}
            />
            <MiniTotalCard
              title="Cálculo do PIS"
              rows={[
                ["Base de Cálculo do PIS", "R$ 9.500,00"],
                ["Alíquota do PIS", "1,65 %"],
                ["Valor do PIS", "R$ 156,75"],
              ]}
            />
            <MiniTotalCard
              title="Cálculo da COFINS"
              rows={[
                ["Base de Cálculo da COFINS", "R$ 9.500,00"],
                ["Alíquota da COFINS", "7,60 %"],
                ["Valor da COFINS", "R$ 722,00"],
              ]}
            />
            <MiniTotalCard
              title="Outros Impostos"
              rows={[
                ["ISS", "R$ 0,00"],
                ["INSS", "R$ 0,00"],
                ["IRRF", "R$ 0,00"],
                ["CSLL", "R$ 0,00"],
                ["Outros Impostos", "R$ 0,00"],
              ]}
            />
          </div>

          <div className="mt-4 rounded-lg border border-[#dfe5ee]">
            <div className="px-3 py-3 text-[15px] font-bold">Resumo dos Tributos <span className="text-[12px] font-medium text-[#64748b]">(Lei 12.741/2012)</span></div>
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#f8fafc] text-[#0f172a]">
                <tr>
                  {["Tributo", "Base de Cálculo", "Alíquota", "Valor"].map((head) => (
                    <th key={head} className="border-t border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["ICMS", "R$ 9.500,00", "18,00 %", "R$ 1.710,00"],
                  ["IPI", "R$ 10.400,00", "2,88 %", "R$ 300,00"],
                  ["PIS", "R$ 9.500,00", "1,65 %", "R$ 156,75"],
                  ["COFINS", "R$ 9.500,00", "7,60 %", "R$ 722,00"],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-[#e5eaf1]">
                    {row.map((cell) => <td key={cell} className="px-3 py-3">{cell}</td>)}
                  </tr>
                ))}
                <tr className="border-t border-[#e5eaf1] bg-[#fbfdf8] text-[#166a00]">
                  <td className="px-3 py-3 font-bold">Total Aproximado dos Tributos</td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 text-right text-[15px] font-extrabold">R$ 2.888,75 (28,05%)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <FooterNav
            left="Voltar para Itens"
            right="Continuar para Transporte"
            onLeft={goBack}
            onRight={goNext}
          />
        </Panel>
      }
      aside={
        <>
          <RowsCard title="Resumo da Nota" rows={summaryRows} />
          <RowsCard title="Totais" rows={totalsRows} />
          <RowsCard title="Informações Fiscais" rows={operationRows} compact />
        </>
      }
    />
  );
}

function TransportePage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <Panel
          title="Dados do Transporte"
          subtitle="Informe os dados do transportador e do transporte da mercadoria"
          actions={
            <>
              <ActionButton icon={Search}>Buscar Transportadora</ActionButton>
              <ActionButton>Limpar Dados</ActionButton>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Modalidade do Frete" required>
              <SelectControl value="0 - Contratação do Frete por conta do Remetente (CIF)" />
            </Field>
            <Field label="Tipo do Frete" required>
              <SelectControl value="1 - Por conta do Destinatário" />
            </Field>
          </div>

          <FormTitle>Transportador</FormTitle>
          <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_1.5fr_1fr]">
            <Field label="Tipo de Pessoa" required>
              <Segmented options={["Jurídica", "Física"]} active="Jurídica" />
            </Field>
            <Field label="CNPJ" required>
              <Control value="23.456.789/0001-30" icon={Search} />
            </Field>
            <Field label="Razão Social" required>
              <Control value="TRANSPORTES EXEMPLO LTDA" />
            </Field>
            <Field label="Inscrição Estadual">
              <Control value="123.456.789.111" />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1fr_0.8fr_1.3fr]">
            <Field label="RNTRC" required>
              <Control value="12345678" />
            </Field>
            <Field label="Nome Fantasia">
              <Control value="Transporte Exemplo" />
            </Field>
            <Field label="Telefone">
              <Control value="(11) 3333-4444" />
            </Field>
            <Field label="E-mail">
              <Control value="contato@transporteexemplo.com.br" />
            </Field>
          </div>

          <FormTitle>Veículo / Condutor</FormTitle>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Placa do Veículo" required>
              <Control value="ABC1D23" />
            </Field>
            <Field label="UF da Placa" required>
              <SelectControl value="SP" />
            </Field>
            <Field label="RNTC">
              <Control placeholder="Digite o RNTC" />
            </Field>
            <Field label="Tipo do Veículo" required>
              <SelectControl value="1 - Caminhão" />
            </Field>
            <Field label="Proprietário do Veículo" required>
              <SelectControl value="0 - Transportadora" />
            </Field>
            <Field label="UF" required>
              <SelectControl value="SP" />
            </Field>
            <Field label="Peso Bruto (kg)">
              <Control value="10.000,000" />
            </Field>
            <Field label="Peso Líquido (kg)">
              <Control value="8.500,000" />
            </Field>
          </div>

          <FormTitle>Condutor</FormTitle>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="CPF do Condutor">
              <Control value="123.456.789-09" />
            </Field>
            <Field label="Nome do Condutor">
              <Control value="JOÃO DA SILVA" />
            </Field>
            <Field label="Telefone do Condutor">
              <Control value="(11) 98888-7777" />
            </Field>
            <Field label="E-mail do Condutor">
              <Control value="joao.silva@email.com" />
            </Field>
          </div>

          <FormTitle>Volumes Transportados</FormTitle>
          <div className="grid gap-3 md:grid-cols-[0.7fr_1fr_1.1fr_1fr_1fr]">
            <Field label="Quantidade" required>
              <Control value="10" />
            </Field>
            <Field label="Espécie" required>
              <SelectControl value="CAIXAS" />
            </Field>
            <Field label="Marca" required>
              <Control value="EXEMPLO" />
            </Field>
            <Field label="Numeração">
              <Control value="001 A 010" />
            </Field>
            <Field label="Peso Bruto Total (kg)" required>
              <Control value="10.000,000" />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Informações Complementares do Transporte">
              <TextAreaControl placeholder="Informações adicionais sobre o transporte (opcional)..." counter="0/500" short />
            </Field>
          </div>

          <FooterNav
            left="Voltar para Totais"
            right="Continuar para Cobrança"
            onLeft={goBack}
            onRight={goNext}
          />
        </Panel>
      }
      aside={
        <>
          <RowsCard title="Resumo da Nota" rows={summaryRows.slice(0, 5)} />
          <RowsCard
            title="Resumo do Transporte"
            rows={[
              { label: "Modalidade do Frete", value: "0 - Remetente (CIF)" },
              { label: "Tipo do Frete", value: "1 - Destinatário" },
              { label: "Transportador", value: "TRANSPORTES EXEMPLO LTDA" },
              { label: "CNPJ", value: "23.456.789/0001-30" },
              { label: "Placa do Veículo", value: "ABC1D23 - SP" },
              { label: "Tipo do Veículo", value: "1 - Caminhão" },
              { label: "Peso Bruto Total", value: "10.000,000 kg" },
              { label: "Peso Líquido Total", value: "8.500,000 kg" },
              { label: "Quantidade de Volumes", value: "10" },
            ]}
          />
          <QuickActions
            title="Ações Rápidas"
            actions={[
              ["Buscar Transportadora", "Pesquise transportadoras cadastradas", Search],
              ["Meus Veículos", "Gerenciar veículos cadastrados", Truck],
              ["Validar Dados", "Validar informações do transporte", ShieldCheck],
              ["Ajuda", "Regras de preenchimento do transporte", HelpCircle],
            ]}
          />
        </>
      }
    />
  );
}

function CobrancaPage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <Panel title="Cobrança da Nota Fiscal" subtitle="Defina as formas e condições de pagamento desta nota fiscal">
          <InfoBanner text="Os títulos serão gerados após a autorização da NF-e." />

          <FormTitle>Forma de Pagamento</FormTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Forma de Pagamento" required>
              <SelectControl value="2 - Outros" />
            </Field>
            <Field label="Informar Meio de Pagamento">
              <SelectControl value="2 - Boleto Bancário" />
            </Field>
          </div>

          <div className="mt-4 rounded-lg border border-[#dfe5ee] p-3">
            <h3 className="mb-4 text-[15px] font-bold">Condições de Pagamento</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Condição de Pagamento" required>
                <SelectControl value="001 - À Vista" />
              </Field>
              <Field label="Número de Parcelas" required>
                <Control value="1" muted />
              </Field>
              <Field label="Intervalo entre Parcelas">
                <SelectControl value="Selecione" muted />
              </Field>
              <Field label="Dia da Primeira Parcela" required>
                <Control value="21/05/2025" icon={Calendar} />
              </Field>
              <Field label="Valor da Nota">
                <Control value="R$ 10.300,00" />
              </Field>
              <Field label="Desconto Total">
                <Control value="R$ 100,00" />
              </Field>
              <Field label="Acréscimo Total">
                <Control value="R$ 0,00" />
              </Field>
              <Field label="Valor Líquido">
                <Control value="R$ 10.200,00" green />
              </Field>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[#dfe5ee]">
            <div className="flex items-center justify-between px-3 py-3">
              <div>
                <h3 className="text-[15px] font-bold">Títulos / Parcelas da Nota Fiscal</h3>
                <p className="text-[12px] text-[#475569]">Configure os títulos que serão gerados para esta cobrança</p>
              </div>
              <ActionButton icon={Plus}>Adicionar Parcela</ActionButton>
            </div>
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>{["Parcela", "Vencimento", "Valor Original", "Desconto", "Acréscimo", "Valor Líquido", "Meio de Pagamento", "Ações"].map((head) => <th key={head} className="border-t border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>)}</tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#e5eaf1]">
                  <td className="px-3 py-3 font-bold">1 / 1</td>
                  <td className="px-3 py-3"><span className="inline-flex h-8 items-center gap-2 rounded-md border border-[#d6dee9] px-3">21/05/2025 <Calendar className="h-4 w-4" /></span></td>
                  <td className="px-3 py-3">R$ 10.300,00</td>
                  <td className="px-3 py-3">R$ 100,00</td>
                  <td className="px-3 py-3">R$ 0,00</td>
                  <td className="px-3 py-3 font-bold text-[#166a00]">R$ 10.200,00</td>
                  <td className="px-3 py-3">2 - Boleto Bancário</td>
                  <td className="px-3 py-3"><TableActions /></td>
                </tr>
                <tr className="border-t border-[#e5eaf1] bg-[#fbfbfc] font-bold">
                  <td className="px-3 py-3">Totais</td>
                  <td />
                  <td className="px-3 py-3">R$ 10.300,00</td>
                  <td className="px-3 py-3">R$ 100,00</td>
                  <td className="px-3 py-3">R$ 0,00</td>
                  <td className="px-3 py-3 text-[#166a00]">R$ 10.200,00</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <FormTitle>Dados do Boleto <span className="text-[12px] font-medium text-[#64748b]">(Será usado na geração do título)</span></FormTitle>
          <div className="grid gap-3 md:grid-cols-6">
            <Field label="Banco" required>
              <SelectControl value="237 - Bradesco" />
            </Field>
            <Field label="Agência" required>
              <Control value="1234-5" />
            </Field>
            <Field label="Conta" required>
              <Control value="12345-6" />
            </Field>
            <Field label="Carteira" required>
              <Control value="09" />
            </Field>
            <Field label="Nosso Número" required>
              <Control value="000123456789-0" />
            </Field>
            <Field label="Aceite" required>
              <SelectControl value="N - Não" />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Instruções para o Boleto">
              <TextAreaControl value="Após o vencimento cobrar multa de 2% e juros de 1% ao mês." counter="59/400" short />
            </Field>
          </div>

          <FooterNav
            left="Voltar para Transporte"
            right="Continuar para Observações e Referências"
            onLeft={goBack}
            onRight={goNext}
          />
        </Panel>
      }
      aside={
        <>
          <RowsCard title="Resumo da Nota" rows={summaryRows} />
          <RowsCard
            title="Resumo da Cobrança"
            rows={[
              { label: "Forma de Pagamento", value: "Outros" },
              { label: "Meio de Pagamento", value: "Boleto Bancário" },
              { label: "Condição de Pagamento", value: "À Vista" },
              { label: "Número de Parcelas", value: "1" },
              { label: "Valor da Nota", value: "R$ 10.300,00" },
              { label: "Desconto Total", value: "- R$ 100,00" },
              { label: "Acréscimo Total", value: "R$ 0,00" },
              { label: "Valor Líquido", value: "R$ 10.200,00", strong: true, green: true },
            ]}
          />
          <QuickActions
            title="Ações Rápidas"
            actions={[
              ["Simular Parcelamento", "Simule diferentes condições de pagamento", Copy],
              ["Gerar Prévia do Boleto", "Visualize como ficará o boleto", FileText],
              ["Configurar Instruções", "Personalize as instruções do boleto", Settings],
              ["Histórico de Cobranças", "Consulte cobranças anteriores", Clock],
            ]}
          />
        </>
      }
    />
  );
}

function ObservacoesPage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <Panel title="Observações e Referências" subtitle="Informe observações gerais e referências da operação">
          <div className="rounded-lg border border-[#dfe5ee] p-3">
            <h3 className="mb-3 text-[15px] font-bold">Observações da Nota Fiscal</h3>
            <Field label="Informações complementares (Fisco)">
              <TextAreaControl
                value={"Documento emitido por ME ou EPP optante pelo Simples Nacional.\nNao gera direito a crédito fiscal de IPI.\nTrib aprox R$ 1.358,07 Federal e R$ 1.845,60 Estadual. Fonte: IBPT 5.0.1.\nVenda de mercadoria adquirida ou recebida de terceiros."}
                counter="178/1000"
              />
            </Field>
            <div className="mt-4">
              <Field label="Informações adicionais - Cliente/Comprador">
                <TextAreaControl
                  value={"Entrega no endereço do destinatário.\nFavor conferir a mercadoria no ato da entrega."}
                  counter="82/1000"
                  short
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[#dfe5ee] p-3">
            <h3 className="text-[15px] font-bold">Referências</h3>
            <p className="mb-3 text-[12px] text-[#475569]">Informações de pedido, contrato ou documento referência</p>
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_0.85fr_1.15fr_auto]">
              <Field label="Tipo de Referência">
                <SelectControl value="1 - Pedido de Compra" />
              </Field>
              <Field label="Número da Referência">
                <Control value="PC-000125/2025" />
              </Field>
              <Field label="Data da Referência">
                <Control value="15/05/2025" icon={Calendar} />
              </Field>
              <Field label="Chave da NFe Referenciada">
                <Control placeholder="Digite a chave da NFe" icon={Copy} />
              </Field>
              <ActionButton icon={Plus}>Adicionar Referência</ActionButton>
            </div>
            <table className="mt-4 w-full text-left text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>{["Tipo de Referência", "Número", "Data", "Chave da NFe Referenciada", "Ações"].map((head) => <th key={head} className="border-y border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>)}</tr>
              </thead>
              <tbody>
                {[
                  ["1 - Pedido de Compra", "PC-000125/2025", "15/05/2025", "-"],
                  ["2 - Contrato", "CT-2025-014", "01/05/2025", "-"],
                ].map((row) => (
                  <tr key={row[1]} className="border-b border-[#e5eaf1]">
                    {row.map((cell) => <td key={cell} className="px-3 py-3">{cell}</td>)}
                    <td className="px-3 py-3"><TableActions /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-lg border border-[#dfe5ee] p-3">
            <h3 className="text-[15px] font-bold">Observações Internas (Não impressa na DANFE)</h3>
            <p className="mb-3 text-[12px] text-[#475569]">Campo exclusivo para controle interno da empresa</p>
            <Field label="">
              <TextAreaControl
                value={"Cliente solicitou entrega em horário comercial.\nContato: Sr. João - (11) 99999-8888"}
                counter="76/500"
                short
              />
            </Field>
          </div>

          <FooterNav
            left="Voltar para Cobrança"
            right="Revisar e Emitir NF-e"
            onLeft={goBack}
            onRight={goNext}
          />
        </Panel>
      }
      aside={
        <>
          <RowsCard title="Resumo da Nota" rows={summaryRows} />
          <RowsCard
            title="Resumo da Cobrança"
            rows={[
              { label: "Forma de Pagamento", value: "Outros" },
              { label: "Meio de Pagamento", value: "Boleto Bancário" },
              { label: "Condição de Pagamento", value: "À Vista" },
              { label: "Número de Parcelas", value: "1" },
              { label: "Valor da Nota", value: "R$ 10.300,00" },
              { label: "Desconto Total", value: "- R$ 100,00" },
              { label: "Acréscimo Total", value: "R$ 0,00" },
              { label: "Valor Líquido", value: "R$ 10.200,00", strong: true, green: true },
            ]}
          />
          <RowsCard title="Informações da Operação" rows={operationRows} compact />
        </>
      }
    />
  );
}

function TransmitirPage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <Panel title="Preparação para Transmissão" subtitle="Revise as informações abaixo antes de transmitir sua NF-e para a SEFAZ.">
          <div className="grid gap-3 xl:grid-cols-3">
            <MiniTotalCard
              title="Resumo da Nota"
              rows={[
                ["Modelo", "55 - NF-e"],
                ["Série / Número", "1 / 000.123.456"],
                ["Data de Emissão", "25/06/2026 15:30:00"],
                ["Natureza da Operação", "5102 - Venda de mercadoria adquirida ou recebida de terceiros"],
              ]}
              total={["Valor Total da Nota", "R$ 10.300,00"]}
            />
            <Panel title="Arquivos da Nota" subtitle="Os seguintes arquivos serão transmitidos para a SEFAZ." dense>
              {[
                ["XML da NF-e", "000123456.xml"],
                ["DANFE", "000123456.pdf"],
                ["XSLT", "procNFe_v4.00.xslt"],
                ["Assinatura Digital", "Certificado A1"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-[#e5eaf1] py-2 text-[12px] last:border-b-0">
                  <span className="font-bold">{label}</span>
                  <span className="flex items-center gap-2">{value}<CheckCircle2 className="h-4 w-4 text-[#179300]" /></span>
                </div>
              ))}
            </Panel>
            <Panel title="Certificado Digital" subtitle="Certificado selecionado para assinatura e transmissão." dense>
              <Rows rows={[
                { label: "Titular", value: "EMPRESA EXEMPLO LTDA" },
                { label: "CNPJ", value: "12.345.678/0001-90" },
                { label: "Tipo", value: "A1" },
                { label: "Emissor", value: "AC SOLUTI Multipla v5" },
                { label: "Válido até", value: "15/09/2026" },
              ]} compact />
              <div className="mt-3 flex h-9 items-center gap-2 rounded-md border border-[#9ccc8c] bg-[#f4fbef] px-3 text-[12px] font-bold text-[#166a00]">
                <CheckCircle2 className="h-4 w-4" />
                Certificado válido
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1.15fr]">
            <Panel title="Validação da Nota" subtitle="Verificações realizadas antes da transmissão." dense>
              {["Schema XML", "Regras de Negócio SEFAZ", "Assinatura Digital", "Dados do Emitente", "Dados do Destinatário", "Cálculos e Totais", "Itens da Nota", "Tributações", "Informações Adicionais"].map((item) => (
                <div key={item} className="flex items-center justify-between border-b border-[#e5eaf1] py-2 text-[12px] last:border-b-0">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#179300]" />{item}</span>
                  <span className="font-bold text-[#166a00]">OK</span>
                </div>
              ))}
            </Panel>

            <Panel title="Ambiente de Transmissão" subtitle="Selecione o ambiente para transmissão da NF-e." dense>
              <InfoBanner text="Ambiente de PRODUÇÃO selecionado. A nota será transmitida para a SEFAZ com validade jurídica." />
              <Field label="Ambiente" required>
                <Segmented options={["Homologação (Teste)", "Produção"]} active="Produção" />
              </Field>
              <div className="mt-3">
                <div className="text-[12px] font-bold">Tempo limite de resposta</div>
                <p className="mb-2 text-[12px] text-[#475569]">A SEFAZ tem até 15 minutos para retornar o protocolo.</p>
                <div className="flex h-9 items-center justify-between rounded-md border border-[#9ccc8c] bg-[#f4fbef] px-3 text-[12px] font-bold text-[#166a00]">
                  <span className="flex items-center gap-2"><Clock className="h-4 w-4" />15:00</span>
                  <span>minutos</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[12px] font-bold">Status da Transmissão</div>
                <p className="mb-2 text-[12px] text-[#475569]">Aguardando transmissão da NF-e para a SEFAZ.</p>
                <span className="inline-flex rounded-md border border-[#f2bb4f] bg-[#fff8e8] px-3 py-1 text-[12px] font-bold text-[#b25d00]">
                  PENDENTE
                </span>
              </div>
            </Panel>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-[#f0c66b] bg-[#fffaf0] p-3 text-[12px]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d89a00]" />
            <div>
              <div className="font-bold">Atenção</div>
              <div>Após a transmissão, aguarde o retorno da SEFAZ. Não feche esta tela até receber o protocolo de autorização.</div>
            </div>
          </div>

          <FooterNav
            left="Voltar para Revisão"
            right="Transmitir NF-e Agora"
            onLeft={goBack}
            onRight={goNext}
            rightIcon={Send}
          />
        </Panel>
      }
      aside={
        <>
          <ProgressCard />
          <QuickActions
            title="Informações Importantes"
            actions={[
              ["Não feche esta tela durante a transmissão.", "", Info],
              ["Aguarde o retorno da SEFAZ.", "", Info],
              ["Em caso de erro, você poderá corrigir e retransmitir.", "", Info],
              ["O protocolo de autorização será exibido ao final.", "", Info],
            ]}
            mutedIcons
          />
          <Panel title="Histórico de Tentativas" dense>
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#f8fafc]">
                <tr>{["Data/Hora", "Ambiente", "Status", "Protocolo"].map((head) => <th key={head} className="border-y border-[#e5eaf1] px-2 py-2 font-bold">{head}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-3">25/06/2026 15:31:22</td>
                  <td className="px-2 py-3">Produção</td>
                  <td className="px-2 py-3"><span className="rounded-md border border-[#f2bb4f] bg-[#fff8e8] px-2 py-1 text-[#b25d00]">Pendente</span></td>
                  <td className="px-2 py-3">-</td>
                </tr>
              </tbody>
            </table>
            <ActionButton icon={ListChecks}>Ver Histórico Completo</ActionButton>
          </Panel>
        </>
      }
    />
  );
}

function RetornoSefazPage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <SuccessBanner compact />
          <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
            <InvoiceSummaryCard />
            <AuthorizationInfoCard title="Retorno da SEFAZ" badge="Autorizado" />
          </div>
          <FilesCard title="Arquivos da Nota" />
          <SefazLogCard />
          <FooterNav
            left="Voltar para Transmissão"
            right="Finalizar e Voltar para Lista"
            onLeft={goBack}
            onRight={goNext}
            rightIcon={Check}
          />
        </div>
      }
      aside={
        <>
          <StatusProcessCard compact />
          <Panel title="Informações do Protocolo" dense>
            <pre className="h-[180px] overflow-auto rounded-md border border-[#d6dee9] bg-[#f8fafc] p-3 text-[11px] leading-5 text-[#334155]">
{`<protNFe versao="4.00">
  <infProt Id="ID13526000123456">
    <tpAmb>1</tpAmb>
    <verAplic>SP_NFE_4.00</verAplic>
    <chNFe>3526061234567800019055001000123456100123456</chNFe>
    <dhRecbto>2026-06-26T15:42:18-03:00</dhRecbto>
    <nProt>13526000123456</nProt>
    <digVal>Q1W2E3R4T5Y6U7I8O9P0A1S2D3F4G5</digVal>
    <cStat>100</cStat>
    <xMotivo>Autorizado o uso da NF-e</xMotivo>
  </infProt>
</protNFe>`}
            </pre>
            <ActionButton icon={Copy}>Copiar Protocolo</ActionButton>
          </Panel>
          <QuickActions
            title="Ações Rápidas"
            actions={[
              ["Imprimir DANFE", "Visualize e imprima o DANFE da nota", Printer],
              ["Enviar por E-mail", "Envie o DANFE por e-mail", Mail],
              ["Download XML", "Baixe o arquivo XML da NF-e", Download],
              ["Download do Protocolo", "Baixe o protocolo de autorização", FileDown],
            ]}
          />
        </>
      }
    />
  );
}

function AutorizacaoPage({ goBack, goNext }: { goBack: () => void; goNext: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <SuccessBanner />
          <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
            <InvoiceSummaryCard />
            <AuthorizationInfoCard title="Informações da Autorização" badge="AUTORIZADA" />
          </div>
          <FilesCard title="Arquivos Disponíveis" />
          <SefazLogCard />
          <FooterNav
            left="Voltar para Lista de NF-e"
            right="Novo Documento"
            onLeft={goBack}
            onRight={goNext}
            middle="Imprimir DANFE"
            middleIcon={Printer}
          />
        </div>
      }
      aside={
        <>
          <StatusProcessCard />
          <QuickActions
            title="Informações Importantes"
            actions={[
              ["Guarde o DANFE e o XML da NF-e autorizada.", "", Info],
              ["O DANFE substitui o antigo conhecimento de transporte.", "", Info],
              ["A validade jurídica da NF-e está vinculada ao protocolo de autorização.", "", Info],
            ]}
            mutedIcons
          />
          <QuickActions
            title="Próximas Ações"
            actions={[
              ["Enviar NF-e por E-mail", "Envie o DANFE para seu cliente", Mail],
              ["Manifestação do Destinatário", "Acompanhe a manifestação do destinatário", MessageCircle],
              ["Cancelar NF-e", "Solicitar cancelamento da NF-e autorizada", Trash2],
            ]}
          />
        </>
      }
    />
  );
}

function DanfePage({ goBack }: { goBack: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <Panel title="DANFE - Documento Auxiliar da Nota Fiscal Eletrônica">
            <div className="mb-3 flex items-center justify-between rounded-md border border-[#dfe5ee] bg-[#f8fafc] p-2">
              <div className="flex items-center gap-2">
                <IconButton icon={ArrowLeft} />
                <button className="h-9 rounded-md border border-[#d6dee9] bg-white px-4 text-[12px] font-bold">100% <ChevronDown className="ml-2 inline h-4 w-4" /></button>
                <IconButton icon={Plus} />
                <IconButton icon={ExternalLink} />
              </div>
              <div className="text-[12px] font-bold">Página <span className="mx-2 rounded-md border border-[#d6dee9] bg-white px-3 py-2">1</span> / 1</div>
              <div className="flex items-center gap-2 text-[12px] font-bold">
                Visualização:
                <IconButton icon={FileText} />
                <IconButton icon={Grid2X2} />
                <IconButton icon={MoreHorizontal} />
              </div>
            </div>
            <DanfeDocument />
          </Panel>
          <FooterNav left="Voltar" onLeft={goBack} />
        </div>
      }
      aside={
        <>
          <RowsCard
            title="Resumo da NF-e"
            rows={[
              { label: "Modelo", value: "55 - NF-e" },
              { label: "Série / Número", value: "1 / 000.123.456" },
              { label: "Data de Emissão", value: "26/06/2026 15:30:00" },
              { label: "Natureza da Operação", value: "5102 - Venda de mercadoria..." },
              { label: "Tipo de Operação", value: "1 - Saída" },
              { label: "Finalidade", value: "1 - Normal" },
              { label: "Forma de Emissão", value: "1 - Normal" },
              { label: "Ambiente", value: "1 - Produção" },
              { label: "Situação", value: <span className="rounded bg-[#e9f8e6] px-2 py-0.5 text-[11px] font-bold text-[#166a00]">Autorizada</span> },
              { label: "Protocolo SEFAZ", value: "135260000123456" },
              { label: "Data/Hora Autorização", value: "26/06/2026 15:42:18" },
            ]}
          />
          <QuickActions
            title="Ações"
            actions={[
              ["Imprimir DANFE", "Imprima o DANFE da nota", Printer],
              ["Download DANFE (PDF)", "Baixe o DANFE em PDF", Download],
              ["Download XML", "Baixe o arquivo XML da NF-e", Download],
              ["Enviar por E-mail", "Envie o DANFE por e-mail", Mail],
              ["Compartilhar", "Copie o link para compartilhar", Share2],
            ]}
          />
          <QuickActions
            title="Informações Importantes"
            actions={[
              ["NF-e autorizada pela SEFAZ com sucesso.", "", CheckCircle2],
              ["A validade jurídica da NF-e está vinculada ao protocolo.", "", CheckCircle2],
              ["DANFE substitui o antigo conhecimento de transporte.", "", CheckCircle2],
            ]}
          />
        </>
      }
    />
  );
}

function TwoColumnLayout({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">{main}</div>
      <aside className="space-y-3">{aside}</aside>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <section className={cn(panelClass, "p-3")}>
      <div className={cn((title || subtitle || actions) && "mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between")}>
        <div>
          {title && <h2 className="text-[16px] font-extrabold leading-6 text-[#0f172a]">{title}</h2>}
          {subtitle && <p className="mt-1 text-[12px] text-[#475569]">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      {label ? (
        <span className="mb-1 block truncate text-[11px] font-semibold text-[#334155]">
          {label}
          {required && <span className="ml-1 text-[#ef4444]">*</span>}
        </span>
      ) : null}
      {children}
    </label>
  );
}

function Control({
  value,
  placeholder,
  icon: Icon,
  muted,
  green,
  onChange,
  readOnly,
}: {
  value?: string;
  placeholder?: string;
  icon?: LucideIcon;
  muted?: boolean;
  green?: boolean;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-[#d6dee9] bg-white px-3 text-[12px] font-medium text-[#0f172a]",
        muted && "bg-[#f8fafc] text-[#64748b]",
        green && "font-extrabold text-[#166a00]",
      )}
    >
      <input
        className={cn(
          "min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#94a3b8]",
          green && "font-extrabold text-[#166a00]",
        )}
        value={value ?? ""}
        placeholder={placeholder}
        readOnly={readOnly || !onChange}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {Icon && <Icon className="h-4 w-4 shrink-0 text-[#334155]" />}
    </div>
  );
}

function SelectControl({
  value,
  muted,
  options,
  onChange,
}: {
  value: string;
  muted?: boolean;
  options?: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}) {
  const fallbackOptions = Array.from(
    new Set([
      value,
      "Selecione",
      "1 - Normal",
      "1 - Saída",
      "0 - Não",
      "Sim",
      "Não",
      "SP",
      "RJ",
      "MG",
      "Produção",
      "Homologação (Teste)",
      "1 - Operação presencial",
      "2 - Boleto Bancário",
      "001 - À Vista",
    ]),
  ).filter(Boolean);
  const resolvedOptions = options?.length
    ? options
    : fallbackOptions.map((option) => ({ value: option, label: option }));

  return (
    <div
      className={cn(
        "flex h-8 min-w-0 items-center justify-between rounded-md border border-[#d6dee9] bg-white px-3 text-[12px] font-medium text-[#0f172a]",
        muted && "text-[#64748b]",
      )}
    >
      <select
        className="min-w-0 flex-1 appearance-none bg-transparent outline-none"
        value={onChange ? value : undefined}
        defaultValue={onChange ? undefined : value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {resolvedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-[#64748b]" />
    </div>
  );
}

function TextAreaControl({
  value,
  placeholder,
  counter,
  short,
  onChange,
}: {
  value?: string;
  placeholder?: string;
  counter?: string;
  short?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className={cn("relative rounded-md border border-[#d6dee9] bg-white", short ? "h-[66px]" : "h-[92px]")}>
      <textarea
        className="h-full w-full resize-none rounded-md bg-transparent p-3 pr-12 text-[12px] leading-5 text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
        value={value ?? ""}
        placeholder={placeholder}
        readOnly={!onChange}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {counter && <span className="absolute bottom-2 right-2 text-[11px] text-[#64748b]">{counter}</span>}
    </div>
  );
}

function Segmented({
  options,
  active,
}: {
  options: string[];
  active: string;
}) {
  const [selected, setSelected] = useState(active);

  return (
    <div className="flex h-8 overflow-hidden rounded-md border border-[#d6dee9] bg-white text-[12px] font-bold">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setSelected(option)}
          className={cn(
            "flex-1 px-3",
            option === selected ? "bg-[#d7f35a] text-[#0f172a]" : "bg-white text-[#334155]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function FormTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-4 text-[15px] font-extrabold text-[#0f172a]">{children}</h3>;
}

function FooterNav({
  left,
  right,
  middle,
  onLeft,
  onRight,
  leftIcon: LeftIcon = ArrowLeft,
  rightIcon = ArrowRight,
  middleIcon: MiddleIcon,
}: {
  left?: string;
  right?: string;
  middle?: string;
  onLeft?: () => void;
  onRight?: () => void;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  middleIcon?: LucideIcon;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e5eaf1] pt-4">
      {left ? (
        <ActionButton icon={LeftIcon} onClick={onLeft}>{left}</ActionButton>
      ) : <span />}
      <div className="ml-auto flex items-center gap-3">
        {middle && <PrimaryButton icon={MiddleIcon}>{middle}</PrimaryButton>}
        {right && <PrimaryButton icon={rightIcon} onClick={onRight}>{right}</PrimaryButton>}
      </div>
    </div>
  );
}

function RowsCard({
  title,
  rows,
  compact,
}: {
  title: string;
  rows: Row[];
  compact?: boolean;
}) {
  return (
    <Panel title={title} dense>
      <Rows rows={rows} compact={compact} />
    </Panel>
  );
}

function Rows({ rows, compact }: { rows: Row[]; compact?: boolean }) {
  return (
    <div className="space-y-0.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            "flex items-start justify-between gap-4 py-2 text-[12px]",
            row.strong && "pt-4 text-[14px] font-extrabold",
            compact && "py-1.5",
          )}
        >
          <span className="text-[#334155]">{row.label}</span>
          <span className={cn("max-w-[55%] text-right font-medium text-[#0f172a]", row.strong && "font-extrabold", row.green && "text-[#166a00]")}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniTotalCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<[string, string]>;
  total?: [string, string];
}) {
  return (
    <div className="min-h-[156px] rounded-lg border border-[#dfe5ee] p-4">
      <h3 className="mb-4 text-[15px] font-extrabold">{title}</h3>
      <div className="space-y-3">
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`} className={cn("flex justify-between gap-4 text-[12px]", index === 2 && total && "border-t border-[#e5eaf1] pt-3")}>
            <span className="text-[#334155]">{label}</span>
            <span className="text-right font-semibold">{value}</span>
          </div>
        ))}
        {total && (
          <div className="flex justify-between gap-4 border-t border-[#e5eaf1] pt-3 text-[15px] font-extrabold text-[#166a00]">
            <span>{total[0]}</span>
            <span>{total[1]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemsTable({
  expanded,
  items,
  onDelete,
}: {
  expanded?: boolean;
  items?: NfeItem[];
  onDelete?: (itemId: string) => void;
}) {
  const rows = items
    ? items.map((item) => ({
        id: item.id,
        no: String(item.itemNumber),
        code: item.productCode || "",
        description: item.description,
        detail: item.ean ? `EAN: ${item.ean}` : "",
        ncm: [item.ncm, item.cest].filter(Boolean).join(" / "),
        cfop: item.cfop || "",
        unit: item.unidade,
        qty: formatNumber(item.quantidade, 4),
        unitValue: formatNumber(item.valorUnitario, 2),
        discount: formatNumber(item.descontoValor, 2),
        total: formatNumber(item.valorTotal, 2),
        cst: item.cst || item.csosn || "",
        origin: item.origem != null ? String(item.origem) : "",
        raw: item,
      }))
    : fiscalItems.map((item) => ({ id: item.code, ...item, raw: null as NfeItem | null }));
  return (
    <div className={cn(panelClass, "overflow-hidden")}>
      <table className="w-full text-left text-[11px]">
        <thead className="bg-[#f8fafc] text-[#0f172a]">
          <tr>
            {["#", "Código", "Descrição do Produto / Serviço", "NCM / CEST", "CFOP", "Un.", "Qtd.", "Vlr. Unit.", "Desc.", "Vlr. Total", "CST/CSOSN", "Origem", "Ações"].map((head) => (
              <th key={head} className="border-b border-[#e5eaf1] px-3 py-3 font-extrabold">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={13} className="px-3 py-6 text-center text-[12px] font-semibold text-[#64748b]">
                Nenhum item incluido nesta NF-e.
              </td>
            </tr>
          )}
          {rows.map((item, index) => (
            <>
              <tr key={item.id} className="border-b border-[#e5eaf1] align-top">
                <td className="px-3 py-4 font-bold">{item.no}</td>
                <td className="px-3 py-4 font-bold">{item.code}</td>
                <td className="px-3 py-4">
                  <div className="font-bold">{item.description}</div>
                  <div className="text-[10px] text-[#64748b]">{item.detail}</div>
                </td>
                <td className="px-3 py-4">{item.ncm}</td>
                <td className="px-3 py-4">{item.cfop}</td>
                <td className="px-3 py-4">{item.unit}</td>
                <td className="px-3 py-4">{item.qty}</td>
                <td className="px-3 py-4">{item.unitValue}</td>
                <td className="px-3 py-4">{item.discount}</td>
                <td className="px-3 py-4 font-bold">{item.total}</td>
                <td className="px-3 py-4"><span className="rounded border border-[#8ac77e] bg-[#f4fbef] px-2 py-1 text-[#166a00]">{item.cst}</span></td>
                <td className="px-3 py-4">{item.origin}</td>
                <td className="px-3 py-4"><TableActions expanded={index === 0} onDelete={onDelete ? () => onDelete(item.id) : undefined} /></td>
              </tr>
              {expanded && index === 0 && (
                <tr key={`${item.id}-details`} className="border-b border-[#e5eaf1]">
                  <td colSpan={13} className="px-4 pb-4">
                    <div className="grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4 text-[12px] md:grid-cols-3">
                      <Rows compact rows={[
                        { label: "CST/CSOSN:", value: "00 - Tributada integralmente" },
                        { label: "Origem:", value: "0 - Nacional, exceto as indicadas nos códigos 3 a 5" },
                        { label: "NCM:", value: "1234.56.78" },
                        { label: "CEST:", value: "17.001.00" },
                        { label: "EAN:", value: "7891234567890" },
                        { label: "Peso Bruto:", value: "2,5000" },
                        { label: "Peso Líquido:", value: "2,0000" },
                      ]} />
                      <Rows compact rows={[
                        { label: "BC ICMS:", value: "1.000,00" },
                        { label: "Alíquota ICMS:", value: "18,00 %" },
                        { label: "Valor ICMS:", value: "180,00" },
                        { label: "BC IPI:", value: "1.000,00" },
                        { label: "Alíquota IPI:", value: "5,00 %" },
                        { label: "Valor IPI:", value: "50,00" },
                      ]} />
                      <Rows compact rows={[
                        { label: "BC PIS:", value: "1.000,00" },
                        { label: "Alíquota PIS:", value: "1,65 %" },
                        { label: "Valor PIS:", value: "16,50" },
                        { label: "BC COFINS:", value: "1.000,00" },
                        { label: "Alíquota COFINS:", value: "7,60 %" },
                        { label: "Valor COFINS:", value: "76,00" },
                      ]} />
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableActions({ expanded, onDelete }: { expanded?: boolean; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconSquare icon={Edit2} />
      <IconSquare icon={Copy} />
      <IconSquare icon={Trash2} onClick={onDelete} />
      <ChevronDown className={cn("h-4 w-4 text-[#0f172a]", expanded && "rotate-180")} />
    </div>
  );
}

function IconSquare({ icon: Icon, onClick }: { icon: LucideIcon; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md border border-[#d6dee9] bg-white">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ProcessCard() {
  return (
    <Panel title="Próximos Passos" dense>
      <div className="relative space-y-3">
        {[
          ["1. Verifique os dados da nota", "done"],
          ["2. Adicione os itens da nota", "active"],
          ["3. Confira os totais", "idle"],
          ["4. Transmita a NF-e", "idle"],
        ].map(([label, state], index) => (
          <div key={label} className={cn("flex items-center gap-3 rounded-md px-2 py-2 text-[12px]", state === "active" && "bg-[#dcecff] text-[#0b5fc6]")}>
            <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold", state === "done" ? "bg-[#26ad3f] text-white" : state === "active" ? "bg-[#2b7de9] text-white" : "bg-[#e5eaf1] text-[#64748b]")}>
              {state === "done" ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className="font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-md border border-[#9ccc8c] bg-[#f4fbef] px-3 py-3 text-[12px] font-semibold text-[#166a00]">
      <Info className="h-4 w-4" />
      {text}
    </div>
  );
}

function QuickActions({
  title,
  actions,
  mutedIcons,
}: {
  title: string;
  actions: Array<[string, string, LucideIcon]>;
  mutedIcons?: boolean;
}) {
  return (
    <Panel title={title} dense>
      <div className="space-y-3">
        {actions.map(([label, description, Icon]) => (
          <button key={label} className="flex w-full items-start gap-3 text-left">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", mutedIcons ? "bg-[#eef6ff] text-[#1d7ef2]" : "bg-[#f1f5f9] text-[#0f172a]")}>
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className={cn("block text-[12px] font-extrabold", label === "Cancelar NF-e" && "text-[#e11d48]")}>{label}</span>
              {description && <span className="block text-[11px] leading-4 text-[#475569]">{description}</span>}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ProgressCard() {
  const steps = [
    ["1. Preparando Transmissão", "Validando dados e preparando arquivos", "25/06/2026 15:31:22", "done"],
    ["2. Transmitindo para SEFAZ", "Enviando NF-e para a SEFAZ", "Aguardando...", "active"],
    ["3. Processando SEFAZ", "SEFAZ está processando a nota", "Aguardando...", "idle"],
    ["4. Retorno da SEFAZ", "Aguardando retorno da SEFAZ", "Aguardando...", "idle"],
    ["5. Autorização", "NF-e autorizada com sucesso", "Aguardando...", "idle"],
  ];

  return (
    <Panel title="Progresso da Transmissão" subtitle="Acompanhe o status da transmissão em tempo real." dense>
      <div className="relative space-y-1">
        <div className="absolute bottom-8 left-[13px] top-8 w-px bg-[#d6dee9]" />
        {steps.map(([label, description, time, state], index) => (
          <div key={label} className={cn("relative flex gap-3 rounded-md p-3 text-[12px]", state === "active" && "bg-[#e8f2ff]")}>
            <span className={cn("z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold", state === "done" ? "bg-[#35ad45] text-white" : state === "active" ? "bg-[#2b7de9] text-white" : "bg-[#e5eaf1] text-[#64748b]")}>
              {state === "done" ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block font-extrabold", state === "active" && "text-[#0b5fc6]")}>{label}</span>
              <span className="block text-[#475569]">{description}</span>
            </span>
            <span className="text-right text-[11px] text-[#475569]">{time}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SuccessBanner({ compact }: { compact?: boolean }) {
  return (
    <div className={cn(panelClass, "border-[#86c97c] bg-[#fbfff8] p-5")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("grid rounded-full bg-[#2ea736] text-white", compact ? "h-7 w-7" : "h-12 w-12")}>
            <Check className={cn("place-self-center", compact ? "h-5 w-5" : "h-8 w-8")} />
          </div>
          <div>
            <h2 className={cn("font-extrabold text-[#166a00]", compact ? "text-[17px]" : "text-[22px]")}>
              NF-e Autorizada com Sucesso!
            </h2>
            <p className="mt-1 text-[13px] text-[#166a00]">A nota fiscal eletrônica foi autorizada pela SEFAZ com sucesso.</p>
          </div>
        </div>
        <ActionButton icon={ExternalLink}>Visualizar DANFE</ActionButton>
      </div>
      <div className="mt-5 grid gap-4 text-[12px] md:grid-cols-4">
        <KeyValue title="Chave de Acesso" value="3526 0612 3456 7800 0190 5500 1000 1234 5610 0012 3456" />
        <KeyValue title="Protocolo de Autorização" value="135260000123456" />
        <KeyValue title="Data/Hora da Autorização" value="26/06/2026 15:42:18" />
        <KeyValue title="Ambiente" value="1 - Produção" />
      </div>
    </div>
  );
}

function KeyValue({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#334155]">{title}</div>
      <div className="mt-2 break-words text-[12px] font-extrabold text-[#0f172a]">{value}</div>
    </div>
  );
}

function InvoiceSummaryCard() {
  return (
    <RowsCard
      title="Resumo da Nota Fiscal"
      rows={[
        { label: "Modelo", value: "55 - NF-e" },
        { label: "Série / Número", value: "1 / 000.123.456" },
        { label: "Data de Emissão", value: "26/06/2026 15:30:00" },
        { label: "Natureza da Operação", value: "5102 - Venda de mercadoria adquirida ou recebida de terceiros" },
        { label: "Tipo de Operação", value: "1 - Saída" },
        { label: "Finalidade", value: "1 - Normal" },
        { label: "Forma de Emissão", value: "1 - Normal" },
        { label: "Ambiente", value: "Produção" },
        { label: "Processo / Pedido", value: "12345/2026" },
        { label: "Valor Total da Nota", value: "R$ 10.300,00", strong: true, green: true },
      ]}
      compact
    />
  );
}

function AuthorizationInfoCard({ title, badge }: { title: string; badge: string }) {
  return (
    <Panel
      title={title}
      actions={<span className="rounded-md border border-[#9ccc8c] bg-[#f4fbef] px-3 py-1 text-[12px] font-extrabold text-[#166a00]">{badge}</span>}
      dense
    >
      <div className="grid gap-4 md:grid-cols-3">
        <KeyValue title="cStat" value="100" />
        <KeyValue title="Descrição do cStat" value="Autorizado o uso da NF-e" />
        <KeyValue title="Protocolo de Autorização" value="135260000123456" />
        <KeyValue title="Data/Hora da Autorização" value="26/06/2026 15:42:18" />
        <KeyValue title="Versão do Protocolo" value="4.00" />
        <KeyValue title="Tempo de Resposta" value="3,842 segundos" />
        <KeyValue title="Ambiente SEFAZ" value="1 - Produção" />
        <KeyValue title="Código da Mensagem" value="100" />
        <KeyValue title="UF" value="SP - São Paulo" />
        <KeyValue title="Descrição da Mensagem" value="Autorizado o uso da NF-e" />
      </div>
    </Panel>
  );
}

function FilesCard({ title }: { title: string }) {
  return (
    <Panel title={title} subtitle="Documentos relacionados à NF-e autorizada." dense>
      <table className="w-full text-left text-[12px]">
        <thead className="bg-[#f8fafc]">
          <tr>{["Documento", "Descrição", "Arquivo", "Data/Hora", "Tamanho", "Ações"].map((head) => <th key={head} className="border-y border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>)}</tr>
        </thead>
        <tbody>
          {filesRows.map((row) => (
            <tr key={row[0]} className="border-b border-[#e5eaf1]">
              {row.map((cell, index) => (
                <td key={cell} className={cn("px-3 py-2", index === 2 && "font-bold text-[#0066d9]")}>{cell}</td>
              ))}
              <td className="px-3 py-2">
                <div className="flex gap-1"><IconSquare icon={Eye} /><IconSquare icon={Download} /></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function SefazLogCard() {
  return (
    <Panel title="Log da SEFAZ" subtitle="Histórico completo do processamento da NF-e na SEFAZ." dense>
      <table className="w-full text-left text-[12px]">
        <thead className="bg-[#f8fafc]">
          <tr>{["Data/Hora", "Etapa", "cStat", "Descrição", "Tempo"].map((head) => <th key={head} className="border-y border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>)}</tr>
        </thead>
        <tbody>
          {sefazLogRows.map((row) => (
            <tr key={`${row[0]}-${row[1]}`} className="border-b border-[#e5eaf1]">
              <td className="px-3 py-2">{row[0]}</td>
              <td className="px-3 py-2">{row[1]}</td>
              <td className="px-3 py-2">
                <span className={cn("rounded border px-2 py-0.5 font-bold", row[2] === "100" ? "border-[#9ccc8c] bg-[#f4fbef] text-[#166a00]" : "border-[#a9cdfd] bg-[#eef6ff] text-[#0b5fc6]")}>{row[2]}</span>
              </td>
              <td className="px-3 py-2">{row[3]}</td>
              <td className="px-3 py-2">{row[4]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function StatusProcessCard({ compact }: { compact?: boolean }) {
  const rows = compact
    ? [
        ["NF-e Transmitida", "26/06/2026 15:31:28"],
        ["SEFAZ - Em Processamento", "26/06/2026 15:31:28"],
        ["NF-e Autorizada", "26/06/2026 15:42:18"],
      ]
    : [
        ["1. Dados da Nota", "26/06/2026 15:28:10"],
        ["2. Itens", "26/06/2026 15:29:05"],
        ["3. Totais", "26/06/2026 15:29:20"],
        ["4. Transportador", "26/06/2026 15:29:45"],
        ["5. Cobrança", "26/06/2026 15:29:58"],
        ["6. Observações", "26/06/2026 15:30:12"],
        ["7. Emitir NF-e", "26/06/2026 15:30:30"],
        ["8. Transmitir NF-e", "26/06/2026 15:31:28"],
        ["9. Retorno da SEFAZ", "26/06/2026 15:31:30"],
        ["10. NF-e Autorizada", "26/06/2026 15:42:18"],
      ];

  return (
    <Panel title="Status do Processo" dense>
      <div className="relative space-y-1">
        <div className="absolute bottom-5 left-[13px] top-5 w-px bg-[#84c780]" />
        {rows.map(([label, time], index) => {
          const last = index === rows.length - 1;
          return (
            <div key={label} className={cn("relative flex items-center gap-3 rounded-md px-2 py-2 text-[12px]", last && "bg-[#eef8e9] text-[#166a00]")}>
              <span className="z-10 grid h-7 w-7 place-items-center rounded-full bg-[#35ad45] text-white"><Check className="h-4 w-4" /></span>
              <span className="flex-1 font-extrabold">{label}</span>
              <span className="text-right text-[11px] text-[#475569]">{time}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function DanfeDocument() {
  return (
    <div className="overflow-auto rounded-md bg-[#e5e7eb] p-3">
      <div className="mx-auto w-[920px] bg-white p-3 text-black shadow-sm">
        <div className="grid grid-cols-[1fr_180px] border border-black text-[10px]">
          <div className="border-r border-black">
            <div className="border-b border-black p-2">RECEBEMOS DE EMPRESA EXEMPLO LTDA OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</div>
            <div className="grid grid-cols-[140px_1fr]">
              <div className="border-r border-black p-2">DATA DE RECEBIMENTO</div>
              <div className="p-2">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
            </div>
          </div>
          <div className="grid place-items-center p-2 text-center">
            <div className="text-2xl font-black">NF-e</div>
            <div className="text-lg">Nº 000.123.456</div>
            <div className="text-lg font-bold">SÉRIE 1</div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[1.35fr_0.75fr_1.4fr] border border-black text-[10px]">
          <div className="flex items-center gap-5 border-r border-black p-4">
            <div className="grid h-24 w-24 place-items-center rounded-lg bg-gradient-to-br from-[#0d5a3a] to-[#edf7d2] text-5xl font-black text-white">NS</div>
            <div>
              <div className="text-xl font-black">EMPRESA EXEMPLO LTDA</div>
              <div className="mt-2 leading-5">RUA DAS FLORES, 123 - SALA 01<br />CENTRO - 01234-567<br />SÃO PAULO - SP<br />Fone: (11) 3333-4444</div>
            </div>
          </div>
          <div className="border-r border-black p-3 text-center">
            <div className="text-2xl font-black">DANFE</div>
            <div className="font-bold">DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA</div>
            <div className="mt-3">0 - ENTRADA<br />1 - SAÍDA <span className="ml-2 border border-black px-2 py-1 text-lg">1</span></div>
            <div className="mt-3 text-lg font-black">Nº 000.123.456<br />SÉRIE 1</div>
          </div>
          <div>
            <div className="grid h-20 place-items-center border-b border-black p-2">
              <div className="h-14 w-[330px] bg-[repeating-linear-gradient(90deg,#000_0,#000_2px,#fff_2px,#fff_4px,#000_4px,#000_5px,#fff_5px,#fff_8px)]" />
            </div>
            <div className="border-b border-black p-2">
              <div>CHAVE DE ACESSO</div>
              <div className="text-[13px] font-black">3526 0612 3456 7800 0190 5500 1000 1234 5610 0012 3456</div>
            </div>
            <div className="p-2 text-center leading-4">Consulta de autenticidade no portal nacional da NF-e<br />www.nfe.fazenda.gov.br/portal</div>
          </div>
        </div>

        <DanfeGrid
          rows={[
            ["NATUREZA DA OPERAÇÃO", "5102 - VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS", "PROTOCOLO DE AUTORIZAÇÃO DE USO", "135260000123456  -  26/06/2026 15:42:18"],
            ["INSCRIÇÃO ESTADUAL", "123.456.789.111", "CNPJ", "12.345.678/0001-90"],
          ]}
        />
        <DanfeSection title="DESTINATÁRIO / REMETENTE" cells={[
          ["NOME / RAZÃO SOCIAL", "CLIENTE EXEMPLO LTDA"],
          ["CNPJ / CPF", "98.765.432/0001-10"],
          ["DATA DA EMISSÃO", "26/06/2026"],
          ["ENDEREÇO", "AVENIDA BRASIL, 1000"],
          ["BAIRRO / DISTRITO", "VILA NOVA"],
          ["CEP", "04567-890"],
          ["MUNICÍPIO", "SÃO PAULO"],
          ["UF", "SP"],
          ["INSCRIÇÃO ESTADUAL", "987.654.321.111"],
          ["HORA DA SAÍDA", "15:30:00"],
        ]} />
        <DanfeSection title="FATURA / DUPLICATA" cells={[
          ["001", "25/07/2026"],
          ["VALOR", "R$ 10.300,00"],
        ]} />
        <DanfeSection title="CÁLCULO DO IMPOSTO" cells={[
          ["BASE DE CÁLCULO DO ICMS", "9.500,00"],
          ["VALOR DO ICMS", "1.710,00"],
          ["BASE CÁLC. ICMS SUBST.", "0,00"],
          ["VALOR DO ICMS SUBST.", "0,00"],
          ["VALOR TOTAL DOS PRODUTOS", "10.400,00"],
          ["VALOR DO FRETE", "0,00"],
          ["VALOR DO SEGURO", "0,00"],
          ["DESCONTO", "100,00"],
          ["OUTRAS DESP. ACESS.", "0,00"],
          ["VALOR DO IPI", "300,00"],
          ["VALOR TOTAL DA NOTA", "10.300,00"],
        ]} />
        <DanfeSection title="TRANSPORTADOR / VOLUMES TRANSPORTADOS" cells={[
          ["RAZÃO SOCIAL", "TRANS EXEMPLO TRANSPORTES LTDA"],
          ["FRETE POR CONTA", "0 - EMITENTE"],
          ["CÓDIGO ANTT", "12345678"],
          ["PLACA DO VEÍCULO", "ABC1D23"],
          ["UF", "SP"],
          ["CNPJ / CPF", "11.222.333/0001-44"],
          ["ENDEREÇO", "ROD. ANCHIETA, KM 23"],
          ["MUNICÍPIO", "SÃO BERNARDO DO CAMPO"],
          ["UF", "SP"],
          ["INSCRIÇÃO ESTADUAL", "111.222.333.444"],
          ["QUANTIDADE", "10"],
          ["ESPÉCIE", "VOLUMES"],
          ["PESO BRUTO", "100,000"],
          ["PESO LÍQUIDO", "90,000"],
        ]} />
      </div>
    </div>
  );
}

function DanfeGrid({ rows }: { rows: string[][] }) {
  return (
    <div className="mt-2 border border-black text-[10px]">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-4 border-b border-black last:border-b-0">
          {row.map((cell, cellIndex) => (
            <div key={`${index}-${cellIndex}`} className="border-r border-black p-2 last:border-r-0">
              <div className={cn(cellIndex % 2 === 0 ? "text-[9px]" : "font-bold")}>{cell}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DanfeSection({ title, cells }: { title: string; cells: Array<[string, string]> }) {
  return (
    <div className="mt-2 border border-black text-[10px]">
      <div className="border-b border-black px-2 py-1 font-black">{title}</div>
      <div className="grid grid-cols-5">
        {cells.map(([label, value], index) => (
          <div key={`${label}-${index}`} className="min-h-12 border-b border-r border-black p-2">
            <div className="text-[8px]">{label}</div>
            <div className="mt-1 text-[13px] font-bold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
