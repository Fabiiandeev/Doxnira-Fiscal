"use client";

import { Construction } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SystemState } from "@/components/system/system-state";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";

const placeholderCopy: Record<string, { title: string; description: string }> = {
  "/fiscal-intelligence": {
    title: "Fiscal Intelligence",
    description: "Dashboard fiscal executivo preparado para indicadores, filtros e exportações.",
  },
  "/commerce-intelligence": {
    title: "Commerce Intelligence",
    description: "Central comercial preparada para produtos, margens, estoque e marketplaces.",
  },
  "/doxnira-insights": {
    title: "Doxnira Insights",
    description: "Área reservada para recomendações operacionais e fiscais auditáveis.",
  },
  "/decision-center": {
    title: "Centro de Decisão",
    description: "Painel preparado para priorização de riscos, oportunidades e automações.",
  },
  "/benchmark": {
    title: "Benchmark",
    description: "Estrutura pronta para comparação segura de indicadores por segmento.",
  },
  "/commerce": {
    title: "Dashboard Commerce",
    description: "Visão comercial preparada para os próximos módulos de marketplace.",
  },
  "/documents/incoming": {
    title: "NF-e Entrada",
    description: "Área preparada para listar, filtrar e importar documentos fiscais de entrada.",
  },
  "/documents/outgoing": {
    title: "NF-e Saída",
    description: "Área preparada para listar, filtrar e auditar documentos fiscais de saída.",
  },
  "/marketplaces/mercado-livre": {
    title: "Mercado Livre",
    description: "Integração oficial preparada para OAuth, anúncios, pedidos e sincronização.",
  },
  "/marketplaces/shopee": {
    title: "Shopee",
    description: "Integração oficial preparada para contas, pedidos, estoque e campanhas.",
  },
  "/stock": {
    title: "Estoque",
    description: "Base preparada para saldo, movimentações, reservas e inteligência de compra.",
  },
  "/accountant": {
    title: "Dashboard Contador",
    description: "Portal contábil preparado para empresas, pendências, fechamentos e valor entregue.",
  },
};

function titleFromPath(segments: string[]) {
  if (segments.length === 0) return "Módulo";
  return segments
    .at(-1)!
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ModulePlaceholderView({ segments }: { segments: string[] }) {
  const path = `/${segments.join("/")}`;
  const copy = placeholderCopy[path] ?? {
    title: titleFromPath(segments),
    description: "Rota registrada na arquitetura para receber implementação nas próximas sprints.",
  };

  return (
    <>
      <PageHeader
        eyebrow="Arquitetura do sistema"
        title={copy.title}
        description={copy.description}
        icon={Construction}
      />
      <SystemState
        kind="placeholder"
        title={copy.title}
        description={copy.description}
        status="Em desenvolvimento"
        action={
          <Button
            variant="lime"
            onClick={() =>
              notify({
                title: "Módulo em desenvolvimento",
                description: "A rota está ativa e pronta para receber a implementação funcional.",
              })
            }
          >
            Em desenvolvimento
          </Button>
        }
      />
    </>
  );
}
