"use client";

import { type LucideIcon, AlertTriangle, ArrowLeft, ArrowRight, Ban, Calendar, Check, CheckCircle2, ChevronDown, CircleDollarSign, Clock, Copy, Download, Edit2, Eye, ExternalLink, FileDown, FileText, Grid2X2, Info, ListChecks, MoreHorizontal, Package, Plus, Printer, RefreshCw, Save, Search, Send, ShieldCheck, Trash2, Truck } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { notify } from "@/components/toast-viewport";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import type { IntelligentClient } from "@/lib/client-types";
import type { NfeDocumentDetail, NfeItem, NfeTotal, NfeValidationIssue } from "@/lib/nfe-types";
import type { Cfop, Product } from "@/lib/product-types";
import type { Transportadora } from "@/lib/transportadora-types";
import {
  addNfeItem,
  applyNfeAutoFix,
  deleteNfeItem,
  getNfe,
  getNfeDanfe,
  getNfeXmlPreview,
  getNfeStatus,
  recalculateNfe,
  searchNfeCfops,
  searchNfeClients,
  searchNfeProducts,
  transmitNfe,
  updateNfe,
  updateNfeItem,
  updateNfeTransport,
  validateNfe,
  type NfeDanfeArtifact,
} from "@/lib/services/nfe-service";
import { listTransportadoras } from "@/lib/services/transportadora-service";

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

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

const POLLING_SEFAZ_STATUSES = new Set(["TRANSMITINDO", "PROCESSANDO_SEFAZ"]);
const FINAL_SEFAZ_STATUSES = new Set(["AUTORIZADA", "REJEITADA", "CANCELADA", "DENEGADA", "INUTILIZADA"]);

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

type LookupKind = "client" | "product" | "carrier";

type LookupResult = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  raw: IntelligentClient | Product | Transportadora;
};

function parseMoneyInput(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const cleaned = text.replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", ".")) || 0;
  }
  return Number(cleaned) || 0;
}

function mergeById<T extends { id: string }>(current: T[], next: T[]) {
  const index = new Map(current.map((item) => [item.id, item]));
  next.forEach((item) => {
    index.set(item.id, item);
  });
  return Array.from(index.values());
}

function buildItemFormFromItem(note: NfeDocumentDetail | null, item: NfeItem): ItemFormState {
  return {
    productId: item.productId || "",
    cfop: item.cfop || note?.cfop || "5102",
    quantity: String(item.quantidade ?? "1"),
    unitValue: String(item.valorUnitario ?? "0"),
    discountValue: String(item.descontoValor ?? "0"),
    cst: item.cst || "",
    csosn: item.csosn || "",
    origem: item.origem != null ? String(item.origem) : "0",
  };
}

function transportadoraLabel(transportadora: Transportadora) {
  return transportadora.razaoSocial || transportadora.nomeFantasia || transportadora.nome || "Transportadora";
}

function transportadoraDocument(transportadora: Transportadora) {
  return transportadora.cnpj || transportadora.cpf || "";
}

