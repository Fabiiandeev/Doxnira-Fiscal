"use client";

import { Clock3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAuditLogs } from "@/lib/services/fiscal/audit-log-service";
import type { AuditLogEntry } from "@/lib/fiscal-types";
import { formatDate } from "@/lib/utils";

export function FiscalAuditTrail() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    setLoading(true);
    const next = await getAuditLogs();
    setLogs(next);
    setLoading(false);
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle">
            Auditoria fiscal
          </p>
          <h2 className="mt-1 text-base font-extrabold text-ink">Trilha de eventos</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {loading && (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-5 text-sm text-subtle">
            Nenhum evento fiscal registrado ainda. As proximas validacoes, emissoes e correccoes vao aparecer aqui.
          </div>
        )}

        {!loading &&
          logs.slice(0, 6).map((log) => (
            <div key={log.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{log.entityType}</Badge>
                    <p className="text-sm font-extrabold text-ink">{log.action}</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-subtle">
                    {log.userName} · {log.entityId}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-subtle">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDate(log.timestamp, true)}
                </span>
              </div>
              {Object.keys(log.details || {}).length > 0 && (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-ink px-4 py-3 font-mono text-[10px] leading-5 text-emerald-200">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
      </div>
    </Card>
  );
}
