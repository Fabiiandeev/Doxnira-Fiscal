import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CircleDollarSign,
  FileArchive,
  FileBarChart,
  FileClock,
  FileText,
  LayoutDashboard,
  ReceiptText,
  ShieldAlert,
  Signature,
  Truck,
} from "lucide-react";

import type { FiscalModuleKey } from "@/lib/fiscal-types";

export type FiscalRouteStatus = "ready" | "scaffold";

export interface FiscalRouteCard {
  key: FiscalModuleKey;
  href: string;
  title: string;
  description: string;
  status: FiscalRouteStatus;
  statusLabel: string;
  icon: LucideIcon;
  highlights: string[];
  actionLabel: string;
}

export const fiscalRouteCards: FiscalRouteCard[] = [
  {
    key: "fiscal",
    href: "/fiscal",
    title: "Central Fiscal",
    description: "Mapa-base da arquitetura fiscal, com rotas registradas e trilha de auditoria pronta para evolucao.",
    status: "ready",
    statusLabel: "Base pronta",
    icon: LayoutDashboard,
    highlights: ["Rotas unificadas", "Validacao compartilhada", "Auditoria local"],
    actionLabel: "Abrir central",
  },
  {
    key: "nfe",
    href: "/nfe",
    title: "NF-e",
    description: "Lista operacional da NF-e com rascunhos, filtros, validacao e transmissao apoiada pelo backend existente.",
    status: "ready",
    statusLabel: "Operacional",
    icon: FileText,
    highlights: ["Rascunhos", "Validacao", "DANFE"],
    actionLabel: "Ver NF-e",
  },
  {
    key: "nfce",
    href: "/nfce",
    title: "NFC-e",
    description: "Base do fluxo NFC-e modelo 65 para emissao rapida, contingencia e QR Code preparado.",
    status: "scaffold",
    statusLabel: "Estrutura base",
    icon: ReceiptText,
    highlights: ["Consumidor final", "indPres", "CSC/token"],
    actionLabel: "Abrir base",
  },
  {
    key: "nfse",
    href: "/nfse",
    title: "NFS-e",
    description: "Arquitetura preparada para provider factory por municipio e integracao com o checklist nacional.",
    status: "scaffold",
    statusLabel: "Base pronta",
    icon: Signature,
    highlights: ["ABRASF", "GINFES", "Betha / IPM / DSF"],
    actionLabel: "Ver arquitetura",
  },
  {
    key: "cte",
    href: "/cte",
    title: "CT-e",
    description: "Ponto de entrada para CT-e de entrada e saida, com vinculacao de NF-e, XML e logs operacionais.",
    status: "scaffold",
    statusLabel: "Base operacional",
    icon: Truck,
    highlights: ["NF-e vinculada", "Transportadora", "XML / eventos"],
    actionLabel: "Abrir CT-e",
  },
  {
    key: "xml-fiscal",
    href: "/xml-fiscal",
    title: "XML Fiscal",
    description: "Central de documentos XML para NF-e, NFC-e, NFS-e e CT-e com importacao, validacao e exportacao.",
    status: "ready",
    statusLabel: "Pronto",
    icon: FileArchive,
    highlights: ["Upload", "Busca por chave", "ZIP / comparacao"],
    actionLabel: "Abrir XML",
  },
  {
    key: "rejeicoes",
    href: "/rejeicoes",
    title: "Rejeicoes",
    description: "Central de rejeicoes com explicacao simples, impacto e caminho seguro para auto-fix.",
    status: "ready",
    statusLabel: "Pronto",
    icon: ShieldAlert,
    highlights: ["Codigo SEFAZ", "xMotivo", "Correcoes seguras"],
    actionLabel: "Abrir rejeicoes",
  },
  {
    key: "sped",
    href: "/sped",
    title: "SPED",
    description: "Base para EFD ICMS/IPI e EFD Contribuicoes, com validacoes iniciais e geracao preparada.",
    status: "scaffold",
    statusLabel: "Estrutura base",
    icon: FileBarChart,
    highlights: ["Blocos basicos", "Validacao", "Arquivo mock/preparado"],
    actionLabel: "Ver SPED",
  },
  {
    key: "sintegra",
    href: "/sintegra",
    title: "SINTEGRA",
    description: "Estrutura inicial para registros, validacao e historico de arquivos SINTEGRA.",
    status: "scaffold",
    statusLabel: "Estrutura base",
    icon: BarChart3,
    highlights: ["Registros basicos", "Validacao", "Historico"],
    actionLabel: "Ver SINTEGRA",
  },
  {
    key: "fechamento-fiscal",
    href: "/fechamento-fiscal",
    title: "Fechamento Fiscal",
    description: "Painel mensal consolidado para entradas, saidas, impostos e divergencias por empresa.",
    status: "ready",
    statusLabel: "Pronto",
    icon: FileClock,
    highlights: ["Consolidacao", "Divergencias", "Guia pendente"],
    actionLabel: "Abrir fechamento",
  },
  {
    key: "previsao-impostos",
    href: "/previsao-impostos",
    title: "Previsao de Impostos",
    description: "Visao gerencial de projecao e comparacao mensal para ICMS, IPI, PIS, COFINS e demais tributos.",
    status: "ready",
    statusLabel: "Pronto",
    icon: CircleDollarSign,
    highlights: ["ICMS / IPI", "PIS / COFINS", "Comparacao mensal"],
    actionLabel: "Abrir previsao",
  },
  {
    key: "guias",
    href: "/guias",
    title: "Guias",
    description: "Central de DAS, DARF, GNRE e demais obrigacoes com vencimento, valor e conciliacao financeira.",
    status: "scaffold",
    statusLabel: "Estrutura base",
    icon: BookOpen,
    highlights: ["DAS", "DARF / GNRE", "Baixa financeira"],
    actionLabel: "Ver guias",
  },
];

export function getFiscalRouteCard(key: FiscalModuleKey) {
  return fiscalRouteCards.find((card) => card.key === key);
}
