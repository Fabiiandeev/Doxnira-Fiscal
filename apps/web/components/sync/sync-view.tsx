"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileArchive,
  LockKeyhole,
  RefreshCw,
  Server,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompanyId } from "@/lib/api";
import {
  getSyncLogs,
  getSyncReadiness,
  getSyncStatus,
  requestSync,
} from "@/lib/services/sync-service";
import { formatDate } from "@/lib/utils";

export function SyncView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const companyId = getCompanyId();
  const [logsPage, setLogsPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  const readiness = useQuery({
    queryKey: ["sync-readiness", companyId],
    queryFn: () => getSyncReadiness(companyId!),
    enabled: Boolean(companyId),
    refetchInterval: 30_000,
  });
  const status = useQuery({
    queryKey: ["sync-status", companyId],
    queryFn: () => getSyncStatus(companyId!),
    enabled: Boolean(companyId),
    refetchInterval: (query) =>
      ["QUEUED", "RUNNING"].includes(query.state.data?.latest?.status || "")
        ? 2_000
        : 15_000,
  });
  const logs = useQuery({
    queryKey: ["sync-logs", companyId, logsPage],
    queryFn: () => getSyncLogs(companyId!, logsPage),
    enabled: Boolean(companyId),
    refetchInterval: 15_000,
  });
  const sync = useMutation({
    mutationFn: () => requestSync(companyId!),
    onSuccess: (result) => {
      notify({ title: result.message, description: "Job incluído na fila BullMQ." });
      queryClient.invalidateQueries({ queryKey: ["sync"] });
    },
    onError: (error) => {
      notify({ title: "Sincronização não iniciada", description: error.message, tone: "error" });
    },
  });

  const latest = status.data?.latest;
  const isSyncing = sync.isPending || ["QUEUED", "RUNNING"].includes(latest?.status || "");
  const readinessData = readiness.data;
  const nextAllowedAt = status.data?.company.nextAllowedSyncAt;
  const countdown = nextAllowedAt
    ? Math.max(0, Math.ceil((new Date(nextAllowedAt).getTime() - now) / 1_000))
    : 0;

  function startSync() {
    if (!readinessData?.certificate.exists) {
      notify({
        title: "Cadastre um certificado A1",
        description: "A sincronização permanece bloqueada até o upload.",
        tone: "error",
      });
      router.push("/certificate");
      return;
    }
    sync.mutate();
  }

  function refreshAll() {
    readiness.refetch();
    status.refetch();
    logs.refetch();
  }

  function exportLogs() {
    const data = logs.data?.data || [];
    const csv = [
      ["inicio", "status", "cStat", "motivo", "nsu", "documentos"],
      ...data.map((item) => [
        item.startedAt,
        item.status,
        item.cstat || "",
        item.xmotivo || item.errorMessage || "",
        item.requestNsu || "",
        item.documentsCount,
      ]),
    ].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "logs-sincronizacao.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        eyebrow="Motor DF-e"
        title="Sincronização"
        description="Fila mockada com controle de certificado, NSU, concorrência e auditoria."
        icon={RefreshCw}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshAll}>
              Atualizar
            </Button>
            <Button variant="lime" size="lg" onClick={startSync} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1.8fr]">
        <Card className="overflow-hidden bg-ink text-white">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-ink">
                <RefreshCw className="h-5 w-5" />
              </div>
              <Badge className={readinessData?.sync.ready ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}>
                {readinessData?.sync.status || "VERIFICANDO"}
              </Badge>
            </div>
            <p className="mt-8 text-[10px] font-extrabold uppercase tracking-wider text-white/45">
              Modo {readinessData?.sefaz.mode || "mock"} · {readinessData?.sefaz.environment || "homologação"}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold">
              {readinessData?.certificate.exists ? "Motor fiscal preparado" : "Aguardando certificado"}
            </h2>
            <p className="mt-2 text-[11px] leading-5 text-white/55">
              {readinessData?.sync.message || "Validando pré-requisitos..."}
            </p>
            {!readinessData?.certificate.exists && (
              <Button className="mt-6" variant="lime" onClick={() => router.push("/certificate")}>
                Cadastrar certificado
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-subtle">Controle sequencial</p>
              <h2 className="mt-2 text-lg font-extrabold">Posição atual do NSU</h2>
            </div>
            <Badge variant={latest?.cstat === "656" ? "danger" : latest?.cstat === "137" ? "warning" : "success"}>
              cStat {latest?.cstat || "—"}
            </Badge>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            <NsuBox label="Último NSU" value={status.data?.company.nfeLastNsu || "000000000000000"} />
            <NsuBox label="maxNSU conhecido" value={status.data?.company.nfeMaxNsu || "000000000000000"} highlight />
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-pastel-green p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p className="text-[10px] leading-4 text-emerald-900">
              Próxima janela: {countdown > 0
                ? `${Math.floor(countdown / 60)}m ${countdown % 60}s`
                : "disponível agora"}.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
            <Button variant="outline" size="sm" disabled={logsPage <= 1} onClick={() => setLogsPage((page) => page - 1)}>Anterior</Button>
            <span className="text-[10px] font-extrabold">{logsPage} / {logs.data?.pagination.totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={logsPage >= (logs.data?.pagination.totalPages || 1)} onClick={() => setLogsPage((page) => page + 1)}>Próxima</Button>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.9fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-5 md:px-6">
            <div>
              <h2 className="text-[15px] font-extrabold">Logs de sincronização</h2>
              <p className="mt-1 text-[11px] text-subtle">Histórico sem certificado, senha ou XML bruto.</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportLogs}>Exportar logs</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-muted/60 text-[9px] font-extrabold uppercase tracking-wider text-subtle">
                <tr><th className="px-6 py-3">Início</th><th className="px-4 py-3">Resposta</th><th className="px-4 py-3">NSU solicitado</th><th className="px-4 py-3">ultNSU / maxNSU</th><th className="px-4 py-3">Docs.</th><th className="px-4 py-3">Duração</th></tr>
              </thead>
              <tbody>
                {(logs.data?.data || []).map((log) => (
                  <tr key={log.id} className="border-t border-line text-[10px]">
                    <td className="px-6 py-4 font-bold">{formatDate(log.startedAt, true)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === "SUCCESS" ? "success" : log.status === "ERROR" ? "danger" : "warning"}>{log.cstat || log.status}</Badge>
                        <span className="max-w-48 truncate font-bold">{log.xmotivo || log.errorMessage || "Processando"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-subtle">{log.requestNsu || "—"}</td>
                    <td className="px-4 py-4 font-mono">{log.responseUltNsu?.slice(-6) || "—"} / {log.responseMaxNsu?.slice(-6) || "—"}</td>
                    <td className="px-4 py-4 font-extrabold">{log.documentsCount}</td>
                    <td className="px-4 py-4 text-subtle">{duration(log.startedAt, log.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="text-[15px] font-extrabold">Regras de proteção</h2>
          <div className="mt-6 space-y-3">
            <ProtectionItem icon={LockKeyhole} title="Lock por empresa" description="Impede sincronizações simultâneas." />
            <ProtectionItem icon={Clock3} title="Janela cStat 137/656" description="Bloqueio mínimo respeitado." />
            <ProtectionItem icon={Server} title="Redis + BullMQ" description="Processamento fora da requisição." />
            <ProtectionItem icon={FileArchive} title="docZip isolado" description="Gateway preparado sem chamada real." />
          </div>
          {latest?.status === "ERROR" && (
            <Button className="mt-5 w-full" variant="outline" onClick={startSync}>
              Reprocessar último erro
            </Button>
          )}
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-pastel-yellow p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-[10px] leading-4 text-amber-900">Nenhuma chamada real à SEFAZ ocorre com a flag desativada.</p>
          </div>
        </Card>
      </div>
    </>
  );
}

function duration(start: string, end?: string | null) {
  if (!end) return "em andamento";
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return `${seconds}s`;
}

function NsuBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${highlight ? "bg-lime" : "bg-muted"}`}>
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-3 font-mono text-sm font-extrabold">{value}</p>
    </div>
  );
}

function ProtectionItem({ icon: Icon, title, description }: { icon: typeof LockKeyhole; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-muted/70 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white"><Icon className="h-4 w-4" /></div>
      <div><p className="text-[11px] font-extrabold">{title}</p><p className="mt-1 text-[9px] leading-4 text-subtle">{description}</p></div>
    </div>
  );
}