function openExternalUrl(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function downloadTextFile(filename: string, content: string, type = "application/xml;charset=utf-8") {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isMockUrl(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("mock://");
}

function getFileNameFromUrl(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.pop() || fallback;
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts.pop() || fallback;
  }
}

function downloadUrlFile(url: string, filename: string) {
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener noreferrer";
  link.click();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function base64ToBlob(base64: string, mimeType: string) {
  const normalized = base64.replace(/^data:[^;]+;base64,/, "");
  const binaryString = window.atob(normalized);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function htmlToBlob(html: string, mimeType = "text/html;charset=utf-8") {
  return new Blob([html], { type: mimeType });
}

function buildBoletoHtml(note: NfeDocumentDetail, details: Record<string, unknown>) {
  const nossoNumero = String(details.nossoNumero || details.nosso_numero || details.numeroDocumento || details.numero_documento || "-");
  const documento = String(details.numeroDocumento || details.numero_documento || note.numero || "-");
  const vencimento = String(details.vencimento || details.dueDate || "-");
  const linhaDigitavel = String(details.linhaDigitavel || details.linha_digitavel || "-");
  const codigoBarras = String(details.codigoBarras || details.codigo_barras || "-");
  const url = String(details.url || details.link || "");
  const valorNumerico = Number(details.valor || details.amount || note.totals?.valorTotal || 0);
  const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(valorNumerico) ? valorNumerico : 0);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Boleto ${escapeHtml(note.chaveAcesso || note.id)}</title>
    <style>
      body { margin: 0; background: #f4f7fb; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
      .sheet { max-width: 860px; margin: 24px auto; background: #fff; border: 1px solid #d6dee9; border-radius: 18px; overflow: hidden; }
      .hero { padding: 24px; background: linear-gradient(135deg, #0f172a, #7c3aed); color: #fff; }
      .hero h1 { margin: 0; font-size: 28px; }
      .hero p { margin: 8px 0 0; color: rgba(255,255,255,.88); font-size: 14px; }
      .content { padding: 24px; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .field { min-height: 82px; padding: 14px; border: 1px solid #e5eaf1; border-radius: 14px; background: #f8fafc; }
      .label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
      .value { margin-top: 8px; font-size: 14px; font-weight: 700; line-height: 1.5; word-break: break-word; }
      .full { grid-column: 1 / -1; }
      .footer { padding: 0 24px 24px; color: #64748b; font-size: 12px; }
      @media (max-width: 768px) {
        .sheet { margin: 0; border-radius: 0; min-height: 100vh; }
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="hero">
        <h1>Boleto da NF-e</h1>
        <p>NF-e ${escapeHtml(note.numero || "-")} · Série ${escapeHtml(note.serie || "-")} · Chave ${escapeHtml(note.chaveAcesso || note.id)}</p>
      </section>
      <section class="content">
        <div class="grid">
          <div class="field"><div class="label">Nosso número</div><div class="value">${escapeHtml(nossoNumero)}</div></div>
          <div class="field"><div class="label">Documento</div><div class="value">${escapeHtml(documento)}</div></div>
          <div class="field"><div class="label">Vencimento</div><div class="value">${escapeHtml(vencimento)}</div></div>
          <div class="field"><div class="label">Valor</div><div class="value">${escapeHtml(valor)}</div></div>
          <div class="field full"><div class="label">Linha digitável</div><div class="value">${escapeHtml(linhaDigitavel)}</div></div>
          <div class="field full"><div class="label">Código de barras</div><div class="value">${escapeHtml(codigoBarras)}</div></div>
          ${url ? `<div class="field full"><div class="label">URL / Referência</div><div class="value">${escapeHtml(url)}</div></div>` : ""}
        </div>
      </section>
      <div class="footer">Boleto mock gerado pela API de NF-e para visualização, download e impressão.</div>
    </main>
  </body>
</html>`;
}

function getNfeFilePreviewMeta(tipoInput: string) {
  const tipo = String(tipoInput || "").toUpperCase();

  if (tipo === "DANFE_MOCK" || tipo === "DANFE") {
    return {
      label: "DANFE",
      description: "Documento auxiliar da NF-e",
    };
  }

  if (tipo === "XML_AUTORIZADO") {
    return {
      label: "XML da NF-e",
      description: "XML autorizado da NF-e",
    };
  }

  if (tipo === "BOLETO_MOCK" || tipo === "BOLETO") {
    return {
      label: "Boleto",
      description: "Documento de cobrança gerado pela API",
    };
  }

  return {
    label: tipo.replace(/_/g, " "),
    description: "Arquivo gerado pela API",
  };
}

function openBlobFile(blob: Blob, filename: string, action: "view" | "download" | "print") {
  const objectUrl = URL.createObjectURL(blob);
  if (action === "view") {
    openExternalUrl(objectUrl);
  } else if (action === "download") {
    downloadUrlFile(objectUrl, filename);
  } else {
    const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
    opened?.focus();
    window.setTimeout(() => opened?.print?.(), 500);
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function openDanfeFromApi(note: NfeDocumentDetail, action: "view" | "download" | "print") {
  const response = await getNfeDanfe(note.id);
  const artifact: NfeDanfeArtifact = response.data;
  if (artifact.kind === "blob") {
    const fallbackName = `danfe-${note.chaveAcesso || note.id}.pdf`;
    openBlobFile(artifact.blob, artifact.fileName || fallbackName, action);
    notify({
      title: action === "view" ? "DANFE aberto" : action === "download" ? "Download iniciado" : "ImpressÃ£o preparada",
      description: artifact.message || "Arquivo binÃ¡rio preparado pela API.",
    });
    return;
  }

  if (artifact.kind === "html") {
    const fallbackName = `danfe-${note.chaveAcesso || note.id}.html`;
    const downloadName = artifact.fileName || fallbackName;
    if (action === "download") {
      downloadTextFile(downloadName, artifact.html, artifact.mimeType || "text/html;charset=utf-8");
      notify({
        title: "Download iniciado",
        description: artifact.message || "Arquivo HTML preparado pela API.",
      });
      return;
    }

    openBlobFile(htmlToBlob(artifact.html, artifact.mimeType || "text/html;charset=utf-8"), downloadName, action);
    notify({
      title: action === "view" ? "DANFE aberto" : "Impressão preparada",
      description: artifact.message || "Arquivo HTML preparado pela API.",
    });
    return;
  }

  const { url, storageKey, status, message, fileName, mimeType, base64, contentBase64 } = artifact;
  const downloadUrl = [url, storageKey].find((value) => value && !isMockUrl(value)) || null;
  const fallbackName = `danfe-${note.chaveAcesso || note.id}.pdf`;
  const downloadName = fileName || (downloadUrl ? getFileNameFromUrl(downloadUrl, fallbackName) : fallbackName);

  if (downloadUrl) {
    if (action === "view") {
      openExternalUrl(downloadUrl);
    } else if (action === "download") {
      downloadUrlFile(downloadUrl, downloadName);
    } else {
      const opened = window.open(downloadUrl, "_blank", "noopener,noreferrer");
      opened?.focus();
      window.setTimeout(() => opened?.print?.(), 500);
    }
    notify({
      title: action === "view" ? "DANFE aberto" : action === "download" ? "Download iniciado" : "Impressão preparada",
      description: message || `Arquivo ${status?.toLowerCase() || "disponível"} pela API.`,
    });
    return;
  }

  const inlineContent = base64 || contentBase64;
  if (inlineContent) {
    const blob = base64ToBlob(inlineContent, mimeType || "application/pdf");
    openBlobFile(blob, downloadName, action);
    notify({
      title: action === "view" ? "DANFE aberto" : action === "download" ? "Download iniciado" : "Impressão preparada",
      description: message || "Arquivo em base64 preparado pela API.",
    });
    return;
  }

  if (!url && !storageKey) {
    notify({
      title: "DANFE indisponível",
      description: message || "A API ainda não expôs um arquivo baixável nesta instância.",
      tone: "info",
    });
    return;
  }

  notify({
    title: "DANFE indisponível",
    description: message || "A API ainda não expôs um arquivo baixável nesta instância.",
    tone: "info",
  });
}

async function handleNfeFileAction(note: NfeDocumentDetail, file: { tipo: string; storageKey: string }, action: "view" | "download" | "print") {
  const tipo = String(file.tipo || "").toUpperCase();

  if (tipo === "XML_AUTORIZADO") {
    let xmlContent = note.xmlProtocolo || note.xmlTransmitido || note.xmlAssinado || note.xmlRetorno || "";
    let fileName = `nfe-${note.chaveAcesso || note.id}.xml`;
    let authorized = Boolean(xmlContent);
    if (!xmlContent) {
      try {
        const preview = await getNfeXmlPreview(note.id);
        xmlContent = preview.data.xml;
        fileName = preview.data.fileName;
        authorized = false;
      } catch (error) {
        notify({ title: "Não foi possível gerar o XML", description: error instanceof Error ? error.message : "Revise os dados fiscais do emitente.", tone: "error" });
        return;
      }
    }

    if (action === "download") {
      downloadTextFile(fileName, xmlContent);
      notify({ title: authorized ? "XML autorizado baixado" : "XML de conferência baixado", description: authorized ? "Arquivo autorizado preparado para download." : "Rascunho gerado sem assinatura e sem protocolo SEFAZ." });
      return;
    }

    if (action === "view" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(xmlContent);
      notify({ title: "XML assinado copiado", description: "Cole diretamente no validador, sem editar ou formatar o conteúdo." });
      return;
    }

    // Exibir como texto puro impede que o navegador indente o XML assinado.
    // Espaços inseridos dentro de infNFe alteram o digest e invalidam a assinatura.
    const blob = new Blob([xmlContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (action === "print") {
      window.setTimeout(() => opened?.print?.(), 500);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify({ title: authorized ? "XML autorizado aberto" : "XML assinado aberto", description: "Conteúdo exibido sem formatação para preservar a assinatura digital." });
    return;
  }

  if (tipo === "DANFE_MOCK" || tipo === "DANFE") {
    await openDanfeFromApi(note, action);
    return;
  }

  if (tipo === "BOLETO_MOCK" || tipo === "BOLETO") {
    const boletoLog = latestLog(note, ["nfe.boleto.mock.generated"]);
    const details = normalizeLogDetails(boletoLog?.details);
    const url = typeof details.url === "string" ? details.url : "";
    const hasRealUrl = url && !url.startsWith("mock://");
    const fallbackName = `boleto-nfe-${note.chaveAcesso || note.id}.html`;

    if (hasRealUrl) {
      if (action === "view") {
        openExternalUrl(url);
      } else if (action === "download") {
        downloadUrlFile(url, file.storageKey.split("/").pop() || fallbackName);
      } else {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        opened?.focus();
        window.setTimeout(() => opened?.print?.(), 500);
      }
      notify({
        title: action === "view" ? "Boleto aberto" : action === "download" ? "Download iniciado" : "Impressão preparada",
        description: typeof details.status === "string" ? `Boleto ${details.status.toLowerCase()}.` : "Boleto disponível.",
      });
      return;
    }

    const html = buildBoletoHtml(note, details);
    if (action === "download") {
      downloadTextFile(fallbackName, html, "text/html;charset=utf-8");
    } else {
      openBlobFile(htmlToBlob(html), fallbackName, action);
    }
    notify({
      title: action === "view" ? "Boleto aberto" : action === "download" ? "Download iniciado" : "Impressão preparada",
      description: "Boleto mock preparado pela API.",
    });
    return;
  }

  if (!file.storageKey || file.storageKey.startsWith("mock://")) {
    notify({ title: "Arquivo indisponível", description: "O storage ainda não expôs um link público para este arquivo.", tone: "info" });
    return;
  }

  if (action === "view") {
    openExternalUrl(file.storageKey);
  } else if (action === "download") {
    const link = window.document.createElement("a");
    link.href = file.storageKey;
    link.download = file.storageKey.split("/").pop() || `arquivo-${note.id}`;
    link.rel = "noopener noreferrer";
    link.click();
  } else {
    const opened = window.open(file.storageKey, "_blank", "noopener,noreferrer");
    opened?.focus();
    window.setTimeout(() => opened?.print?.(), 500);
  }
}

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

function formatDiscountCurrency(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return formatCurrency(0);
  return `- ${formatCurrency(number)}`;
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
    { label: "Descontos", value: formatDiscountCurrency(totals?.desconto) },
    { label: "Acrescimos", value: formatCurrency(Number(totals?.frete || 0) + Number(totals?.seguro || 0) + Number(totals?.outrasDespesas || 0)) },
    { label: "Valor Total da Nota", value: formatCurrency(totals?.valorTotal), strong: true, green: true },
  ];
}

function checkNfeTotals(note: NfeDocumentDetail) {
  const totals = note.totals;
  const value = (input: unknown) => Number(input || 0);
  const issues: string[] = [];
  const itemTotal = note.items.reduce((sum, item) => sum + value(item.valorTotal), 0);
  const productTotal = value(totals?.valorProdutos);
  const discount = value(totals?.desconto);
  const additions = value(totals?.frete) + value(totals?.seguro) + value(totals?.outrasDespesas);
  const expectedInvoiceTotal = productTotal - discount + additions + value(totals?.totalIpi) + value(totals?.totalIcmsSt);
  const baseFields = [totals?.totalIcmsBase, totals?.totalIcmsStBase, totals?.totalFcp];

  if (note.items.length === 0) issues.push("Inclua pelo menos um item antes de continuar.");
  if (!totals || Math.abs(itemTotal - productTotal) > 0.01) issues.push("O total dos produtos diverge dos itens do rascunho.");
  if (discount > productTotal + 0.01) issues.push("O desconto não pode ser maior que o subtotal dos produtos.");
  if (baseFields.some((field) => value(field) < 0) || additions < 0) issues.push("As bases tributárias e acréscimos não podem ser negativos.");
  if (value(totals?.valorTotal) <= 0) issues.push("O valor total da nota deve ser maior que zero.");
  if (totals && Math.abs(expectedInvoiceTotal - value(totals.valorTotal)) > 0.01) issues.push("O valor total não confere com os totais calculados.");

  return { issues };
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

const operationRows: Row[] = [
  { label: "Finalidade", value: "1 - Normal" },
  { label: "Natureza da Operação", value: "VENDA DE MERCADORIA" },
  { label: "Tipo de Operação", value: "1 - Saída" },
  { label: "Forma de Emissão", value: "1 - Normal" },
  { label: "Ambiente", value: "1 - Produção" },
];

export function EmitirNotaView({
  nfeId,
  initialProductId,
  initialNote = null,
  initialCfops = [],
  initialClients = [],
  initialProducts = [],
}: {
  nfeId: string;
  initialProductId?: string;
  initialNote?: NfeDocumentDetail | null;
  initialCfops?: Cfop[];
  initialClients?: IntelligentClient[];
  initialProducts?: Product[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [note, setNote] = useState<NfeDocumentDetail | null>(() => initialNote);
  const [noteForm, setNoteForm] = useState<NoteFormState>(() => buildNoteForm(initialNote));
  const [itemForm, setItemForm] = useState<ItemFormState>(() => emptyItemForm(initialNote));
  const [cfops, setCfops] = useState<Cfop[]>(() => initialCfops);
  const [clients, setClients] = useState<IntelligentClient[]>(() => initialClients);
  const [products, setProducts] = useState<Product[]>(() => initialProducts);
  const [loading, setLoading] = useState(() => !initialNote);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const reloadNoteRef = useRef<null | (() => Promise<NfeDocumentDetail>)>(null);
  const initialProductAppliedRef = useRef(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupKind, setLookupKind] = useState<LookupKind>("client");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function reloadNote() {
    const response = await getNfe(nfeId);
    setNote(response.data);
    setNoteForm(buildNoteForm(response.data));
    setItemForm(emptyItemForm(response.data));
    return response.data;
  }

  reloadNoteRef.current = reloadNote;
  const noteId = note?.id;
  const noteStatus = note?.status;

  function openLookup(kind: LookupKind) {
    setLookupKind(kind);
    setLookupQuery("");
    setLookupResults([]);
    setLookupError(null);
    setLookupOpen(true);
  }

  function closeLookup() {
    setLookupOpen(false);
    setLookupLoading(false);
    setLookupError(null);
  }

  async function searchLookup() {
    const query = lookupQuery.trim();
    if (!query) {
      setLookupError("Digite um termo para pesquisar.");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);

    try {
      if (lookupKind === "client") {
        const rows = await searchNfeClients(query, 20);
        setClients((current) => mergeById(current, rows));
        setLookupResults(rows.map((client) => ({
          id: client.id,
          title: clientName(client) || "Cliente sem nome",
          subtitle: client.cnpj || client.cpf ? formatDocument(client.cnpj || client.cpf) : "Sem documento",
          meta: client.email || client.uf || "Cliente cadastrado",
          raw: client,
        })));
        return;
      }

      if (lookupKind === "product") {
        const rows = await searchNfeProducts(query, 20);
        setProducts((current) => mergeById(current, rows));
        setLookupResults(rows.map((product) => ({
          id: product.id,
          title: productLabel(product),
          subtitle: [product.ncm, product.cfopPreferencial].filter(Boolean).join(" · ") || "Sem NCM/CFOP preferencial",
          meta: product.unit ? `Unidade ${product.unit}` : "Produto cadastrado",
          raw: product,
        })));
        return;
      }

      const rows = await listTransportadoras(query);
      setLookupResults(rows.map((transportadora) => ({
        id: transportadora.id,
        title: transportadoraLabel(transportadora),
        subtitle: transportadoraDocument(transportadora) || transportadora.rntrc || "Transportadora cadastrada",
        meta: [transportadora.municipio, transportadora.uf].filter(Boolean).join(" · ") || "Sem localização",
        raw: transportadora,
      })));
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Nao foi possivel concluir a busca.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function selectLookupResult(result: LookupResult) {
    if (!note) return;

    try {
      if (lookupKind === "client") {
        const client = result.raw as IntelligentClient;
        setNoteForm((current) => ({ ...current, destinatarioId: client.id }));
        setMessage(`Cliente ${clientName(client)} selecionado.`);
        closeLookup();
        return;
      }

      if (lookupKind === "product") {
        const product = result.raw as Product;
        setProducts((current) => mergeById(current, [product]));
        setItemForm((current) => ({
          ...current,
          productId: product.id,
          cfop: product.cfopPreferencial || note.cfop || current.cfop,
          unitValue: product.price != null ? String(product.price) : current.unitValue,
          cst: product.cstCsosnPadrao && product.cstCsosnPadrao.length <= 2 ? product.cstCsosnPadrao : current.cst,
          csosn: product.cstCsosnPadrao && product.cstCsosnPadrao.length > 2 ? product.cstCsosnPadrao : current.csosn,
          origem: product.origemMercadoria != null ? String(product.origemMercadoria) : current.origem,
        }));
        setEditingItemId(null);
        setStep(2);
        setMessage(`Produto ${productLabel(product)} carregado no item.`);
        closeLookup();
        return;
      }

      const transportadora = result.raw as Transportadora;
      await updateNfeTransport(note.id, {
        transportadoraId: transportadora.id,
        modalidadeFrete: note.transport?.modalidadeFrete || transportadora.modalidadeFrete || "9",
        cnpjTransportadora: transportadora.cnpj,
        nomeTransportadora: transportadoraLabel(transportadora),
        ieTransportadora: transportadora.inscricaoEstadual,
        enderecoTransportadora: [transportadora.logradouro, transportadora.numero, transportadora.complemento].filter(Boolean).join(", "),
        municipioTransportadora: transportadora.municipio,
        ufTransportadora: transportadora.uf,
        placaVeiculo: transportadora.placaVeiculo,
        ufPlaca: transportadora.ufPlaca,
        rntc: transportadora.rntrc,
      });
      await reloadNote();
      setMessage(`Transportadora ${transportadoraLabel(transportadora)} vinculada.`);
      closeLookup();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel aplicar a selecao.");
    }
  }

  useEffect(() => {
    if (initialNote) return;
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
  }, [nfeId, initialNote]);

  useEffect(() => {
    initialProductAppliedRef.current = false;
  }, [initialProductId, nfeId]);

  useEffect(() => {
    const status = normalizeStatusCode(noteStatus);
    if (!noteId || !POLLING_SEFAZ_STATUSES.has(status)) return;

    let active = true;
    let pending = false;

    const syncStatus = async () => {
      if (!active || pending) return;
      pending = true;
      try {
        await getNfeStatus(noteId);
        const refreshed = await reloadNoteRef.current?.();
        if (!active || !refreshed) return;

        const refreshedStatus = normalizeStatusCode(refreshed.status);
        if (refreshedStatus === "AUTORIZADA") {
          setStep((current) => (current < 10 ? 10 : current));
        } else if (FINAL_SEFAZ_STATUSES.has(refreshedStatus)) {
          setStep((current) => (current < 9 ? 9 : current));
        }
      } catch {
        // Best-effort polling only.
      } finally {
        pending = false;
      }
    };

    void syncStatus();
    const intervalId = window.setInterval(syncStatus, 3000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [noteId, noteStatus]);

  useEffect(() => {
    if (!initialProductId || initialProductAppliedRef.current || !products.length) return;
    const selectedProduct = products.find((product) => product.id === initialProductId);
    if (!selectedProduct) return;
    initialProductAppliedRef.current = true;
    setItemForm((current) => ({
      ...current,
      productId: selectedProduct.id,
      cfop: selectedProduct.cfopPreferencial || current.cfop,
      unitValue: selectedProduct.price != null ? String(selectedProduct.price) : current.unitValue,
      cst: selectedProduct.cstCsosnPadrao && selectedProduct.cstCsosnPadrao.length <= 2 ? selectedProduct.cstCsosnPadrao : current.cst,
      csosn: selectedProduct.cstCsosnPadrao && selectedProduct.cstCsosnPadrao.length > 2 ? selectedProduct.cstCsosnPadrao : current.csosn,
      origem: selectedProduct.origemMercadoria != null ? String(selectedProduct.origemMercadoria) : current.origem,
    }));
  }, [initialProductId, products]);

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
      if (current === 6) return 7;
      if (current === 7) return 8;
      if (current === 8) return 9;
      if (current === 9) return 10;
      if (current === 10) return 11;
      return 11;
    });
  }

  function finishEmission() {
    router.replace("/emitir-nota");
  }

  function goBack() {
    setStep((current) => {
      if (current === 11) return 10;
      if (current === 10) return 9;
      if (current === 9) return 8;
      if (current === 8) return 7;
      if (current === 7) return 6;
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
      await updateNfe(note.id, {
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
      await reloadNote();
      setMessage("Rascunho salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar a NF-e.");
      if (options.rethrow) throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!note) return null;
    setSaving(true);
    setError(null);
    try {
      await saveNoteForm({ rethrow: true });
      const response = await validateNfe(note.id);
      setMessage(response.message || "NF-e validada.");
      await reloadNote();
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel validar a NF-e.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalculateTotals() {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      const response = await recalculateNfe(note.id);
      setMessage(response.message || "Totais recalculados com sucesso.");
      await reloadNote();
      notify({ title: "Totais recalculados", description: "Os valores do rascunho foram atualizados." });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Não foi possível recalcular os totais.";
      setError(detail);
      notify({ title: "Falha ao recalcular", description: detail, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoFix() {
    if (!note) return null;
    setSaving(true);
    setError(null);
    try {
      await saveNoteForm({ rethrow: true });
      let totalCorrections = 0;
      let cycles = 0;
      for (; cycles < 5; cycles += 1) {
        const response = await applyNfeAutoFix(note.id);
        totalCorrections += response.corrections.length;
        if (response.corrections.length === 0 || response.canTransmit) break;
      }
      const validation = await validateNfe(note.id);
      if (totalCorrections > 0) {
        setMessage(
          validation.canTransmit
            ? `${totalCorrections} correção(ões) segura(s) aplicada(s) em ${Math.min(cycles + 1, 5)} ciclo(s). NF-e pronta para transmissão.`
            : `${totalCorrections} correção(ões) segura(s) aplicada(s). Revise as pendências que exigem decisão humana.`,
        );
      } else {
        setMessage(validation.message || "Nenhuma correção segura encontrada.");
      }
      await reloadNote();
      return validation;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel aplicar as correcoes seguras.");
      return null;
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
      const validation = await validateNfe(note.id);
      if (!validation.canTransmit) {
        setMessage(validation.message || "Corrija as pendencias antes de transmitir a NF-e.");
        await reloadNote();
        setStep(7);
        return;
      }
      const response = await transmitNfe(note.id);
      setMessage(response.message || "Transmissao iniciada.");
      const refreshed = await reloadNote();
      const refreshedStatus = normalizeStatusCode(refreshed.status);
      if (refreshedStatus === "AUTORIZADA") {
        setStep(10);
      } else if (POLLING_SEFAZ_STATUSES.has(refreshedStatus)) {
        setStep(9);
      } else {
        setStep(9);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel transmitir a NF-e.");
      await reloadNote().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem() {
    if (!note) return;
    const isEditing = Boolean(editingItemId);
    setSaving(true);
    setError(null);
    try {
      const payload = {
        productId: itemForm.productId,
        cfop: itemForm.cfop,
        quantity: itemForm.quantity,
        unitValue: itemForm.unitValue,
        discountValue: itemForm.discountValue,
        cst: itemForm.cst,
        csosn: itemForm.csosn,
        origem: itemForm.origem,
      };
      if (editingItemId) {
        await updateNfeItem(note.id, editingItemId, payload);
      } else {
        await addNfeItem(note.id, payload);
      }
      await reloadNote();
      setEditingItemId(null);
      setMessage(isEditing ? "Item atualizado." : "Item incluido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditing ? "Nao foi possivel atualizar o item." : "Nao foi possivel incluir o item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      await deleteNfeItem(note.id, itemId);
      await reloadNote();
      setMessage("Item removido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel remover o item.");
    } finally {
      setSaving(false);
    }
  }

  function handleEditItem(itemId: string) {
    const item = note?.items.find((current) => current.id === itemId);
    if (!item) return;
    setEditingItemId(itemId);
    setItemForm(buildItemFormFromItem(note, item));
    setStep(2);
    setMessage(`Item ${item.itemNumber} carregado para edição.`);
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }

  function handleCopyItem(itemId: string) {
    const item = note?.items.find((current) => current.id === itemId);
    if (!item) return;
    setEditingItemId(null);
    setItemForm(buildItemFormFromItem(note, item));
    setStep(2);
    setMessage(`Item ${item.itemNumber} copiado para novo lançamento.`);
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }

  function handleSearchClient() {
    openLookup("client");
  }

  function handleSearchProduct() {
    openLookup("product");
  }

  function handleSearchTransportadora() {
    openLookup("carrier");
  }

  async function handleClearTransport() {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      await updateNfeTransport(note.id, {
        transportadoraId: null,
        modalidadeFrete: "9",
        cnpjTransportadora: null,
        nomeTransportadora: null,
        ieTransportadora: null,
        enderecoTransportadora: null,
        municipioTransportadora: null,
        ufTransportadora: null,
        placaVeiculo: null,
        ufPlaca: null,
        rntc: null,
        volumes: [],
      });
      await reloadNote();
      setMessage("Dados de transporte limpos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel limpar os dados de transporte.");
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
      <div className="min-w-0 overflow-x-hidden border-b border-line bg-white px-4 py-3 md:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Stepper current={step} onSelect={(id) => setStep(normalizeStep(id))} />
          <TopActions
            note={note}
            step={step}
            setStep={setStep}
            saving={saving}
            onSave={saveNoteForm}
            onValidate={handleValidate}
            onAutoFix={handleAutoFix}
            onTransmit={handleTransmit}
          />
        </div>
      </div>
      <div ref={mainRef} className="min-w-0 overflow-x-clip py-4">
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
            onSearchClient={handleSearchClient}
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
            onEditItem={handleEditItem}
            onCopyItem={handleCopyItem}
            onSearchProduct={handleSearchProduct}
            editingItemId={editingItemId}
            goBack={goBack}
            goNext={goNext}
          />
        )}
        {step === 3 && note && <TotaisPage note={note} goBack={goBack} goNext={goNext} onRecalculate={handleRecalculateTotals} recalculating={saving} />}
        {step === 4 && note && <TransportePage note={note} goBack={goBack} goNext={goNext} onSearchTransportadora={handleSearchTransportadora} onClearTransport={handleClearTransport} />}
        {step === 5 && note && <CobrancaPage note={note} goBack={goBack} goNext={goNext} />}
        {step === 6 && <ObservacoesPage goBack={goBack} goNext={goNext} />}
        {step === 7 && note && (
          <ReviewPage
            note={note}
            goBack={goBack}
            goNext={goNext}
            onValidate={handleValidate}
            onAutoFix={handleAutoFix}
            onTransmit={handleTransmit}
          />
        )}
        {step === 8 && note && <TransmitirPage note={note} goBack={goBack} onTransmit={handleTransmit} />}
        {step === 9 && note && <RetornoSefazPage note={note} goBack={goBack} onFinish={finishEmission} />}
        {step === 10 && note && <AutorizacaoPage note={note} goBack={goBack} onFinish={finishEmission} />}
        {step === 11 && note && <DanfePage note={note} goBack={goBack} />}
      </div>
      <LookupDialog
        open={lookupOpen}
        kind={lookupKind}
        query={lookupQuery}
        loading={lookupLoading}
        error={lookupError}
        results={lookupResults}
        onClose={closeLookup}
        onQueryChange={setLookupQuery}
        onSearch={searchLookup}
        onSelect={selectLookupResult}
      />
    </>
  );
}

function normalizeStep(id: number): StepId {
  if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(id)) return id as StepId;
  return 1;
}



function getStepper(step: StepId): FlowStep[] {
  const base = [
    { id: 1, label: "Dados da Nota" },
    { id: 2, label: "Itens" },
    { id: 3, label: "Totais" },
    { id: 4, label: "Transportador" },
    { id: 5, label: "Cobrança" },
    { id: 6, label: "Observações" },
    { id: 7, label: "Revisão" },
  ];

  if (step <= 7) {
    return base;
  }

  return [
    ...base,
    { id: 8, label: "Transmitir NF-e" },
    { id: 9, label: "Retorno SEFAZ" },
    { id: 10, label: "Autorização" },
    { id: 11, label: "DANFE" },
  ];
}
function Stepper({ current, onSelect }: { current: StepId; onSelect: (id: number) => void }) {
  const steps = getStepper(current);
  const dense = steps.length > 7;
  return (
    <div className="min-w-0 overflow-x-auto">
      <div className={cn("flex min-w-max items-center", dense ? "gap-0.5" : "gap-1")}>
        {steps.map((item, index) => {
          const active = item.id === current;
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
                    current > item.id && "border-[#dbe3ec] bg-[#eef2f6]",
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
  note,
  step,
  setStep,
  saving,
  onSave,
  onValidate,
  onAutoFix,
  onTransmit,
}: {
  note?: NfeDocumentDetail | null;
  step: StepId;
  setStep: (step: StepId) => void;
  saving?: boolean;
  onSave: () => void;
  onValidate: () => void;
  onAutoFix: () => void;
  onTransmit: () => void;
}) {
  if (step === 7) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton icon={RefreshCw} onClick={onAutoFix}>Aplicar correções</ActionButton>
        <ActionButton icon={Check} onClick={onValidate}>Validar</ActionButton>
        <ActionButton icon={Save} onClick={onSave}>{saving ? "Salvando..." : "Salvar Rascunho"}</ActionButton>
        <PrimaryButton icon={Send} onClick={onTransmit}>{saving ? "Transmitindo..." : "Validar e transmitir"}</PrimaryButton>
        <IconButton icon={MoreHorizontal} title="Abrir XML autorizado" onClick={() => note && void handleNfeFileAction(note, { tipo: "XML_AUTORIZADO", storageKey: "" }, "view")} />
      </div>
    );
  }

  if (step === 9) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton
          icon={Copy}
          onClick={async () => {
            try {
              const protocol = note ? getPrimaryProtocol(note) : "";
              if (!protocol) {
                notify({ title: "Protocolo indisponível", description: "Ainda não há protocolo registrado para copiar.", tone: "info" });
                return;
              }
              await navigator.clipboard.writeText(protocol);
              notify({ title: "Protocolo copiado", description: protocol });
            } catch (err) {
              notify({
                title: "Não foi possível copiar",
                description: err instanceof Error ? err.message : "O navegador bloqueou o acesso à área de transferência.",
                tone: "error",
              });
            }
          }}
        >
          Copiar Protocolo
        </ActionButton>
        <ActionButton icon={ExternalLink} onClick={() => note && void openDanfeFromApi(note, "view")}>Abrir DANFE</ActionButton>
        <PrimaryButton icon={Download} onClick={() => note && void handleNfeFileAction(note, { tipo: "XML_AUTORIZADO", storageKey: "" }, "download")}>Download XML</PrimaryButton>
      </div>
    );
  }

  if (step === 10) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton icon={Printer} onClick={() => note && void openDanfeFromApi(note, "print")}>Imprimir DANFE</ActionButton>
        <PrimaryButton icon={Download} onClick={() => note && void handleNfeFileAction(note, { tipo: "XML_AUTORIZADO", storageKey: "" }, "download")}>Download XML</PrimaryButton>
      </div>
    );
  }

  if (step === 11) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton icon={Printer} onClick={() => note && void openDanfeFromApi(note, "print")}>Imprimir DANFE</ActionButton>
        <PrimaryButton icon={Download} onClick={() => note && void openDanfeFromApi(note, "download")}>Download DANFE</PrimaryButton>
        <IconButton icon={MoreHorizontal} title="Abrir XML autorizado" onClick={() => note && void handleNfeFileAction(note, { tipo: "XML_AUTORIZADO", storageKey: "" }, "view")} />
      </div>
    );
  }

  if (step === 8) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ActionButton icon={Eye} onClick={() => setStep(11)}>Pre-visualizar DANFE</ActionButton>
        <ActionButton icon={Save} onClick={onSave}>{saving ? "Salvando..." : "Salvar Rascunho"}</ActionButton>
        <PrimaryButton icon={Send} onClick={onTransmit}>{saving ? "Transmitindo..." : "Transmitir NF-e"}</PrimaryButton>
        <IconButton icon={MoreHorizontal} title="Abrir XML autorizado" onClick={() => note && void handleNfeFileAction(note, { tipo: "XML_AUTORIZADO", storageKey: "" }, "view")} />
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
      <IconButton icon={MoreHorizontal} title="Abrir XML autorizado" onClick={() => note && void handleNfeFileAction(note, { tipo: "XML_AUTORIZADO", storageKey: "" }, "view")} />
    </div>
  );
}

function IconButton({ icon: Icon, onClick, title }: { icon: LucideIcon; onClick?: () => void; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-md border border-[#d6dee9] bg-white text-[#0f172a] hover:bg-[#f8fafc]">
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
      type="button"
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
  disabled,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md bg-[#0d6900] px-3.5 text-[12px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-[#0b5700] disabled:cursor-not-allowed disabled:bg-[#9aaabd] disabled:text-white disabled:shadow-none",
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
  onSearchClient,
  goNext,
}: {
  note: NfeDocumentDetail;
  form: NoteFormState;
  setForm: (updater: (current: NoteFormState) => NoteFormState) => void;
  cfops: Cfop[];
  clients: IntelligentClient[];
  saving: boolean;
  onSave: () => void;
  onSearchClient: () => void;
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
                  <ActionButton icon={Search} onClick={onSearchClient}>Buscar Cliente</ActionButton>
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

function ItensPage({
  note,
  form,
  setForm,
  cfops,
  products,
  saving,
  onAddItem,
  onDeleteItem,
  onEditItem,
  onCopyItem,
  onSearchProduct,
  editingItemId,
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
  onEditItem: (itemId: string) => void;
  onCopyItem: (itemId: string) => void;
  onSearchProduct: () => void;
  editingItemId: string | null;
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
  const previewTotal = parseMoneyInput(form.quantity) * parseMoneyInput(form.unitValue) - parseMoneyInput(form.discountValue);

  return (
    <TwoColumnLayout
      main={
        <div className="space-y-4">
          <Panel
            title="Itens da Nota Fiscal"
            subtitle="Adicione os produtos e servicos da sua nota fiscal"
              actions={
                <>
                  <ActionButton icon={Plus} onClick={onAddItem}>{saving ? (editingItemId ? "Salvando..." : "Incluindo...") : editingItemId ? "Salvar Item" : "Adicionar Item"}</ActionButton>
                  <ActionButton icon={Search} onClick={onSearchProduct}>Buscar Produto</ActionButton>
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

          <ItemsTable expanded items={note.items} onDelete={onDeleteItem} onEdit={onEditItem} onCopy={onCopyItem} />

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
              { label: "Valor Total dos Itens", value: formatCurrency(Number(note.totals?.valorProdutos || 0) - Number(note.totals?.desconto || 0)), strong: true },
            ]}
          />
          <RowsCard title="Totais da Nota" rows={totalRows} />
        </>
      }
    />
  );
}

function TotaisPage({
  note,
  goBack,
  goNext,
  onRecalculate,
  recalculating,
}: {
  note: NfeDocumentDetail;
  goBack: () => void;
  goNext: () => void;
  onRecalculate: () => void;
  recalculating: boolean;
}) {
  const totals = note.totals;
  const check = checkNfeTotals(note);
  const isValid = check.issues.length === 0;
  const additions = Number(totals?.frete || 0) + Number(totals?.seguro || 0) + Number(totals?.outrasDespesas || 0);
  const totalProductsAndServices = Number(totals?.valorProdutos || 0);

  return (
    <TwoColumnLayout
      main={
        <div className="space-y-4">
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[12px] font-semibold text-[#64748b]">NF-e <span className="mx-1">›</span> Emissão</div>
              <h1 className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-[#0f172a]">Totais da Nota Fiscal</h1>
              <p className="mt-1 text-[14px] text-[#64748b]">Confira os totais e impostos calculados da sua nota fiscal.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <CheckCircle2 className={cn("h-5 w-5", isValid ? "text-[#178000]" : "text-[#b25d00]")} />
              <div>
                <div className="text-[12px] font-extrabold text-[#0f172a]">Etapa 3 de 7</div>
                <div className="text-[11px] text-[#64748b]">Totais da Nota Fiscal</div>
              </div>
            </div>
          </div>

          {!isValid && (
            <div role="alert" className="rounded-lg border border-[#f0c66b] bg-[#fffaf0] px-4 py-3 text-[13px] text-[#8a4b00]">
              <div className="flex items-start gap-2 font-bold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Existem divergências nos totais</div>
              <p className="mt-1 pl-6 text-[12px] leading-5">{check.issues.join(" ")}</p>
            </div>
          )}

          <Panel title="Conferência dos totais" subtitle="Valores calculados a partir dos itens do rascunho.">
          <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MiniTotalCard
              icon={Package}
              title="Produtos e Serviços"
              rows={[
                ["Total dos Produtos", formatCurrency(totals?.valorProdutos)],
                ["Total dos Servicos", formatCurrency(0)],
                ["Valor Total dos Produtos/Serviços", formatCurrency(totalProductsAndServices)],
                ["Descontos", formatDiscountCurrency(totals?.desconto)],
                ["Acréscimos", formatCurrency(additions)],
              ]}
              total={["Subtotal Produtos e Serviços", formatCurrency(totalProductsAndServices - Number(totals?.desconto || 0) + additions)]}
            />
            <MiniTotalCard
              icon={FileText}
              title="ICMS e FCP"
              rows={[
                ["Base de Cálculo do ICMS", formatCurrency(totals?.totalIcmsBase)],
                ["Valor do ICMS", formatCurrency(totals?.totalIcms)],
                ["Base de Cálculo do ICMS ST", formatCurrency(totals?.totalIcmsStBase)],
                ["Valor do ICMS ST", formatCurrency(totals?.totalIcmsSt)],
                ["Valor Total do FCP", formatCurrency(totals?.totalFcp)],
                ["Outras Despesas Acessórias", formatCurrency(totals?.outrasDespesas)],
              ]}
              total={["Total ICMS e FCP", formatCurrency(Number(totals?.totalIcms || 0) + Number(totals?.totalIcmsSt || 0) + Number(totals?.totalFcp || 0))]}
            />
            <MiniTotalCard
              icon={ListChecks}
              title="IPI / PIS / COFINS"
              rows={[
                ["Valor do IPI", formatCurrency(totals?.totalIpi)],
                ["Valor do PIS", formatCurrency(totals?.totalPis)],
                ["Valor da COFINS", formatCurrency(totals?.totalCofins)],
              ]}
              total={["Total IPI / PIS / COFINS", formatCurrency(Number(totals?.totalIpi || 0) + Number(totals?.totalPis || 0) + Number(totals?.totalCofins || 0))]}
            />
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[#78b86c] bg-[#f6fcf3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#dff4d8] text-[#178000]"><CircleDollarSign className="h-6 w-6" /></span>
              <div><div className="text-[16px] font-extrabold text-[#0f172a]">Valor Total da Nota</div><div className="mt-1 text-[12px] text-[#64748b]">Este é o valor final da sua nota fiscal.</div></div>
            </div>
            <div className="text-right text-[28px] font-extrabold tracking-[-0.03em] text-[#167000]">{formatCurrency(totals?.valorTotal)}</div>
          </div>
          <FooterNav
            left="Voltar para Itens"
            right="Continuar para Transporte"
            onLeft={goBack}
            onRight={goNext}
            rightDisabled={!isValid || recalculating}
            middle={!isValid ? "Recalcular totais" : undefined}
            middleIcon={RefreshCw}
            onMiddle={onRecalculate}
            middleLoading={recalculating}
          />
          </Panel>
        </div>
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
          <Panel title={isValid ? "Conferência concluída" : "Existem divergências nos totais"} dense>
            <div className={cn("flex items-start gap-3 rounded-md p-3 text-[12px] leading-5", isValid ? "bg-[#f4fbef] text-[#166a00]" : "bg-[#fffaf0] text-[#8a4b00]")}>
              {isValid ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
              <span>{isValid ? "Todos os cálculos foram realizados com sucesso." : "Revise os itens destacados antes de continuar."}</span>
            </div>
          </Panel>
        </>
      }
    />
  );
}

function TransportePage({
  note,
  goBack,
  goNext,
  onSearchTransportadora,
  onClearTransport,
}: {
  note: NfeDocumentDetail;
  goBack: () => void;
  goNext: () => void;
  onSearchTransportadora: () => void;
  onClearTransport: () => void;
}) {
  const transport = note.transport || null;
  return (
    <TwoColumnLayout
      main={
        <Panel
          title="Dados do Transporte"
          subtitle="Informe os dados do transportador e do transporte da mercadoria"
          actions={
            <>
              <ActionButton icon={Search} onClick={onSearchTransportadora}>Buscar Transportadora</ActionButton>
              <ActionButton onClick={onClearTransport}>Limpar Dados</ActionButton>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Modalidade do Frete" required>
              <SelectControl value={transport?.modalidadeFrete ? transportFreightLabel(transport.modalidadeFrete) : "9 - Sem frete"} />
            </Field>
            <Field label="Tipo do Frete" required>
              <SelectControl value={transport?.modalidadeFrete ? transportFreightLabel(transport.modalidadeFrete) : "1 - Por conta do Destinatário"} />
            </Field>
          </div>

          <FormTitle>Transportador</FormTitle>
          <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_1.5fr_1fr]">
            <Field label="Tipo de Pessoa" required>
              <Segmented options={["Jurídica", "Física"]} active="Jurídica" />
            </Field>
            <Field label="CNPJ" required>
              <Control value={formatDocument(transport?.cnpjTransportadora) || "23.456.789/0001-30"} icon={Search} />
            </Field>
            <Field label="Razão Social" required>
              <Control value={transport?.nomeTransportadora || "TRANSPORTES EXEMPLO LTDA"} />
            </Field>
            <Field label="Inscrição Estadual">
              <Control value={transport?.ieTransportadora || "123.456.789.111"} />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1fr_0.8fr_1.3fr]">
            <Field label="RNTRC" required>
              <Control value={transport?.rntc || "12345678"} />
            </Field>
            <Field label="Nome Fantasia">
              <Control value={transport?.nomeTransportadora || "Transporte Exemplo"} />
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
              { label: "Modalidade do Frete", value: transportFreightLabel(transport?.modalidadeFrete) },
              { label: "Tipo do Frete", value: transport?.modalidadeFrete || "1 - Destinatário" },
              { label: "Transportador", value: transport?.nomeTransportadora || "Não informado" },
              { label: "CNPJ", value: formatDocument(transport?.cnpjTransportadora) || "—" },
              { label: "Placa do Veículo", value: transport?.placaVeiculo ? `${transport.placaVeiculo}${transport.ufPlaca ? ` - ${transport.ufPlaca}` : ""}` : "—" },
              { label: "Tipo do Veículo", value: "1 - Caminhão" },
              { label: "Peso Bruto Total", value: `${formatNumber(transport?.volumes?.reduce((sum, volume) => sum + Number(volume.pesoBruto || 0), 0) || 0, 3)} kg` },
              { label: "Peso Líquido Total", value: `${formatNumber(transport?.volumes?.reduce((sum, volume) => sum + Number(volume.pesoLiquido || 0), 0) || 0, 3)} kg` },
              { label: "Quantidade de Volumes", value: String(transport?.volumes?.length || 0) },
            ]}
          />
        </>
      }
    />
  );
}

function CobrancaPage({ note, goBack, goNext }: { note: NfeDocumentDetail; goBack: () => void; goNext: () => void }) {
  const paymentMethodOptions = [
    { value: "01", label: "01 - Dinheiro" },
    { value: "02", label: "02 - Cheque" },
    { value: "03", label: "03 - Cartão de crédito" },
    { value: "04", label: "04 - Cartão de débito" },
    { value: "05", label: "05 - Crédito loja" },
    { value: "10", label: "10 - Vale alimentação" },
    { value: "11", label: "11 - Vale refeição" },
    { value: "12", label: "12 - Vale presente" },
    { value: "13", label: "13 - Vale combustível" },
    { value: "15", label: "15 - Boleto bancário" },
    { value: "16", label: "16 - Depósito bancário" },
    { value: "17", label: "17 - Pagamento instantâneo (PIX)" },
    { value: "18", label: "18 - Transferência bancária / carteira digital" },
    { value: "19", label: "19 - Fidelidade / cashback / crédito virtual" },
    { value: "90", label: "90 - Sem pagamento" },
    { value: "99", label: "99 - Outros" },
  ];
  const [paymentIndicator, setPaymentIndicator] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("15");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [installmentInterval, setInstallmentInterval] = useState("30");
  const noteValue = Number(note.totals?.valorTotal || 0);
  const discountValue = Number(note.totals?.desconto || 0);
  const additionValue = 0;
  // O valor total da NF-e ja contempla descontos dos itens, frete, seguro,
  // outras despesas e os impostos que integram o total fiscal.
  const netValue = noteValue + additionValue;
  const isInstallment = paymentIndicator === "1";
  const isNoPayment = paymentMethod === "90";
  const count = isInstallment ? Math.max(1, Math.min(120, Number(installmentCount) || 1)) : 1;
  const installments = Array.from({ length: count }, (_, index) => {
    const baseValue = Math.floor((noteValue / count) * 100) / 100;
    const value = index === count - 1 ? noteValue - baseValue * (count - 1) : baseValue;
    const date = new Date(note.dataEmissao || new Date());
    date.setDate(date.getDate() + (isInstallment ? (Number(installmentInterval) || 30) * (index + 1) : 0));
    return { number: index + 1, date: formatDateDisplay(date.toISOString()), value };
  });

  function selectPaymentType(type: "0" | "1" | "90") {
    if (type === "90") {
      setPaymentIndicator("0");
      setPaymentMethod("90");
    } else {
      setPaymentIndicator(type);
      if (paymentMethod === "90") setPaymentMethod(type === "0" ? "01" : "15");
    }
  }

  return (
    <TwoColumnLayout
      main={
        <Panel title="Cobrança da Nota Fiscal" subtitle="Defina as formas e condições de pagamento desta nota fiscal">
          <InfoBanner text="Os títulos serão gerados após a autorização da NF-e." />

          <FormTitle>Como esta nota será paga?</FormTitle>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { value: "0" as const, title: "À vista", description: "Pagamento integral em uma única vez" },
              { value: "1" as const, title: "A prazo", description: "Pagamento dividido em títulos ou parcelas" },
              { value: "90" as const, title: "Sem pagamento", description: "Remessa, bonificação ou operação sem cobrança" },
            ].map((option) => {
              const selected = option.value === "90" ? isNoPayment : !isNoPayment && paymentIndicator === option.value;
              return <button key={option.value} type="button" onClick={() => selectPaymentType(option.value)} className={cn("rounded-lg border p-4 text-left transition-colors", selected ? "border-[#178000] bg-[#f3faef] ring-1 ring-[#178000]" : "border-[#dfe5ee] bg-white hover:border-[#9aaabd]")}><span className={cn("block text-[14px] font-bold", selected && "text-[#166a00]")}>{option.title}</span><span className="mt-1 block text-[11px] leading-4 text-[#64748b]">{option.description}</span></button>;
            })}
          </div>

          {!isNoPayment && <div className="mt-4 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-4">
            <div className={cn("grid gap-4", isInstallment ? "md:grid-cols-3" : "md:grid-cols-2")}>
              <Field label="Meio de pagamento (tPag)" required>
                <SelectControl value={paymentMethod} options={paymentMethodOptions.filter((option) => option.value !== "90")} onChange={setPaymentMethod} />
              </Field>
              {isInstallment && <><Field label="Número de parcelas" required><Control value={installmentCount} onChange={setInstallmentCount} /></Field><Field label="Intervalo em dias" required><Control value={installmentInterval} onChange={setInstallmentInterval} /></Field></>}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#e5eaf1] pt-4 text-[12px]"><span className="text-[#64748b]">Total informado no pagamento</span><span className="text-[18px] font-extrabold text-[#166a00]">{formatCurrency(noteValue)}</span></div>
          </div>}

          {!isNoPayment && isInstallment && <div className="mt-4 overflow-hidden rounded-lg border border-[#dfe5ee]">
            <div className="flex items-center justify-between px-3 py-3">
              <div>
                <h3 className="text-[15px] font-bold">Títulos / Parcelas da Nota Fiscal</h3>
                <p className="text-[12px] text-[#475569]">Parcelas calculadas automaticamente pelo valor da NF-e</p>
              </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>{["Parcela", "Vencimento", "Valor", "Meio de pagamento"].map((head) => <th key={head} className="border-t border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>)}</tr>
              </thead>
              <tbody>
                {installments.map((installment) => <tr key={installment.number} className="border-t border-[#e5eaf1]"><td className="px-3 py-3 font-bold">{installment.number} / {installments.length}</td><td className="px-3 py-3">{installment.date}</td><td className="px-3 py-3 font-bold text-[#166a00]">{formatCurrency(installment.value)}</td><td className="px-3 py-3">{paymentMethodOptions.find((option) => option.value === paymentMethod)?.label}</td></tr>)}
                <tr className="border-t border-[#e5eaf1] bg-[#fbfbfc] font-bold">
                  <td className="px-3 py-3">Totais</td>
                  <td />
                  <td className="px-3 py-3 text-[#166a00]">{formatCurrency(noteValue)}</td><td />
                </tr>
              </tbody>
            </table></div>
          </div>}

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
          <RowsCard title="Resumo da Nota" rows={totalRowsFromTotals(note.totals)} />
          <RowsCard
            title="Resumo da Cobrança"
            rows={[
              { label: "Forma de pagamento", value: isNoPayment ? "Sem pagamento" : paymentIndicator === "1" ? "A prazo" : "À vista" },
              { label: "Meio de Pagamento", value: paymentMethodOptions.find((option) => option.value === paymentMethod)?.label || paymentMethod },
              { label: "Número de parcelas", value: isNoPayment ? "—" : String(count) },
              { label: "Valor da Nota", value: formatCurrency(noteValue) },
              { label: "Desconto Total", value: `- ${formatCurrency(discountValue)}` },
              { label: "Acréscimo Total", value: formatCurrency(additionValue) },
              { label: "Valor Líquido", value: formatCurrency(netValue), strong: true, green: true },
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
            <p className="text-[12px] text-[#475569]">A referência real vai aparecer quando a API expuser os vínculos do documento.</p>
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

function ReviewPage({
  note,
  goBack,
  goNext,
  onValidate,
  onAutoFix,
  onTransmit,
}: {
  note: NfeDocumentDetail;
  goBack: () => void;
  goNext: () => void;
  onValidate: () => void;
  onAutoFix: () => void;
  onTransmit: () => void;
}) {
  const validation = note.validations?.[0] || null;
  const issues = validation?.issues || [];
  const summaryRows: Row[] = [
    { label: "Status do rascunho", value: note.status === "PRONTA_TRANSMISSAO" ? "Pronto para transmissao" : statusLabel(note.status) },
    { label: "Modelo", value: "55 - NF-e" },
    { label: "Serie / Numero", value: `${note.serie || "—"} / ${note.numero ? String(note.numero).padStart(9, "0") : "Rascunho"}` },
    { label: "Destinatario", value: note.destinatarioNome || "Nao informado" },
    { label: "Itens", value: String(note.items?.length || 0) },
    { label: "Ultima validacao", value: validation ? formatDateTimeDisplay(validation.validatedAt) || "Registrada" : "Ainda nao validado" },
    { label: "Valor total", value: formatCurrency(note.totals?.valorTotal), strong: true, green: true },
  ];

  return (
    <TwoColumnLayout
      main={
        <Panel
          title="Revisão e Validação"
          subtitle="Feche o rascunho, aplique correções seguras e só depois avance para a transmissão."
          actions={
            <>
              <ActionButton icon={RefreshCw} onClick={onAutoFix}>Correções seguras</ActionButton>
              <ActionButton icon={Check} onClick={onValidate}>Validar</ActionButton>
              <PrimaryButton icon={Send} onClick={onTransmit}>Validar e transmitir</PrimaryButton>
            </>
          }
        >
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <RowsCard title="Resumo do Rascunho" rows={summaryRows} compact />
            <Panel
              title="Resultado da Validação"
              subtitle={validation ? `Score ${validation.score}/100 · ${validation.errorCount} erro(s) · ${validation.alertCount} alerta(s)` : "Nenhuma validação registrada ainda."}
              dense
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat label="Pode transmitir" value={validation?.canTransmit ? "Sim" : "Nao"} tone={validation?.canTransmit ? "success" : "danger"} />
                <MiniStat label="Score" value={validation ? `${validation.score}/100` : "—"} tone={validation && validation.score >= 80 ? "success" : validation && validation.score >= 50 ? "warning" : "danger"} />
                <MiniStat label="Erros" value={validation ? String(validation.errorCount) : "—"} tone={validation && validation.errorCount > 0 ? "danger" : "success"} />
                <MiniStat label="Alertas" value={validation ? String(validation.alertCount) : "—"} tone={validation && validation.alertCount > 0 ? "warning" : "success"} />
              </div>
              <div className="mt-4 space-y-2">
                {!validation ? (
                  <div className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[12px] text-[#1d4ed8]">
                    Execute a validação para verificar o documento. A transmissão permanece bloqueada até a conclusão.
                  </div>
                ) : issues.length === 0 ? (
                  <div className="rounded-md border border-[#dbe3ec] bg-[#f8fafc] p-3 text-[12px] text-[#475569]">
                    {validation.canTransmit
                      ? "Documento validado e pronto para transmissão."
                      : "A validação foi concluída, mas o documento ainda não está liberado para transmissão."}
                  </div>
                ) : (
                  issues.slice(0, 6).map((issue) => (
                    <ValidationIssueRow key={`${issue.code}-${issue.field}`} issue={issue} />
                  ))
                )}
              </div>
            </Panel>
          </div>

          <div className="mt-4">
            <ChecklistPanel note={note} />
          </div>

          <FooterNav
            left="Voltar para Observações"
            right="Ir para Transmissão"
            onLeft={goBack}
            onRight={goNext}
          />
        </Panel>
      }
      aside={
        <>
          <RowsCard title="Snapshot da API" rows={buildReviewSnapshotRows(note)} />
          <RowsCard
            title="Arquivos e Retorno"
            rows={[
              { label: "Chave de acesso", value: getPrimaryAccessKey(note) || "Aguardando emissao" },
              { label: "Protocolo", value: getPrimaryProtocol(note) || "Aguardando autorizacao" },
              { label: "Recibo", value: getPrimaryReceipt(note) || "Aguardando retorno" },
              { label: "Retorno SEFAZ", value: note.sefazReturn ? `${note.sefazReturn.cStat || "—"} · ${note.sefazReturn.xMotivo || "Registrado"}` : "Aguardando retorno" },
              { label: "Arquivos gerados", value: `${note.files?.length || 0} arquivo(s)` },
            ]}
          />
          <DraftHistoryPanel note={note} />
        </>
      }
    />
  );
}

function ValidationIssueRow({ issue }: { issue: NfeValidationIssue }) {
  const severity = String(issue.severity || "").toUpperCase();
  const toneClass =
    severity === "CRITICAL" || severity === "ERROR"
      ? "border-[#fda4af] bg-[#fff1f2] text-[#b42318]"
      : severity === "ALERT" || severity === "WARN" || severity === "WARNING"
        ? "border-[#f0c66b] bg-[#fffaf0] text-[#b25d00]"
        : "border-[#dbe3ec] bg-[#f8fafc] text-[#334155]";

  return (
    <div className={cn("rounded-md border px-3 py-2 text-[12px]", toneClass)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">
          {issue.code}
        </span>
        <span className="font-bold">{issue.category}</span>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">{severity}</span>
        {issue.autoCorrectAvailable && (
          <span className="rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#166a00]">
            Auto
          </span>
        )}
      </div>
      <div className="mt-1 font-medium text-[#0f172a]">{issue.description}</div>
      {issue.howToFix && <div className="mt-1 text-[11px] text-[#475569]">Como corrigir: {issue.howToFix}</div>}
      {issue.autoCorrectAvailable && issue.autoCorrectValue != null && (
        <div className="mt-1 text-[11px] text-[#475569]">Valor sugerido: {String(issue.autoCorrectValue)}</div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: ReactNode; tone: "success" | "warning" | "danger" }) {
  const toneClass =
    tone === "success"
      ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166a00]"
      : tone === "warning"
        ? "border-[#f0c66b] bg-[#fffaf0] text-[#b25d00]"
        : "border-[#fda4af] bg-[#fff1f2] text-[#b42318]";

  return (
    <div className={cn("rounded-md border px-3 py-2", toneClass)}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-1 text-[14px] font-bold">{value}</div>
    </div>
  );
}

type ChecklistStatus = "ok" | "pending" | "blocked" | "attention";

type DraftChecklistItem = {
  order: number;
  label: string;
  summary: string;
  status: ChecklistStatus;
  icon: LucideIcon;
};

type DraftTimelineItem = {
  key: string;
  label: string;
  description: string;
  time: string;
  status: ChecklistStatus;
  icon: LucideIcon;
};

const checklistStatusMeta: Record<ChecklistStatus, { label: string; className: string; icon: LucideIcon }> = {
  ok: {
    label: "OK",
    className: "border-[#9ccc8c] bg-[#f4fbef] text-[#166a00]",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pendente",
    className: "border-[#f2bb4f] bg-[#fff8e8] text-[#b25d00]",
    icon: Clock,
  },
  blocked: {
    label: "Bloqueado",
    className: "border-[#fda4af] bg-[#fff1f2] text-[#b42318]",
    icon: Ban,
  },
  attention: {
    label: "Atenção",
    className: "border-[#f0c66b] bg-[#fffaf0] text-[#b25d00]",
    icon: AlertTriangle,
  },
};

function formatDateTimeDisplay(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function statusLabel(status: string | null | undefined) {
  switch (normalizeStatusCode(status)) {
    case "RASCUNHO":
      return "Rascunho";
    case "EM_VALIDACAO":
      return "Em validacao";
    case "PRONTA_TRANSMISSAO":
      return "Pronta para transmissao";
    case "TRANSMITINDO":
      return "Transmitindo";
    case "PROCESSANDO_SEFAZ":
      return "Processando SEFAZ";
    case "AUTORIZADA":
      return "Autorizada";
    case "REJEITADA":
      return "Rejeitada";
    case "CANCELADA":
      return "Cancelada";
    case "DENEGADA":
      return "Denegada";
    case "INUTILIZADA":
      return "Inutilizada";
    default:
      return String(status || "Desconhecido").replace(/_/g, " ").toLowerCase();
  }
}

function normalizeStatusCode(status: string | null | undefined) {
  return String(status || "").toUpperCase();
}

function finalidadeLabel(value: string | null | undefined) {
  switch (String(value || "")) {
    case "2":
      return "Complementar";
    case "3":
      return "Ajuste";
    case "4":
      return "Devolucao";
    case "1":
    default:
      return "Normal";
  }
}

function tipoOperacaoLabel(value: string | null | undefined) {
  if (value === "1") return "Saída";
  if (value === "0") return "Entrada";
  return "Nao informado";
}

function transportFreightLabel(value: string | null | undefined) {
  switch (String(value || "")) {
    case "0":
      return "0 - Por conta do remetente";
    case "1":
      return "1 - Por conta do destinatario";
    case "2":
      return "2 - Por conta de terceiros";
    case "3":
      return "3 - Transporte proprio do remetente";
    case "4":
      return "4 - Transporte proprio do destinatario";
    case "9":
      return "9 - Sem frete";
    default:
      return value || "—";
  }
}

function formatAccessKeyDisplay(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "—";
  return digits.match(/.{1,4}/g)?.join(" ") || digits;
}

type ProgressStepState = "done" | "active" | "idle";

function formatBytes(value: string | number | null | undefined) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let size = number;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 || size >= 10 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function formatEnvironmentLabel(value: string | null | undefined) {
  if (value === "1" || String(value).toLowerCase() === "production") return "1 - Produção";
  if (value === "2" || String(value).toLowerCase() === "homologation") return "2 - Homologação";
  return value || "—";
}

function noteSeriesNumber(note: NfeDocumentDetail) {
  return `${note.serie || "—"} / ${note.numero ? String(note.numero).padStart(9, "0") : "Rascunho"}`;
}

function latestLog(note: NfeDocumentDetail, actions?: string[]) {
  const logs = [...(note.logs || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (!actions || actions.length === 0) return logs[0] || null;
  return logs.find((log) => actions.includes(log.action)) || null;
}

function latestFile(note: NfeDocumentDetail, types?: string[]) {
  const files = [...(note.files || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (!types || types.length === 0) return files[0] || null;
  return files.find((file) => types.includes(file.tipo)) || null;
}

function getPrimaryAccessKey(note: NfeDocumentDetail) {
  return note.chaveAcesso || null;
}

function getPrimaryProtocol(note: NfeDocumentDetail) {
  return note.protocolo || note.authorization?.protocolo || note.sefazReturn?.protocolo || null;
}

function getPrimaryReceipt(note: NfeDocumentDetail) {
  return note.nRec || note.sefazReturn?.nRec || null;
}

function buildReviewSnapshotRows(note: NfeDocumentDetail): Row[] {
  const validation = note.validations?.[0] || null;
  const sefazReturn = note.sefazReturn || null;
  const authorization = note.authorization || null;
  const danfeFile = latestFile(note, ["DANFE_MOCK", "DANFE"]);
  const xmlFile = latestFile(note, ["XML_AUTORIZADO"]);
  const lastLog = latestLog(note);

  return [
    { label: "Status atual", value: statusLabel(note.status), strong: true },
    {
      label: "Ultima validacao",
      value: validation
        ? `Score ${validation.score}/100 · ${validation.errorCount} erro(s) · ${validation.alertCount} alerta(s)`
        : "Sem validacao registrada",
    },
    {
      label: "Retorno SEFAZ",
      value: sefazReturn
        ? `${sefazReturn.cStat || "—"} · ${sefazReturn.xMotivo || "Retorno registrado"}`
        : note.xMotivo || "Aguardando retorno da SEFAZ",
    },
    {
      label: "Autorizacao",
      value: authorization
        ? `${authorization.cStat} · ${authorization.protocolo}`
        : note.status === "AUTORIZADA" ? `${note.cStat || "—"} · ${note.protocolo || "Autorizado"}` : "Aguardando autorizacao",
    },
    { label: "Arquivos gerados", value: `${note.files?.length || 0} arquivo(s)` },
    {
      label: "DANFE",
      value: danfeFile
        ? `${danfeFile.tipo.replace(/_/g, " ")} · ${formatDateTimeDisplay(danfeFile.createdAt) || "Gerado"}`
        : "Pendente",
    },
    {
      label: "XML autorizado",
      value: xmlFile ? `${xmlFile.storageKey} · ${formatBytes(xmlFile.fileSize)}` : "Pendente",
    },
    {
      label: "Ultimo evento",
      value: lastLog ? `${lastLog.action.replace(/^nfe\./, "").replace(/\./g, " ").replace(/_/g, " ")} · ${formatDateTimeDisplay(lastLog.createdAt) || ""}` : "Sem eventos",
    },
  ];
}

function buildTransmissionRows(note: NfeDocumentDetail, compact = false): Array<[string, string, string, ProgressStepState]> {
  const validation = note.validations?.[0] || null;
  const sefazReturn = note.sefazReturn || null;
  const authorization = note.authorization || null;
  const danfeFile = latestFile(note, ["DANFE_MOCK", "DANFE"]);
  const status = normalizeStatusCode(note.status);
  const inFlight = POLLING_SEFAZ_STATUSES.has(status);
  const terminal = FINAL_SEFAZ_STATUSES.has(status) || Boolean(authorization);
  const validationTime = validation?.validatedAt || note.updatedAt;
  const returnTime = sefazReturn?.dhRecebto || authorization?.dataAutorizacao || validationTime;
  const authTime = authorization?.dataAutorizacao || returnTime;
  const danfeTime = danfeFile?.createdAt || authTime;

  if (compact) {
    return [
      [
        "Status atual",
        statusLabel(note.status),
        formatDateTimeDisplay(validationTime) || "Registrado",
        validation || note.status !== "RASCUNHO" ? "done" : "idle",
      ],
      [
        "Retorno SEFAZ",
        sefazReturn ? `${sefazReturn.cStat || "—"} · ${sefazReturn.xMotivo || "Retorno registrado"}` : inFlight ? "Lote enviado. Aguardando processamento." : "Aguardando retorno",
        formatDateTimeDisplay(returnTime) || "Aguardando...",
        terminal ? "done" : inFlight ? "active" : "idle",
      ],
      [
        "Autorizacao",
        authorization ? `Protocolo ${authorization.protocolo}` : terminal ? "Autorizacao nao disponivel" : inFlight ? "Aguardando autorizacao" : "Aguardando autorizacao",
        formatDateTimeDisplay(authTime) || "Aguardando...",
        terminal ? "done" : inFlight ? "active" : "idle",
      ],
    ];
  }

  return [
    [
      "1. Preparando Transmissao",
      validation
        ? `Score ${validation.score}/100 · ${validation.errorCount} erro(s) · ${validation.alertCount} alerta(s)`
        : "Aguardando validacao do rascunho.",
      formatDateTimeDisplay(validationTime) || "Registrado",
      validation ? "done" : note.status === "EM_VALIDACAO" ? "active" : "idle",
    ],
    [
      "2. Envio para SEFAZ",
      terminal
        ? `Status ${statusLabel(note.status)}`
        : inFlight
          ? "Lote enviado para a SEFAZ."
          : "Aguardando disparo da transmissao.",
      formatDateTimeDisplay(returnTime) || "Aguardando...",
      terminal ? "done" : inFlight ? "active" : "idle",
    ],
    [
      "3. Processamento SEFAZ",
      terminal
        ? `${sefazReturn?.cStat || note.cStat || "—"} · ${sefazReturn?.xMotivo || note.xMotivo || "Processamento concluído"}`
        : inFlight
          ? "SEFAZ processando o lote."
          : "Aguardando processamento da SEFAZ.",
      formatDateTimeDisplay(returnTime) || "Aguardando...",
      terminal ? "done" : inFlight ? "active" : "idle",
    ],
    [
      "4. Retorno da SEFAZ",
      sefazReturn
        ? `Recibo ${sefazReturn.nRec || getPrimaryReceipt(note) || "—"}`
        : inFlight
          ? "Lote recebido pela SEFAZ."
          : "Aguardando retorno oficial.",
      formatDateTimeDisplay(returnTime) || "Aguardando...",
      terminal ? "done" : inFlight ? "active" : "idle",
    ],
    [
      "5. Autorizacao e DANFE",
      authorization
        ? `Protocolo ${authorization.protocolo}${danfeFile ? ` · ${danfeFile.tipo.replace(/_/g, " ")}` : ""}`
        : danfeFile
          ? `${danfeFile.tipo.replace(/_/g, " ")} gerado.`
          : inFlight
            ? "Aguardando autorizacao final."
            : "Aguardando autorizacao final.",
      formatDateTimeDisplay(danfeTime) || "Aguardando...",
      terminal || danfeFile ? "done" : inFlight ? "active" : "idle",
    ],
  ];
}

function buildSefazTimelineRows(note: NfeDocumentDetail) {
  const validation = note.validations?.[0] || null;
  const sefazReturn = note.sefazReturn || null;
  const authorization = note.authorization || null;
  const danfeFile = latestFile(note, ["DANFE_MOCK", "DANFE"]);
  const status = normalizeStatusCode(note.status);
  const inFlight = POLLING_SEFAZ_STATUSES.has(status);
  const rows: Array<[string, string, string, string, string]> = [];

  if (inFlight) {
    rows.push([
      formatDateTimeDisplay(note.updatedAt) || "—",
      statusLabel(note.status),
      note.cStat || sefazReturn?.cStat || "—",
      note.xMotivo || "Processamento da SEFAZ em andamento.",
      "—",
    ]);
  }

  if (validation) {
    rows.push([
      formatDateTimeDisplay(validation.validatedAt) || "—",
      "Validacao",
      "—",
      `Score ${validation.score}/100 · ${validation.errorCount} erro(s)`,
      `${validation.durationMs || 0} ms`,
    ]);
  }

  if (sefazReturn) {
    rows.push([
      formatDateTimeDisplay(sefazReturn.dhRecebto) || "—",
      "Retorno SEFAZ",
      sefazReturn.cStat || "—",
      sefazReturn.xMotivo || "Retorno registrado",
      `${sefazReturn.tempoMedio ?? 0} s`,
    ]);
  }

  if (authorization) {
    rows.push([
      formatDateTimeDisplay(authorization.dataAutorizacao) || "—",
      "Autorizacao",
      authorization.cStat,
      authorization.xMotivo,
      "—",
    ]);
  }

  if (danfeFile) {
    rows.push([
      formatDateTimeDisplay(danfeFile.createdAt) || "—",
      "DANFE gerado",
      authorization?.cStat || sefazReturn?.cStat || "—",
      danfeFile.storageKey,
      formatBytes(danfeFile.fileSize),
    ]);
  }

  return rows;
}

function normalizeLogDetails(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return details as Record<string, unknown>;
}

function issueText(issue: { category?: string | null; field?: string | null; description?: string | null }) {
  return [issue.category, issue.field, issue.description].filter(Boolean).join(" ").toLowerCase();
}

function issuesMatch(
  issues: Array<{ category?: string | null; field?: string | null; description?: string | null }>,
  keywords: string[],
) {
  return issues.some((issue) => {
    const text = issueText(issue);
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function severityValue(issue: { severity?: string | null }) {
  return String(issue.severity || "").toUpperCase();
}

function hasBlockingValidation(issues: Array<{ severity?: string | null }>) {
  return issues.some((issue) => ["ERROR", "FATAL", "BLOCKER", "CRITICAL"].includes(severityValue(issue)));
}

function hasAttentionValidation(issues: Array<{ severity?: string | null }>) {
  return issues.some((issue) => ["WARN", "WARNING", "ALERT", "NOTICE"].includes(severityValue(issue)));
}

function buildDraftChecklist(note: NfeDocumentDetail): DraftChecklistItem[] {
  const validation = note.validations?.[0] || null;
  const issues = validation?.issues || [];
  const hasValidation = Boolean(validation);
  const hasBlocking = hasBlockingValidation(issues);
  const hasAttention = hasAttentionValidation(issues);
  const itemCount = note.items?.length || 0;
  const installmentCount = note.billing?.installments?.length || 0;
  const financialReady = note.status === "AUTORIZADA" || note.logs?.some((log) => ["nfe.financial.generated", "nfe.boleto.mock.generated"].includes(log.action)) || false;
  const hasClient = Boolean(note.destinatarioId || note.destinatarioNome || note.destinatarioCnpj || note.destinatarioCpf);
  const hasBasicData = Boolean(note.cfop && note.finalidade && note.tipoOperacao && note.ambiente && note.dataEmissao);
  const hasObservations = Boolean(note.additionalInfo || note.fiscoInfo || note.pedidoRef || note.justificativa);
  const noteStatusForMissing = hasValidation ? (hasBlocking ? "blocked" : hasAttention ? "attention" : "attention") : "pending";
  const stageStatus = (ready: boolean, blocked: boolean): ChecklistStatus => {
    if (ready) return "ok";
    if (blocked) return "blocked";
    return noteStatusForMissing;
  };

  return [
    {
      order: 1,
      label: "Dados da nota",
      summary: hasBasicData
        ? `CFOP ${note.cfop || "—"} · Finalidade ${note.finalidade || "—"} · ${note.tipoOperacao === "1" ? "Saída" : "Entrada"}`
        : "Aguardando CFOP, finalidade, tipo e ambiente.",
      status: stageStatus(hasBasicData, issuesMatch(issues, ["cfop", "finalidade", "tpnf", "operacao", "emissao", "serie", "numero"])),
      icon: CheckCircle2,
    },
    {
      order: 2,
      label: "Emitente",
      summary: note.emitente?.legalName
        ? `${note.emitente.legalName} · ${formatDocument(note.emitente.cnpj)}`
        : "Complete o cadastro fiscal da empresa emitente.",
      status: stageStatus(Boolean(note.emitente?.legalName && note.emitente?.cnpj), issuesMatch(issues, ["emitente", "emitter", "endereço fiscal", "ibge"])),
      icon: FileText,
    },
    {
      order: 3,
      label: "Cliente",
      summary: hasClient ? note.destinatarioNome || formatDocument(note.destinatarioCnpj || note.destinatarioCpf) : "Selecione o destinatário do documento.",
      status: stageStatus(hasClient, issuesMatch(issues, ["destinat", "cliente", "recipient"])),
      icon: Search,
    },
    {
      order: 4,
      label: "Itens",
      summary: itemCount > 0 ? `${itemCount} item(ns) · ${formatCurrency(note.totals?.valorProdutos)}` : "Inclua ao menos um item na NF-e.",
      status: stageStatus(itemCount > 0, issuesMatch(issues, ["item", "produto", "ncm", "ean", "cst", "csosn", "origem", "quantidade"])),
      icon: Plus,
    },
    {
      order: 5,
      label: "Impostos",
      summary: validation
        ? `Validação executada · Score ${validation.score} · ${validation.errorCount} erro(s)`
        : "Ainda sem validação fiscal executada.",
      status: validation
        ? hasBlocking || issuesMatch(issues, ["icms", "ipi", "pis", "cofins", "tribut", "fcp", "st"])
          ? "blocked"
          : hasAttention
            ? "attention"
            : "ok"
        : itemCount > 0
          ? "attention"
          : "pending",
      icon: ShieldCheck,
    },
    {
      order: 6,
      label: "Totais",
      summary: note.totals ? `Valor total ${formatCurrency(note.totals.valorTotal)}` : "Recalcule os totais da nota.",
      status: stageStatus(Boolean(note.totals), issuesMatch(issues, ["total", "valor", "frete", "seguro", "desconto"])),
      icon: ListChecks,
    },
    {
      order: 7,
      label: "Transporte",
      summary: note.transport
        ? note.transport.nomeTransportadora || (note.transport.modalidadeFrete ? `Modalidade ${note.transport.modalidadeFrete}` : "Transporte informado")
        : "Informe transportadora, volumes e modalidade.",
      status: stageStatus(Boolean(note.transport), issuesMatch(issues, ["transport", "frete", "volume", "placa", "rntc"])),
      icon: Truck,
    },
    {
      order: 8,
      label: "Pagamento",
      summary: installmentCount > 0
        ? `${installmentCount} parcela(s) · ${note.billing?.meioPagamento || "meio de pagamento definido"}`
        : "Configure boleto, parcelas ou condição de pagamento.",
      status: stageStatus(installmentCount > 0, issuesMatch(issues, ["pagamento", "boleto", "parcela", "meio", "forma"])),
      icon: FileText,
    },
    {
      order: 9,
      label: "Financeiro",
      summary: financialReady
        ? "Recebíveis sincronizados no draft."
        : "Aguardando geração financeira ou autorização.",
      status: stageStatus(financialReady, issuesMatch(issues, ["finance", "receiv", "titulo", "título", "conta"])),
      icon: FileDown,
    },
    {
      order: 10,
      label: "Observações",
      summary: hasObservations ? "Observações e referências já registradas." : "Sem observações adicionais por enquanto.",
      status: stageStatus(hasObservations, issuesMatch(issues, ["observ", "pedido", "fisco", "justific"])),
      icon: Info,
    },
    {
      order: 11,
      label: "XML",
      summary: note.xmlAssinado ? "XML final assinado e disponível." : hasValidation ? "XML ainda não foi assinado." : "Execute a validação antes de gerar o XML final.",
      status: note.xmlAssinado ? "ok" : issuesMatch(issues, ["xml", "schema", "layout", "assinatura"]) ? "blocked" : "pending",
      icon: FileDown,
    },
    {
      order: 12,
      label: "Certificado",
      summary: !hasValidation
        ? "Certificado será conferido durante a validação."
        : issuesMatch(issues, ["certificado", "certificate"])
          ? "Certificado digital exige correção."
          : "Certificado digital conferido pela validação.",
      status: !hasValidation ? "pending" : issuesMatch(issues, ["certificado", "certificate"]) ? "blocked" : "ok",
      icon: ShieldCheck,
    },
    {
      order: 13,
      label: "Transmissão",
      summary: note.status === "AUTORIZADA"
        ? `Autorizada${note.protocolo ? ` · Protocolo ${note.protocolo}` : ""}`
        : validation?.canTransmit
          ? "Validação concluída; pronta para transmitir."
          : "Bloqueada até concluir a validação sem erros críticos.",
      status: note.status === "AUTORIZADA" || validation?.canTransmit ? "ok" : hasBlocking ? "blocked" : "pending",
      icon: Send,
    },
  ];
}

function buildDraftTimeline(note: NfeDocumentDetail): DraftTimelineItem[] {
  const validation = note.validations?.[0] || null;
  const issues = validation?.issues || [];
  const logs = [...(note.logs || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const timeline: DraftTimelineItem[] = [];

  for (const log of logs) {
    const details = normalizeLogDetails(log.details);
    const time = formatDateTimeDisplay(log.createdAt);

    if (log.action === "nfe.draft.created") {
      timeline.push({
        key: `${log.id}-created`,
        label: "Rascunho criado",
        description: note.numero ? `NF-e ${String(note.numero).padStart(9, "0")} aberta para edição.` : "Documento aberto para edição.",
        time,
        status: "ok",
        icon: CheckCircle2,
      });
      continue;
    }

    if (log.action === "nfe.updated") {
      const fields = Array.isArray(details.fields) ? details.fields.map((field) => String(field)) : [];
      const clientChanged = fields.some((field) => ["recipientId", "destinatarioId", "destinatarioNome", "destinatarioCnpj", "destinatarioCpf"].includes(field));
      timeline.push({
        key: `${log.id}-updated`,
        label: "Rascunho salvo automaticamente",
        description: fields.length
          ? `Campos salvos: ${fields.join(", ")}`
          : "Alterações do rascunho persistidas.",
        time,
        status: "ok",
        icon: Save,
      });
      if (clientChanged) {
        timeline.push({
          key: `${log.id}-client`,
          label: "Cliente selecionado",
          description: note.destinatarioNome || "Destinatário vinculado ao draft.",
          time,
          status: "ok",
          icon: Search,
        });
      }
      continue;
    }

    if (log.action === "nfe.item.created") {
      timeline.push({
        key: `${log.id}-item-created`,
        label: "Produto adicionado",
        description: details.productId ? `Produto ${String(details.productId)} incluído no item.` : "Item incluído no draft.",
        time,
        status: "ok",
        icon: Plus,
      });
      continue;
    }

    if (log.action === "nfe.item.updated") {
      timeline.push({
        key: `${log.id}-item-updated`,
        label: "Item ajustado",
        description: details.itemId ? `Item ${String(details.itemId)} atualizado.` : "Item revisado.",
        time,
        status: "ok",
        icon: Edit2,
      });
      continue;
    }

    if (log.action === "nfe.item.deleted") {
      timeline.push({
        key: `${log.id}-item-deleted`,
        label: "Item removido",
        description: details.itemId ? `Item ${String(details.itemId)} removido.` : "Item removido do draft.",
        time,
        status: "attention",
        icon: Trash2,
      });
      continue;
    }

    if (log.action === "nfe.totals.recalculated") {
      timeline.push({
        key: `${log.id}-totals`,
        label: "Totais recalculados",
        description: details.reason ? `Origem: ${String(details.reason)}` : "Somatórios atualizados no draft.",
        time,
        status: "ok",
        icon: ListChecks,
      });
      continue;
    }

    if (log.action === "nfe.validated") {
      const canTransmit = Boolean(details.canTransmit ?? validation?.canTransmit);
      const errorCount = validation?.errorCount || 0;
      const issueCount = issues.length;
      const alertCount = validation?.alertCount || 0;
      timeline.push({
        key: `${log.id}-validated`,
        label: "Validação executada",
        description: canTransmit
          ? "NF-e pronta para transmissão."
          : `Encontradas ${issueCount || errorCount} pendência(s) e ${alertCount} alerta(s).`,
        time,
        status: canTransmit ? "ok" : errorCount > 0 ? "blocked" : "attention",
        icon: CheckCircle2,
      });

      if (!canTransmit || issueCount > 0 || errorCount > 0 || alertCount > 0) {
        timeline.push({
          key: `${log.id}-issue`,
          label: "Pendência encontrada",
          description: issueCount > 0 || errorCount > 0 ? `${issueCount || errorCount} erro(s) bloqueando a transmissão.` : `${alertCount} alerta(s) exigem revisão.`,
          time,
          status: issueCount > 0 || errorCount > 0 ? "blocked" : "attention",
          icon: issueCount > 0 || errorCount > 0 ? Ban : AlertTriangle,
        });
      }
      continue;
    }

    if (log.action === "nfe.transmission.blocked") {
      timeline.push({
        key: `${log.id}-blocked`,
        label: "Transmissão bloqueada",
        description: details.status ? `Status atual: ${String(details.status)}` : "A NF-e ainda não pôde ser transmitida.",
        time,
        status: "blocked",
        icon: Ban,
      });
      continue;
    }

    if (log.action === "nfe.transmission.started") {
      timeline.push({
        key: `${log.id}-transmission-started`,
        label: "Transmissão iniciada",
        description: details.accessKey ? `Chave ${String(details.accessKey)} enviada para a SEFAZ.` : "Lote recebido pela SEFAZ.",
        time,
        status: "attention",
        icon: Send,
      });
      continue;
    }

    if (log.action === "nfe.sefaz.processing") {
      timeline.push({
        key: `${log.id}-sefaz-processing`,
        label: "SEFAZ processando",
        description: details.receipt ? `Recibo ${String(details.receipt)} em processamento.` : "Lote em processamento.",
        time,
        status: "attention",
        icon: Clock,
      });
      continue;
    }

    if (log.action === "nfe.mock.authorized") {
      timeline.push({
        key: `${log.id}-authorized`,
        label: "Transmissão autorizada",
        description: details.protocol ? `Protocolo ${String(details.protocol)} registrado.` : "Autorização concluída.",
        time,
        status: "ok",
        icon: CheckCircle2,
      });
      continue;
    }

    if (log.action === "nfe.danfe.mock.generated") {
      timeline.push({
        key: `${log.id}-danfe`,
        label: "DANFE gerado",
        description: details.storageKey ? String(details.storageKey) : "Documento DANFE disponível.",
        time,
        status: "ok",
        icon: FileDown,
      });
      continue;
    }

    if (log.action === "nfe.financial.generated") {
      timeline.push({
        key: `${log.id}-financial`,
        label: "Financeiro gerado",
        description: details.receivables ? `${String(details.receivables)} título(s) de contas a receber.` : "Contas a receber criadas.",
        time,
        status: "ok",
        icon: FileText,
      });
      continue;
    }

    if (log.action === "nfe.boleto.mock.generated") {
      timeline.push({
        key: `${log.id}-boleto`,
        label: "Boleto gerado",
        description: details.url ? String(details.url) : "Boleto disponível.",
        time,
        status: "ok",
        icon: FileDown,
      });
      continue;
    }

    if (log.action === "nfe.billing.synced") {
      timeline.push({
        key: `${log.id}-billing`,
        label: "Pagamento sincronizado",
        description: details.installments ? `${String(details.installments)} parcela(s) atualizada(s).` : "Pagamento sincronizado no draft.",
        time,
        status: "ok",
        icon: FileText,
      });
      continue;
    }

    if (log.action === "nfe.transport.synced") {
      timeline.push({
        key: `${log.id}-transport`,
        label: "Transporte sincronizado",
        description: details.transportadoraId ? `Transportadora ${String(details.transportadoraId)} vinculada.` : "Dados de transporte atualizados.",
        time,
        status: "ok",
        icon: Truck,
      });
    }
  }

  if (!timeline.length) {
    timeline.push({
      key: "empty",
      label: "Sem eventos ainda",
      description: "As ações do draft aparecerão aqui depois de salvar, validar ou transmitir.",
      time: "",
      status: "pending",
      icon: Clock,
    });
  }

  return timeline;
}

function StatusPill({ status }: { status: ChecklistStatus }) {
  const meta = checklistStatusMeta[status];
  const Icon = meta.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function ChecklistPanel({ note }: { note: NfeDocumentDetail }) {
  const items = buildDraftChecklist(note);
  const [filter, setFilter] = useState<"all" | ChecklistStatus>("all");
  const counts = items.reduce<Record<ChecklistStatus, number>>(
    (result, item) => ({ ...result, [item.status]: result[item.status] + 1 }),
    { ok: 0, pending: 0, blocked: 0, attention: 0 },
  );
  const filteredItems = items
    .filter((item) => filter === "all" || item.status === filter)
    .sort((left, right) => {
      const priority: Record<ChecklistStatus, number> = { blocked: 0, attention: 1, pending: 2, ok: 3 };
      return priority[left.status] - priority[right.status] || left.order - right.order;
    });

  return (
    <Panel title="Checklist Visual da NF-e" subtitle="Status por etapa do rascunho antes da emissão." dense>
      <div className="mb-3 flex flex-wrap gap-2" aria-label="Filtros do checklist">
        {([
          ["all", "Todos", items.length],
          ["blocked", "Bloqueados", counts.blocked],
          ["pending", "Pendentes", counts.pending],
          ["attention", "Alertas", counts.attention],
          ["ok", "Concluídos", counts.ok],
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
              filter === value ? "border-[#78c257] bg-[#f1faed] text-[#166a00]" : "border-[#dfe5ee] bg-white text-[#475569] hover:bg-[#f8fafc]",
            )}
          >
            {label} <span className="ml-1">{count}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const meta = checklistStatusMeta[item.status];
          const Icon = meta.icon;
          return (
            <details key={item.label} className={cn("group rounded-md border border-[#e5eaf1] px-3 py-2", item.status === "blocked" && "bg-[#fff1f2]", item.status === "attention" && "bg-[#fffaf0]", item.status === "pending" && "bg-[#f8fafc]")}>
              <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
              <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", meta.className)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-extrabold leading-4 text-[#0f172a]">{item.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-[#475569]">{item.summary}</div>
              </div>
              <StatusPill status={item.status} />
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[#64748b] transition-transform group-open:rotate-180" />
              </summary>
              <div className="ml-10 mt-2 border-t border-[#dfe5ee] pt-2 text-[11px] leading-5 text-[#475569]">
                Etapa {item.order} de 13. {item.status === "ok" ? "Nenhuma ação necessária." : "Revise esta área antes da transmissão."}
              </div>
            </details>
          );
        })}
      </div>
    </Panel>
  );
}

function DraftHistoryPanel({ note }: { note: NfeDocumentDetail }) {
  const items = buildDraftTimeline(note);

  return (
    <Panel title="Histórico do Rascunho" subtitle="Eventos persistidos no próprio draft." dense>
      <div className="relative max-h-[420px] space-y-1 overflow-auto pr-1">
        <div className="absolute bottom-5 left-[13px] top-5 w-px bg-[#d6dee9]" />
        {items.map((item) => {
          const meta = checklistStatusMeta[item.status];
          const Icon = item.icon;
          return (
            <div key={item.key} className={cn("relative flex gap-3 rounded-md px-2 py-2 text-[12px]", item.status === "blocked" && "bg-[#fff1f2]", item.status === "attention" && "bg-[#fffaf0]", item.status === "ok" && "bg-[#f8fafc]")}>
              <span className={cn("z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full", meta.className)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[#0f172a]">{item.label}</div>
                <div className="mt-0.5 text-[11px] leading-4 text-[#475569]">{item.description}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <StatusPill status={item.status} />
                <span className="text-[11px] text-[#64748b]">{item.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TransmitirPage({ note, goBack, onTransmit }: { note: NfeDocumentDetail; goBack: () => void; onTransmit: () => void }) {
  const files = [...(note.files || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const returnRecord = note.sefazReturn || null;
  const authorization = note.authorization || null;
  const isAuthorized = note.status === "AUTORIZADA" || Boolean(authorization);
  const emitterRows = [
    { label: "Razao Social", value: note.emitente?.legalName || "Nao informada" },
    { label: "CNPJ", value: formatDocument(note.emitente?.cnpj) || "—" },
    { label: "CRT", value: note.emitente?.crt || "—" },
    { label: "UF", value: note.emitente?.uf || "—" },
    { label: "Cidade", value: note.emitente?.city || "—" },
    { label: "Ambiente", value: formatEnvironmentLabel(note.emitente?.environment) },
  ] satisfies Row[];
  const transmissionRows = [
    { label: "CStat", value: authorization?.cStat || returnRecord?.cStat || note.cStat || "—" },
    { label: "Mensagem", value: authorization?.xMotivo || returnRecord?.xMotivo || note.xMotivo || "Aguardando retorno da SEFAZ" },
    { label: "Retorno SEFAZ", value: returnRecord ? formatDateTimeDisplay(returnRecord.dhRecebto) || "Registrado" : "Aguardando retorno" },
    { label: "Protocolo", value: getPrimaryProtocol(note) || "—" },
    { label: "Recibo", value: getPrimaryReceipt(note) || "—" },
    { label: "Ultima atualizacao", value: formatDateTimeDisplay(note.updatedAt) || "—" },
  ] satisfies Row[];
  const transmissionMessage = isAuthorized
    ? `Protocolo ${getPrimaryProtocol(note) || "—"} registrado em ${formatDateTimeDisplay(authorization?.dataAutorizacao || returnRecord?.dhRecebto) || "—"}.`
    : note.status === "PROCESSANDO_SEFAZ"
      ? "SEFAZ processando o lote. A tela atualiza automaticamente com o próximo retorno."
      : note.status === "TRANSMITINDO"
        ? "Lote recebido pela SEFAZ. O status está sendo consultado automaticamente."
    : returnRecord
      ? `SEFAZ retornou ${returnRecord.cStat || "—"} · ${returnRecord.xMotivo || "retorno registrado"}.`
      : note.status === "PRONTA_TRANSMISSAO"
        ? "Rascunho validado e pronto para envio."
        : "Aguardando processamento da SEFAZ.";

  return (
    <TwoColumnLayout
      main={
        <Panel title="Preparação para Transmissão" subtitle="Revise as informações abaixo antes de transmitir sua NF-e para a SEFAZ.">
          <div className="grid gap-3 xl:grid-cols-3">
            <MiniTotalCard
              title="Resumo da Nota"
              rows={[
                ["Status", statusLabel(note.status)],
                ["Série / Número", noteSeriesNumber(note)],
                ["Data de Emissão", formatDateTimeDisplay(note.dataEmissao) || "Aguardando emissao"],
                ["Natureza da Operação", note.naturezaOperacao || "Nao informada"],
              ]}
              total={["Valor Total da Nota", formatCurrency(note.totals?.valorTotal)]}
            />
            <Panel title="Arquivos da Nota" subtitle="Os arquivos persistidos pela API para esta NF-e." dense>
              <div className="space-y-2">
                {files.length === 0 ? (
                  <div className="rounded-md border border-[#dbe3ec] bg-[#f8fafc] p-3 text-[12px] text-[#475569]">
                    Nenhum arquivo gerado ainda.
                  </div>
                ) : (
                  files.map((file) => {
                    const fileMeta = getNfeFilePreviewMeta(file.tipo);
                    const fileName = file.storageKey.split("/").pop() || file.storageKey;
                    return (
                      <div key={file.id} className="flex items-start justify-between gap-3 rounded-md border border-[#e5eaf1] px-3 py-2 text-[12px]">
                        <div className="min-w-0">
                          <div className="font-bold">{fileMeta.label}</div>
                          <div className="mt-0.5 text-[#475569]">{fileName}</div>
                        </div>
                        <div className="flex shrink-0 items-start gap-3 text-right text-[#475569]">
                          <div>
                            <div>{formatDateTimeDisplay(file.createdAt) || "—"}</div>
                            <div>{formatBytes(file.fileSize)}</div>
                          </div>
                          <div className="flex gap-1">
                            <IconSquare icon={Eye} title="Visualizar arquivo" onClick={() => void handleNfeFileAction(note, file, "view")} />
                            <IconSquare icon={Download} title="Baixar arquivo" onClick={() => void handleNfeFileAction(note, file, "download")} />
                            <IconSquare icon={Printer} title="Imprimir arquivo" onClick={() => void handleNfeFileAction(note, file, "print")} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>
            <Panel title="Emitente da NF-e" subtitle="Dados do emissor persistidos no documento." dense>
              <Rows rows={emitterRows} compact />
              <div className={cn("mt-3 flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] font-bold", isAuthorized ? "border-[#9ccc8c] bg-[#f4fbef] text-[#166a00]" : "border-[#f0c66b] bg-[#fff8e8] text-[#b25d00]")}>
                <CheckCircle2 className="h-4 w-4" />
                {isAuthorized ? "Autorizacao registrada" : statusLabel(note.status)}
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1.15fr]">
            <ChecklistPanel note={note} />
            <RowsCard title="Estado da Transmissão" rows={transmissionRows} />
          </div>

          <div className={cn("mt-4 flex items-start gap-3 rounded-md border p-3 text-[12px]", isAuthorized ? "border-[#9ccc8c] bg-[#f4fbef]" : "border-[#f0c66b] bg-[#fffaf0]")}>
            <Info className={cn("mt-0.5 h-4 w-4 shrink-0", isAuthorized ? "text-[#166a00]" : "text-[#d89a00]")} />
            <div>
              <div className="font-bold">{isAuthorized ? "Autorizacao concluida" : "Aguardando retorno da SEFAZ"}</div>
              <div className={cn(isAuthorized ? "text-[#166a00]" : "text-[#b25d00]")}>{transmissionMessage}</div>
            </div>
          </div>

          <FooterNav
            left="Voltar para Revisão"
            right="Transmitir NF-e Agora"
            onLeft={goBack}
            onRight={onTransmit}
            rightIcon={Send}
          />
        </Panel>
      }
      aside={
        <>
          <ProgressCard note={note} />
          <RowsCard title="Resumo da API" rows={buildReviewSnapshotRows(note).slice(1, 6)} />
          <DraftHistoryPanel note={note} />
        </>
      }
    />
  );
}

function RetornoSefazPage({ note, goBack, onFinish }: { note: NfeDocumentDetail; goBack: () => void; onFinish: () => void }) {
  const returnRecord = note.sefazReturn || null;
  const authorization = note.authorization || null;
  const xmlReturn = returnRecord?.xmlRetorno || authorization?.xmlProtocolo || "Sem XML de retorno persistido ainda.";

  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <SuccessBanner note={note} compact />
          <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
            <InvoiceSummaryCard note={note} />
            <AuthorizationInfoCard note={note} title="Retorno da SEFAZ" badge={returnRecord?.cStat || statusLabel(note.status)} />
          </div>
          <FilesCard title="Arquivos da Nota" note={note} />
          <SefazLogCard note={note} />
          <FooterNav
            left="Voltar para Transmissão"
            right="Finalizar e Voltar para Lista"
            onLeft={goBack}
            onRight={onFinish}
            rightIcon={Check}
          />
        </div>
      }
      aside={
        <>
          <StatusProcessCard note={note} compact />
          <Panel title="XML de Retorno" dense>
            <pre className="h-[180px] overflow-auto rounded-md border border-[#d6dee9] bg-[#f8fafc] p-3 text-[11px] leading-5 text-[#334155]">
{xmlReturn}
            </pre>
            <ActionButton
              icon={Copy}
              onClick={async () => {
                try {
                  const protocol = getPrimaryProtocol(note) || returnRecord?.nRec || "";
                  if (!protocol) {
                    notify({ title: "Protocolo indisponível", description: "Ainda não há protocolo registrado para copiar.", tone: "info" });
                    return;
                  }
                  await navigator.clipboard.writeText(protocol);
                  notify({ title: "Protocolo copiado", description: protocol });
                } catch (err) {
                  notify({
                    title: "Não foi possível copiar",
                    description: err instanceof Error ? err.message : "O navegador bloqueou o acesso à área de transferência.",
                    tone: "error",
                  });
                }
              }}
            >
              Copiar Protocolo
            </ActionButton>
          </Panel>
          <RowsCard title="Detalhes do Retorno" rows={buildReviewSnapshotRows(note).slice(1, 6)} />
        </>
      }
    />
  );
}

function AutorizacaoPage({ note, goBack, onFinish }: { note: NfeDocumentDetail; goBack: () => void; onFinish: () => void }) {
  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <SuccessBanner note={note} />
          <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
            <InvoiceSummaryCard note={note} />
            <AuthorizationInfoCard note={note} title="Informações da Autorização" badge={note.authorization?.cStat || statusLabel(note.status)} />
          </div>
          <FilesCard title="Arquivos Disponíveis" note={note} />
          <SefazLogCard note={note} />
          <FooterNav
            left="Voltar para Retorno SEFAZ"
            right="Novo Documento"
            onLeft={goBack}
            onRight={onFinish}
            middle="Imprimir DANFE"
            middleIcon={Printer}
            onMiddle={() => void openDanfeFromApi(note, "print")}
          />
        </div>
      }
      aside={
        <>
          <StatusProcessCard note={note} />
          <RowsCard title="Resumo do Protocolo" rows={buildReviewSnapshotRows(note).slice(0, 6)} />
          <DraftHistoryPanel note={note} />
        </>
      }
    />
  );
}

function DanfePage({ note, goBack }: { note: NfeDocumentDetail; goBack: () => void }) {
  const files = [...(note.files || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const summaryRows: Row[] = [
    { label: "Modelo", value: `${note.modelo || "55"} - NF-e` },
    { label: "Série / Número", value: noteSeriesNumber(note) },
    { label: "Data de Emissão", value: formatDateTimeDisplay(note.dataEmissao) || "—" },
    { label: "Natureza da Operação", value: note.naturezaOperacao || "—" },
    { label: "Tipo de Operação", value: note.tipoOperacao ? `${note.tipoOperacao} - ${tipoOperacaoLabel(note.tipoOperacao)}` : "—" },
    { label: "Finalidade", value: note.finalidade ? `${note.finalidade} - ${finalidadeLabel(note.finalidade)}` : "—" },
    { label: "Ambiente", value: formatEnvironmentLabel(note.ambiente) },
    { label: "Situação", value: <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", note.status === "AUTORIZADA" ? "bg-[#e9f8e6] text-[#166a00]" : "bg-[#fff8e8] text-[#b25d00]")}>{statusLabel(note.status)}</span> },
    { label: "Protocolo SEFAZ", value: getPrimaryProtocol(note) || "—" },
    { label: "Data/Hora Autorização", value: formatDateTimeDisplay(note.authorization?.dataAutorizacao || note.sefazReturn?.dhRecebto) || "—" },
  ];
  const fileRows = files.map((file) => [
    file.tipo.replace(/_/g, " "),
    formatDateTimeDisplay(file.createdAt) || "—",
    formatBytes(file.fileSize),
  ]);

  return (
    <TwoColumnLayout
      main={
        <div className="space-y-3">
          <Panel title="DANFE - Documento Auxiliar da Nota Fiscal Eletrônica">
            <div className="mb-3 flex items-center justify-between rounded-md border border-[#dfe5ee] bg-[#f8fafc] p-2">
              <div className="flex items-center gap-2">
                <IconButton icon={ArrowLeft} title="Voltar" onClick={goBack} />
                <button className="h-9 rounded-md border border-[#d6dee9] bg-white px-4 text-[12px] font-bold">100% <ChevronDown className="ml-2 inline h-4 w-4" /></button>
                <IconButton icon={Plus} title="Zoom" onClick={() => notify({ title: "Zoom do DANFE", description: "Use o zoom do navegador para ampliar a visualização." })} />
                <IconButton icon={ExternalLink} title="Abrir DANFE" onClick={() => void openDanfeFromApi(note, "view")} />
              </div>
              <div className="text-[12px] font-bold">Página <span className="mx-2 rounded-md border border-[#d6dee9] bg-white px-3 py-2">1</span> / 1</div>
              <div className="flex items-center gap-2 text-[12px] font-bold">
                Visualização:
                <IconButton icon={FileText} title="Abrir XML autorizado" onClick={() => void handleNfeFileAction(note, { tipo: "XML_AUTORIZADO", storageKey: note.xmlProtocolo || "" }, "view")} />
                <IconButton icon={Grid2X2} title="Baixar DANFE" onClick={() => void openDanfeFromApi(note, "download")} />
                <IconButton icon={MoreHorizontal} title="Imprimir DANFE" onClick={() => void openDanfeFromApi(note, "print")} />
              </div>
            </div>
            <DanfeDocument note={note} />
          </Panel>
          <FooterNav left="Voltar" onLeft={goBack} />
        </div>
      }
      aside={
        <>
          <RowsCard title="Resumo da NF-e" rows={summaryRows} />
          <RowsCard
            title="Arquivos Gerados"
            rows={fileRows.length ? fileRows.map(([label, time, size]) => ({ label, value: `${time} · ${size}` })) : [{ label: "Arquivos", value: "Nenhum arquivo gerado ainda." }]}
          />
          <RowsCard title="Estado da API" rows={buildReviewSnapshotRows(note).slice(0, 6)} />
          <DraftHistoryPanel note={note} />
        </>
      }
    />
  );
}

function TwoColumnLayout({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">{main}</div>
      <aside className="min-w-0 space-y-3">{aside}</aside>
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
  onMiddle,
  leftIcon: LeftIcon = ArrowLeft,
  rightIcon = ArrowRight,
  middleIcon: MiddleIcon,
  rightDisabled,
  middleLoading,
}: {
  left?: string;
  right?: string;
  middle?: string;
  onLeft?: () => void;
  onRight?: () => void;
  onMiddle?: () => void;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  middleIcon?: LucideIcon;
  rightDisabled?: boolean;
  middleLoading?: boolean;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[#e5eaf1] pt-4 sm:flex-row sm:items-center sm:justify-between">
      {left ? (
        <ActionButton icon={LeftIcon} onClick={onLeft}>{left}</ActionButton>
      ) : <span />}
      <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:flex-row">
        {middle && <ActionButton icon={MiddleIcon} onClick={onMiddle}>{middleLoading ? "Recalculando..." : middle}</ActionButton>}
        {right && <PrimaryButton icon={rightIcon} onClick={onRight} disabled={rightDisabled} className="justify-center">{right}</PrimaryButton>}
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
  icon: Icon,
}: {
  title: string;
  rows: Array<[string, string]>;
  total?: [string, string];
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-[270px] flex-col rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-5 flex items-center gap-3">{Icon && <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f1faed] text-[#178000]"><Icon className="h-5 w-5" /></span>}<h3 className="text-[15px] font-extrabold text-[#0f172a]">{title}</h3></div>
      <div className="space-y-3">
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`} className={cn("flex justify-between gap-4 text-[12px]", index === 2 && total && "border-t border-[#e5eaf1] pt-3")}>
            <span className="text-[#334155]">{label}</span>
            <span className="text-right font-semibold">{value}</span>
          </div>
        ))}
        {total && (
          <div className="mt-auto flex justify-between gap-4 border-t border-[#e5eaf1] pt-3 text-[14px] font-extrabold text-[#0f172a]">
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
  onEdit,
  onCopy,
}: {
  expanded?: boolean;
  items?: NfeItem[];
  onDelete?: (itemId: string) => void;
  onEdit?: (itemId: string) => void;
  onCopy?: (itemId: string) => void;
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
            <Fragment key={item.id}>
              <tr className="border-b border-[#e5eaf1] align-top">
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
                <td className="px-3 py-4"><TableActions expanded={index === 0} onDelete={onDelete ? () => onDelete(item.id) : undefined} onEdit={onEdit ? () => onEdit(item.id) : undefined} onCopy={onCopy ? () => onCopy(item.id) : undefined} /></td>
              </tr>
              {expanded && index === 0 && (
                <tr className="border-b border-[#e5eaf1]">
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
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableActions({ expanded, onDelete, onEdit, onCopy }: { expanded?: boolean; onDelete?: () => void; onEdit?: () => void; onCopy?: () => void }) {
  return (
    <div className="flex items-center gap-1">
      {onEdit && <IconSquare icon={Edit2} title="Editar item" onClick={onEdit} />}
      {onCopy && <IconSquare icon={Copy} title="Copiar item" onClick={onCopy} />}
      {onDelete && <IconSquare icon={Trash2} title="Excluir item" onClick={onDelete} />}
      <ChevronDown className={cn("h-4 w-4 text-[#0f172a]", expanded && "rotate-180")} />
    </div>
  );
}

function IconSquare({ icon: Icon, title, onClick }: { icon: LucideIcon; title?: string; onClick?: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md border border-[#d6dee9] bg-white">
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

function LookupDialog({
  open,
  kind,
  query,
  loading,
  error,
  results,
  onClose,
  onQueryChange,
  onSearch,
  onSelect,
}: {
  open: boolean;
  kind: LookupKind;
  query: string;
  loading: boolean;
  error: string | null;
  results: LookupResult[];
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (result: LookupResult) => void;
}) {
  const config = {
    client: {
      title: "Buscar cliente",
      description: "Localize o destinatário e preencha o rascunho da NF-e.",
      placeholder: "Digite CNPJ, CPF, nome ou fantasia",
    },
    product: {
      title: "Buscar produto",
      description: "Encontre o item fiscal e carregue a composição para a nota.",
      placeholder: "Digite código, descrição, NCM ou CFOP",
    },
    carrier: {
      title: "Buscar transportadora",
      description: "Selecione a transportadora para preencher o transporte da NF-e.",
      placeholder: "Digite razão social, CNPJ, cidade ou RNTRC",
    },
  }[kind];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{config.title}</DialogTitle>
        <DialogDescription>{config.description}</DialogDescription>
        <div className="mt-4 flex gap-2">
          <Control value={query} onChange={onQueryChange} icon={Search} placeholder={config.placeholder} />
          <PrimaryButton icon={Search} onClick={onSearch} className="shrink-0">
            {loading ? "Buscando..." : "Buscar"}
          </PrimaryButton>
        </div>
        {error && <div className="mt-3 rounded-md border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-[12px] font-semibold text-[#b42318]">{error}</div>}
        <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
          {loading ? (
            <div className="rounded-md border border-[#dbe3ec] bg-[#f8fafc] p-3 text-[12px] text-[#475569]">Buscando registros...</div>
          ) : results.length === 0 ? (
            <div className="rounded-md border border-[#dbe3ec] bg-[#f8fafc] p-3 text-[12px] text-[#475569]">
              Use a busca acima para carregar resultados.
            </div>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelect(result)}
                className="flex w-full items-start justify-between gap-3 rounded-md border border-[#e5eaf1] px-3 py-2 text-left text-[12px] hover:bg-[#f8fafc]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#0f172a]">{result.title}</div>
                  <div className="mt-0.5 text-[#475569]">{result.subtitle}</div>
                </div>
                <div className="shrink-0 text-right text-[#64748b]">{result.meta}</div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgressCard({ note }: { note: NfeDocumentDetail }) {
  const steps = buildTransmissionRows(note, false);

  return (
    <Panel title="Progresso da Transmissão" subtitle="Os estados abaixo refletem o que já foi persistido pela API." dense>
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

function SuccessBanner({ note, compact }: { note: NfeDocumentDetail; compact?: boolean }) {
  const authorized = note.status === "AUTORIZADA" || Boolean(note.authorization);
  const returnRecord = note.sefazReturn || null;
  const authDate = note.authorization?.dataAutorizacao || returnRecord?.dhRecebto || note.updatedAt;
  const title = authorized
    ? "NF-e Autorizada com Sucesso!"
    : note.status === "PROCESSANDO_SEFAZ"
      ? "SEFAZ processando a NF-e"
      : note.status === "TRANSMITINDO"
        ? "NF-e em transmissão"
        : "NF-e aguardando retorno";
  const subtitle = authorized
    ? "A nota fiscal eletrônica foi autorizada pela SEFAZ com sucesso."
    : returnRecord
      ? `SEFAZ retornou ${returnRecord.cStat || "—"} · ${returnRecord.xMotivo || "Registro disponível"}.`
      : "A NF-e ainda está aguardando retorno da SEFAZ.";

  return (
    <div className={cn(panelClass, authorized ? "border-[#86c97c] bg-[#fbfff8] p-5" : "border-[#f2bb4f] bg-[#fffaf0] p-5")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("grid rounded-full text-white", compact ? "h-7 w-7" : "h-12 w-12", authorized ? "bg-[#2ea736]" : "bg-[#d89a00]")}>
            <Check className={cn("place-self-center", compact ? "h-5 w-5" : "h-8 w-8")} />
          </div>
          <div>
            <h2 className={cn("font-extrabold", compact ? "text-[17px]" : "text-[22px]", authorized ? "text-[#166a00]" : "text-[#b25d00]")}>
              {title}
            </h2>
            <p className={cn("mt-1 text-[13px]", authorized ? "text-[#166a00]" : "text-[#b25d00]")}>{subtitle}</p>
          </div>
        </div>
        <ActionButton icon={ExternalLink} onClick={() => void openDanfeFromApi(note, "view")}>Visualizar DANFE</ActionButton>
      </div>
      <div className="mt-5 grid gap-4 text-[12px] md:grid-cols-4">
        <KeyValue title="Chave de Acesso" value={getPrimaryAccessKey(note) || "Aguardando emissao"} />
        <KeyValue title="Protocolo de Autorizacao" value={getPrimaryProtocol(note) || "Aguardando autorizacao"} />
        <KeyValue title="Data/Hora" value={formatDateTimeDisplay(authDate) || "Aguardando"} />
        <KeyValue title="Ambiente" value={formatEnvironmentLabel(note.authorization?.ambiente || returnRecord?.ambiente || note.ambiente)} />
      </div>
    </div>
  );
}

function KeyValue({ title, value }: { title: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#334155]">{title}</div>
      <div className="mt-2 break-words text-[12px] font-extrabold text-[#0f172a]">{value}</div>
    </div>
  );
}

function InvoiceSummaryCard({ note }: { note: NfeDocumentDetail }) {
  const validation = note.validations?.[0] || null;
  const finalidadeText = {
    "1": "Normal",
    "2": "Complementar",
    "3": "Ajuste",
    "4": "Devolucao",
  }[String(note.finalidade || "")] || "Normal";
  const rows: Row[] = [
    { label: "Modelo", value: `${note.modelo || "55"} - NF-e` },
    { label: "Série / Número", value: noteSeriesNumber(note) },
    { label: "Data de Emissão", value: formatDateTimeDisplay(note.dataEmissao) || "Aguardando emissao" },
    { label: "Natureza da Operação", value: note.naturezaOperacao || "Nao informada" },
    { label: "Tipo de Operação", value: note.tipoOperacao === "1" ? "1 - Saída" : note.tipoOperacao === "0" ? "0 - Entrada" : "Nao informado" },
    { label: "Finalidade", value: note.finalidade ? `${note.finalidade} - ${finalidadeText}` : "Nao informada" },
    { label: "Ambiente", value: formatEnvironmentLabel(note.ambiente) },
    { label: "Validação", value: validation ? `Score ${validation.score}/100` : "Sem validacao" },
    { label: "Processo / Pedido", value: note.pedidoRef || "Nao informado" },
    { label: "Valor Total da Nota", value: formatCurrency(note.totals?.valorTotal), strong: true, green: true },
  ];
  return (
    <RowsCard
      title="Resumo da Nota Fiscal"
      rows={rows}
      compact
    />
  );
}

function AuthorizationInfoCard({ note, title, badge }: { note: NfeDocumentDetail; title: string; badge?: string }) {
  const authorization = note.authorization || null;
  const sefazReturn = note.sefazReturn || null;
  const effectiveBadge = badge || statusLabel(note.status);
  return (
    <Panel
      title={title}
      actions={<span className={cn("rounded-md border px-3 py-1 text-[12px] font-extrabold", authorization || note.status === "AUTORIZADA" ? "border-[#9ccc8c] bg-[#f4fbef] text-[#166a00]" : "border-[#f0c66b] bg-[#fff8e8] text-[#b25d00]")}>{effectiveBadge}</span>}
      dense
    >
      <div className="grid gap-4 md:grid-cols-3">
        <KeyValue title="cStat" value={authorization?.cStat || sefazReturn?.cStat || note.cStat || "—"} />
        <KeyValue title="Mensagem" value={authorization?.xMotivo || sefazReturn?.xMotivo || note.xMotivo || "Aguardando retorno da SEFAZ"} />
        <KeyValue title="Protocolo de Autorização" value={authorization?.protocolo || sefazReturn?.protocolo || note.protocolo || "—"} />
        <KeyValue title="Recibo" value={sefazReturn?.nRec || note.nRec || "—"} />
        <KeyValue title="Data/Hora" value={formatDateTimeDisplay(authorization?.dataAutorizacao || sefazReturn?.dhRecebto || note.updatedAt) || "—"} />
        <KeyValue title="Tempo de Resposta" value={sefazReturn?.tempoMedio != null ? `${sefazReturn.tempoMedio} s` : "—"} />
        <KeyValue title="Ambiente SEFAZ" value={formatEnvironmentLabel(authorization?.ambiente || sefazReturn?.ambiente || note.ambiente)} />
        <KeyValue title="UF" value={sefazReturn?.uf || note.emitente?.uf || "—"} />
        <KeyValue title="Chave de Acesso" value={getPrimaryAccessKey(note) || "—"} />
      </div>
    </Panel>
  );
}

function FilesCard({ title, note }: { title: string; note: NfeDocumentDetail }) {
  const files = [...(note.files || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <Panel title={title} subtitle="Documentos relacionados à NF-e autorizada." dense>
      <table className="w-full text-left text-[12px]">
        <thead className="bg-[#f8fafc]">
          <tr>{["Documento", "Descrição", "Arquivo", "Data/Hora", "Tamanho", "Ações"].map((head) => <th key={head} className="border-y border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>)}</tr>
        </thead>
        <tbody>
          {files.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-5 text-center text-[12px] text-[#64748b]">
                Nenhum arquivo gerado ainda.
              </td>
            </tr>
          ) : files.map((file) => {
            const fileMeta = getNfeFilePreviewMeta(file.tipo);
            const fileName = file.storageKey.split("/").pop() || file.storageKey;
            return (
              <tr key={file.id} className="border-b border-[#e5eaf1]">
                <td className="px-3 py-2 font-bold">{fileMeta.label}</td>
                <td className="px-3 py-2">{fileMeta.description}</td>
                <td className="px-3 py-2 font-bold text-[#0066d9]">{fileName}</td>
                <td className="px-3 py-2">{formatDateTimeDisplay(file.createdAt) || "—"}</td>
                <td className="px-3 py-2">{formatBytes(file.fileSize)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <IconSquare icon={Eye} title="Visualizar arquivo" onClick={() => void handleNfeFileAction(note, file, "view")} />
                    <IconSquare icon={Download} title="Baixar arquivo" onClick={() => void handleNfeFileAction(note, file, "download")} />
                    <IconSquare icon={Printer} title="Imprimir arquivo" onClick={() => void handleNfeFileAction(note, file, "print")} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function SefazLogCard({ note }: { note: NfeDocumentDetail }) {
  const rows = buildSefazTimelineRows(note);
  return (
    <Panel title="Log da SEFAZ" subtitle="Histórico completo do processamento da NF-e na SEFAZ." dense>
      <table className="w-full text-left text-[12px]">
        <thead className="bg-[#f8fafc]">
          <tr>{["Data/Hora", "Etapa", "cStat", "Descrição", "Tempo"].map((head) => <th key={head} className="border-y border-[#e5eaf1] px-3 py-2 font-bold">{head}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-5 text-center text-[12px] text-[#64748b]">
                Nenhum retorno de SEFAZ registrado ainda.
              </td>
            </tr>
          ) : rows.map((row) => (
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

function StatusProcessCard({ note, compact }: { note: NfeDocumentDetail; compact?: boolean }) {
  const rows = buildTransmissionRows(note, Boolean(compact));

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

function DanfeDocument({ note }: { note: NfeDocumentDetail }) {
  const emitter = note.emitente;
  const authorization = note.authorization || null;
  const sefazReturn = note.sefazReturn || null;
  const items = [...(note.items || [])];
  const installments = [...(note.billing?.installments || [])];
  const volumes = [...(note.transport?.volumes || [])];
  const accessKey = getPrimaryAccessKey(note);
  const protocol = getPrimaryProtocol(note);
  const receipt = getPrimaryReceipt(note);
  const status = normalizeStatusCode(note.status);
  const emitterDisplay = emitter?.tradeName || emitter?.legalName || "Emitente não informado";
  const emitterInitials =
    emitterDisplay
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "NF";
  const accessKeyDisplay = formatAccessKeyDisplay(accessKey);
  const emissionDate = formatDateDisplay(note.dataEmissao) || "—";
  const authDate = formatDateTimeDisplay(authorization?.dataAutorizacao || sefazReturn?.dhRecebto || note.updatedAt) || "—";
  const recipientDocument = formatDocument(note.destinatarioCnpj || note.destinatarioCpf) || "—";
  const recipientType = note.destinatarioCnpj ? "CNPJ" : note.destinatarioCpf ? "CPF" : "Documento";
  const transport = note.transport || null;
  const isAuthorized = status === "AUTORIZADA" || Boolean(authorization);

  const itemRows = items.map((item) => [
    String(item.itemNumber),
    item.productCode || "—",
    item.description,
    [item.ncm, item.cest].filter(Boolean).join(" / ") || "—",
    item.cfop || "—",
    item.unidade || "—",
    formatNumber(item.quantidade, 4),
    formatCurrency(item.valorUnitario),
    formatCurrency(item.descontoValor),
    formatCurrency(item.valorTotal),
    item.cst || item.csosn || "—",
    item.origem != null ? String(item.origem) : "—",
  ]);

  const installmentRows = installments.map((installment) => [
    installment.numero,
    formatDateDisplay(installment.dataVencimento) || "—",
    formatCurrency(installment.valor),
  ]);

  const volumeRows = volumes.map((volume, index) => [
    String(index + 1),
    volume.quantidade != null ? formatNumber(volume.quantidade, 0) : "—",
    volume.especie || "—",
    volume.marca || "—",
    volume.numeracao || "—",
    volume.pesoBruto != null ? formatNumber(volume.pesoBruto, 3) : "—",
    volume.pesoLiquido != null ? formatNumber(volume.pesoLiquido, 3) : "—",
  ]);

  return (
    <div className="overflow-auto rounded-md bg-[#e5e7eb] p-3">
      <div className="mx-auto w-[920px] bg-white p-3 text-black shadow-sm">
        <div className="grid grid-cols-[1.1fr_0.9fr] border border-black text-[10px]">
          <div className="border-r border-black p-2">
            <div className="font-bold uppercase leading-4">
              Recebemos de {emitterDisplay.toUpperCase()} os produtos / serviços constantes da nota fiscal indicada ao lado
            </div>
            <div className="mt-2 grid grid-cols-[140px_1fr] border border-black">
              <div className="border-r border-black p-2">Data de recebimento</div>
              <div className="p-2">Identificação e assinatura do recebedor</div>
            </div>
          </div>
          <div className="grid place-items-center p-2 text-center">
            <div className="text-2xl font-black">NF-e</div>
            <div className="text-lg">Nº {noteSeriesNumber(note)}</div>
            <div className="text-lg font-bold">SÉRIE {note.serie || "—"}</div>
            <div className={cn("mt-2 rounded border px-2 py-1 text-[9px] font-bold", isAuthorized ? "border-[#9ccc8c] bg-[#f4fbef] text-[#166a00]" : "border-[#f0c66b] bg-[#fff8e8] text-[#b25d00]")}>
              {statusLabel(note.status)}
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[1.35fr_0.75fr_1.4fr] border border-black text-[10px]">
          <div className="flex items-center gap-4 border-r border-black p-4">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg border border-black bg-gradient-to-br from-[#0d5a3a] to-[#edf7d2] text-center text-[24px] font-black leading-none text-white">
              {emitterInitials}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-black uppercase leading-4">{emitterDisplay}</div>
              <div className="mt-2 space-y-1 leading-4">
                <div>{emitter?.legalName || emitterDisplay}</div>
                <div>CNPJ: {formatDocument(emitter?.cnpj) || "—"}</div>
                <div>IE: {emitter?.stateRegistration || "—"}</div>
                <div>
                  {emitter?.city || "—"} - {emitter?.uf || "—"}
                </div>
                <div>CRT: {emitter?.crt || "—"}</div>
              </div>
            </div>
          </div>
          <div className="border-r border-black p-3 text-center">
            <div className="text-2xl font-black">DANFE</div>
            <div className="font-bold">
              Documento auxiliar
              <br />
              da nota fiscal
              <br />
              eletrônica
            </div>
            <div className="mt-3">
              0 - ENTRADA
              <br />
              1 - SAÍDA <span className="ml-2 border border-black px-2 py-1 text-lg">{note.tipoOperacao === "1" ? 1 : 0}</span>
            </div>
            <div className="mt-3 text-[9px] font-bold uppercase leading-4">{formatEnvironmentLabel(note.ambiente)}</div>
          </div>
          <div>
            <div className="grid h-20 place-items-center border-b border-black p-2">
              <div className="h-14 w-[330px] bg-[repeating-linear-gradient(90deg,#000_0,#000_2px,#fff_2px,#fff_4px,#000_4px,#000_5px,#fff_5px,#fff_8px)]" />
            </div>
            <div className="border-b border-black p-2">
              <div>Chave de acesso</div>
              <div className="text-[11px] font-black leading-4 tracking-[0.08em]">{accessKeyDisplay}</div>
            </div>
            <div className="p-2 text-center leading-4">
              Consulta de autenticidade no portal nacional da NF-e
              <br />
              {protocol ? `Protocolo ${protocol}` : "Aguardando protocolo de autorização"}
            </div>
          </div>
        </div>

        <DanfeSection
          title="Identificação da nota"
          columns={4}
          cells={[
            ["Modelo", `${note.modelo || "55"} - NF-e`],
            ["Série / Número", noteSeriesNumber(note)],
            ["Natureza da operação", note.naturezaOperacao || "—"],
            ["Finalidade", `${note.finalidade || "—"} - ${finalidadeLabel(note.finalidade)}`],
            ["Tipo de operação", tipoOperacaoLabel(note.tipoOperacao)],
            ["CFOP", note.cfop || "—"],
            ["Ambiente", formatEnvironmentLabel(note.ambiente)],
            ["Situação", statusLabel(note.status)],
            ["Data de emissão", emissionDate],
            ["Hora da saída", note.horaSaida || "—"],
            ["Recibo", receipt || "—"],
            ["Autorização", authDate],
          ]}
        />

        <DanfeSection
          title="Destinatário / Remetente"
          columns={4}
          cells={[
            ["Nome / Razão social", note.destinatarioNome || "—"],
            [recipientType, recipientDocument],
            ["Inscrição Estadual", note.destinatarioIe || "—"],
            ["UF", note.destinatarioUf || "—"],
            ["Data da emissão", emissionDate],
            ["Hora da saída", note.horaSaida || "—"],
            ["Consumidor final", note.consumoFinal === true ? "Sim" : note.consumoFinal === false ? "Não" : "—"],
            ["Indicador de presença", note.indicadorPresenca || "—"],
          ]}
        />

        <DanfeSection
          title="Identificação do emitente"
          columns={4}
          cells={[
            ["Razão social", emitter?.legalName || "—"],
            ["Nome fantasia", emitter?.tradeName || "—"],
            ["CNPJ", formatDocument(emitter?.cnpj) || "—"],
            ["Inscrição Estadual", emitter?.stateRegistration || "—"],
            ["Município", emitter?.city || "—"],
            ["UF", emitter?.uf || "—"],
            ["CRT", emitter?.crt || "—"],
            ["Ambiente", formatEnvironmentLabel(emitter?.environment)],
          ]}
        />

        <DanfeTableSection
          title="Dados dos produtos / serviços"
          columns={["#", "Código", "Descrição", "NCM / CEST", "CFOP", "Un.", "Qtd.", "Vlr. Unit.", "Desc.", "Total", "CST/CSOSN", "Origem"]}
          rows={itemRows}
          emptyMessage="Nenhum item informado nesta NF-e."
        />

        <DanfeSection
          title="Cálculo do imposto"
          columns={5}
          cells={[
            ["Base de cálculo do ICMS", formatCurrency(note.totals?.totalIcmsBase)],
            ["Valor do ICMS", formatCurrency(note.totals?.totalIcms)],
            ["Base ICMS ST", formatCurrency(note.totals?.totalIcmsStBase)],
            ["Valor ICMS ST", formatCurrency(note.totals?.totalIcmsSt)],
            ["Valor total dos produtos", formatCurrency(note.totals?.valorProdutos)],
            ["Valor do frete", formatCurrency(note.totals?.frete)],
            ["Valor do seguro", formatCurrency(note.totals?.seguro)],
            ["Desconto", formatCurrency(note.totals?.desconto)],
            ["Outras despesas", formatCurrency(note.totals?.outrasDespesas)],
            ["Valor do IPI", formatCurrency(note.totals?.totalIpi)],
            ["Valor do PIS", formatCurrency(note.totals?.totalPis)],
            ["Valor da COFINS", formatCurrency(note.totals?.totalCofins)],
            ["Total de tributos", formatCurrency(note.totals?.totalTributos)],
            ["ICMS desonerado", formatCurrency(note.totals?.icmsDesonerado)],
            ["Valor total da nota", formatCurrency(note.totals?.valorTotal)],
          ]}
        />

        <DanfeSection
          title="Transportador / volumes transportados"
          columns={5}
          cells={[
            ["Razão social", transport?.nomeTransportadora || "—"],
            ["Frete por conta", transportFreightLabel(transport?.modalidadeFrete)],
            ["CNPJ / CPF", formatDocument(transport?.cnpjTransportadora) || "—"],
            ["IE", transport?.ieTransportadora || "—"],
            ["Endereço", transport?.enderecoTransportadora || "—"],
            ["Município", transport?.municipioTransportadora || "—"],
            ["UF", transport?.ufTransportadora || "—"],
            ["Placa", transport?.placaVeiculo || "—"],
            ["UF placa", transport?.ufPlaca || "—"],
            ["RNTC", transport?.rntc || "—"],
          ]}
        />

        <DanfeTableSection
          title="Volumes transportados"
          columns={["#", "Qtd.", "Espécie", "Marca", "Numeração", "Peso bruto", "Peso líquido"]}
          rows={volumeRows}
          emptyMessage="Nenhum volume informado."
        />

        <DanfeTableSection
          title="Fatura / duplicatas"
          columns={["Nº", "Vencimento", "Valor"]}
          rows={installmentRows}
          emptyMessage="Nenhuma duplicata persistida."
        />

        <DanfeSection
          title="Informações complementares"
          columns={2}
          cells={[
            ["Informações adicionais", note.additionalInfo || "—"],
            ["Informações ao fisco", note.fiscoInfo || "—"],
            ["Referência do pedido", note.pedidoRef || "—"],
            ["Justificativa", note.justificativa || "—"],
          ]}
        />

        <DanfeSection
          title="Autorização / retorno SEFAZ"
          columns={4}
          cells={[
            ["cStat", authorization?.cStat || sefazReturn?.cStat || note.cStat || "—"],
            ["Mensagem", authorization?.xMotivo || sefazReturn?.xMotivo || note.xMotivo || "Aguardando retorno da SEFAZ"],
            ["Recibo", sefazReturn?.nRec || note.nRec || "—"],
            ["Protocolo", authorization?.protocolo || sefazReturn?.protocolo || note.protocolo || "—"],
            ["Data / hora", authorization?.dataAutorizacao || sefazReturn?.dhRecebto ? formatDateTimeDisplay(authorization?.dataAutorizacao || sefazReturn?.dhRecebto) : authDate],
            ["Ambiente", formatEnvironmentLabel(authorization?.ambiente || sefazReturn?.ambiente || note.ambiente)],
            ["UF", sefazReturn?.uf || emitter?.uf || "—"],
            ["XML DANFE", note.xmlDanfe || "—"],
          ]}
        />
      </div>
    </div>
  );
}

function DanfeSection({
  title,
  cells,
  columns = 4,
}: {
  title: string;
  cells: Array<[string, ReactNode]>;
  columns?: 2 | 3 | 4 | 5;
}) {
  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-3"
        : columns === 5
          ? "grid-cols-5"
          : "grid-cols-4";

  return (
    <section className="mt-2 border border-black text-[10px]">
      <div className="border-b border-black px-2 py-1 font-black">{title}</div>
      <div className={cn("grid", gridClass)}>
        {cells.map(([label, value], index) => {
          const isLastColumn = (index + 1) % columns === 0;
          return (
            <div key={`${label}-${index}`} className={cn("min-h-12 border-b border-r border-black p-2", isLastColumn && "border-r-0")}>
              <div className="text-[8px] uppercase tracking-[0.04em] text-[#111]">{label}</div>
              <div className="mt-1 break-words text-[11px] font-bold leading-4">{value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DanfeTableSection({
  title,
  columns,
  rows,
  emptyMessage,
}: {
  title: string;
  columns: string[];
  rows: ReactNode[][];
  emptyMessage: string;
}) {
  return (
    <section className="mt-2 border border-black text-[9px]">
      <div className="border-b border-black px-2 py-1 font-black">{title}</div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-r border-black px-2 py-1 font-black last:border-r-0">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border-b border-black px-2 py-3 text-center text-[10px]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="align-top">
                  {columns.map((_, cellIndex) => (
                    <td key={`${title}-${index}-${cellIndex}`} className="border-b border-r border-black px-2 py-2 last:border-r-0">
                      <div className="break-words leading-4">{row[cellIndex] ?? "—"}</div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
