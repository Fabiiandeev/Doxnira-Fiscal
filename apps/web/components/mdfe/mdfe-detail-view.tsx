"use client";

import { ArrowLeft, FileDown, Pencil, RefreshCw, Send, UserPlus, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { usePermissionsContext } from "@/components/providers/permissions-provider";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Mdfe } from "@/lib/mdfe-types";
import { mdfeService } from "@/lib/services/mdfe-service";
import { MdfeAuditPanel } from "./mdfe-audit-panel";
import { MdfeDamdfeViewer } from "./mdfe-damdfe-viewer";
import { MdfeEventsPanel } from "./mdfe-events-panel";
import { MdfeStatusBadge } from "./mdfe-status-badge";
import { MdfeValidationPanel } from "./mdfe-validation-panel";
import { MdfeXmlPanel } from "./mdfe-xml-panel";

export function MdfeDetailView({ mdfeId }: { mdfeId: string }) {
  const { hasPermission } = usePermissionsContext();
  const [mdfe, setMdfe] = useState<Mdfe | null>(null);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);

  async function load() {
    try {
      const [item, itemEvents, itemAudit] = await Promise.all([
        mdfeService.get(mdfeId), mdfeService.events(mdfeId), mdfeService.audit(mdfeId),
      ]);
      setMdfe(item); setEvents(itemEvents); setAudit(itemAudit);
    } catch (error) {
      notify({ title: "MDF-e não carregado", description: (error as Error).message, tone: "error" });
    }
  }
  useEffect(() => { void load(); }, [mdfeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(label: string, action: () => Promise<unknown>) {
    try {
      await action(); notify({ title: label, tone: "success" }); await load();
    } catch (error) {
      notify({ title: `${label} não concluído`, description: (error as Error).message, tone: "error" });
    }
  }

  if (!mdfe) return <Card className="p-8 text-sm text-subtle">Carregando MDF-e…</Card>;
  const artifactEnabled = ["SIGNED", "AUTHORIZING", "AUTHORIZED", "IN_TRANSIT", "CANCELLED", "CLOSED", "ERROR"].includes(mdfe.status);
  const validationIssues = (mdfe.validations ?? []).map((entry) => ({
    code: String(entry.code ?? "MDFE_VALIDATION"),
    severity: entry.severity ?? "BLOCKING",
    message: String((entry as Record<string, unknown>).message ?? (entry as Record<string, unknown>).title ?? "Pendência fiscal"),
    field: entry.field,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`MDF-e ${mdfe.environment === "production" ? "Produção" : "Homologação"}`}
        title={`${mdfe.number ?? "—"}/${mdfe.series ?? "1"}`}
        description={mdfe.accessKey ? `Chave ${mdfe.accessKey}` : "Documento ainda sem chave de acesso gerada."}
        action={<MdfeStatusBadge status={mdfe.status} />}
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href="/mdfe"><ArrowLeft className="h-4 w-4" /> Lista</Link></Button>
        {hasPermission("fiscal.mdfe.update") && ["DRAFT", "VALIDATION_FAILED", "READY_TO_AUTHORIZE"].includes(mdfe.status) && <Button asChild variant="outline"><Link href={`/mdfe/${mdfe.id}/editar`}><Pencil className="h-4 w-4" /> Editar</Link></Button>}
        {hasPermission("fiscal.mdfe.authorize") && mdfe.status === "ERROR" && <Button onClick={() => void run("Reconciliação executada", () => mdfeService.reconcile(mdfe.id))}><RefreshCw className="h-4 w-4" /> Reconciliar</Button>}
        {hasPermission("fiscal.mdfe.authorize") && mdfe.status === "READY_TO_AUTHORIZE" && <Button variant="lime" onClick={() => void run("Autorização executada", async () => { await mdfeService.generateXml(mdfe.id); await mdfeService.sign(mdfe.id); return mdfeService.authorize(mdfe.id); })}><Send className="h-4 w-4" /> Autorizar</Button>}
        {hasPermission("fiscal.mdfe.cancel") && ["AUTHORIZED", "IN_TRANSIT"].includes(mdfe.status) && <Button variant="outline" onClick={() => {
          const reason = window.prompt("Justificativa do cancelamento (15 a 255 caracteres):");
          if (reason) void run("Cancelamento enviado", () => mdfeService.cancel(mdfe.id, reason));
        }}><XCircle className="h-4 w-4" /> Cancelar</Button>}
        {hasPermission("fiscal.mdfe.close") && ["AUTHORIZED", "IN_TRANSIT"].includes(mdfe.status) && <Button variant="outline" onClick={() => {
          const input = window.prompt("Encerramento: UF,código IBGE,município");
          const [stateCode, cityCode, cityName] = (input ?? "").split(",").map((part) => part.trim());
          if (stateCode && cityCode && cityName) void run("Encerramento enviado", () => mdfeService.close(mdfe.id, { stateCode, cityCode, cityName }));
        }}><FileDown className="h-4 w-4" /> Encerrar</Button>}
        {hasPermission("fiscal.mdfe.events") && ["AUTHORIZED", "IN_TRANSIT"].includes(mdfe.status) && <Button variant="outline" onClick={() => {
          const input = window.prompt("Novo condutor: CPF,nome");
          const [cpf, name] = (input ?? "").split(",").map((part) => part.trim());
          if (cpf && name) void run("Inclusão de condutor enviada", () => mdfeService.includeDriver(mdfe.id, { cpf, name }));
        }}><UserPlus className="h-4 w-4" /> Incluir condutor</Button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Percurso" value={`${mdfe.loadingState || "—"} → ${mdfe.unloadingState || "—"}`} />
        <Info label="Veículo" value={mdfe.vehicle?.plate || "—"} />
        <Info label="Documentos" value={String(mdfe.fiscalDocuments?.length ?? 0)} />
        <Info label="Protocolo" value={mdfe.protocol || "—"} />
      </div>
      {validationIssues.length > 0 && <MdfeValidationPanel issues={validationIssues} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <MdfeDamdfeViewer id={mdfe.id} enabled={artifactEnabled && hasPermission("fiscal.mdfe.download_damdfe")} />
        <MdfeXmlPanel id={mdfe.id} enabled={artifactEnabled && hasPermission("fiscal.mdfe.download_xml")} />
        <MdfeEventsPanel events={events} />
        <MdfeAuditPanel entries={audit} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-xs font-extrabold uppercase tracking-wider text-subtle">{label}</p><p className="mt-2 break-all text-sm font-bold">{value}</p></Card>;
}
