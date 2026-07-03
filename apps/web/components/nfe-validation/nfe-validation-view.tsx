"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { notify } from "@/components/toast-viewport";
import {
  listNfeValidationRuns,
  getNfeValidationRun,
  autoCorrectNfeValidation,
} from "@/lib/services/nfe-validation-service";
import type { NfeValidationRun } from "@/lib/nfe-validation-types";

export function NfeValidationView() {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ["nfe-validation-runs"],
    queryFn: () => listNfeValidationRuns(),
  });

  const selectedRunQuery = useQuery({
    queryKey: ["nfe-validation-run", selectedRunId],
    queryFn: () => (selectedRunId ? getNfeValidationRun(selectedRunId) : Promise.resolve(null)),
    enabled: !!selectedRunId,
  });

  const autoCorrectMutation = useMutation({
    mutationFn: (runId: string) => autoCorrectNfeValidation(runId),
    onSuccess: () => {
      notify({ title: "Correções aplicadas", description: "Auto‑correções concluídas.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["nfe-validation-runs"] });
      if (selectedRunId) queryClient.invalidateQueries({ queryKey: ["nfe-validation-run", selectedRunId] });
    },
onError: (err: unknown) => {
  let msg = "";
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message?: string };
    msg = e.message ?? "";
  }
  notify({ title: "Erro ao aplicar correções", description: msg, tone: "error" });
},
  });

  if (runsLoading) {
    return <div className="p-4">Carregando validações...</div>;
  }

  const runs = runsData?.data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Validações NFe</h2>
      <Card className="p-4">
        <div className="grid gap-4">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted"
              onClick={() => setSelectedRunId(run.id)}
            >
              <div className="flex items-center gap-2">
                <Badge variant={run.canTransmit ? "lime" : "danger"}>
                  {run.canTransmit ? "Pronta" : "Bloqueada"}
                </Badge>
                <span className="font-medium">Score: {run.score}</span>
                <span className="text-sm text-subtle">{run.situation}</span>
              </div>
              <span className="text-xs text-subtle">{new Date(run.validatedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>

      {selectedRunId && selectedRunQuery.data && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Detalhes da validação</h3>
            <Button
              variant="lime"
              disabled={autoCorrectMutation.isPending}
              onClick={() => autoCorrectMutation.mutate(selectedRunId)}
            >
              Aplicar auto‑correções
            </Button>
          </div>
          <div className="space-y-2">
            {(selectedRunQuery.data as NfeValidationRun).issues.map((issue, idx) => (
              <div key={idx} className="border-b pb-2">
                <div className="flex items-center gap-2">
                  <Badge>{issue.severity}</Badge>
                  <span className="font-medium">{issue.field}</span>
                  {issue.autoCorrectAvailable && <Badge variant="lime">Auto</Badge>}
                </div>
                <p className="text-sm text-subtle">{issue.description}</p>
                <p className="text-xs text-subtle">Impacto: {issue.impact}</p>
                {issue.autoCorrectAvailable && (
                  <p className="text-xs text-subtle">
                    Valor sugerido: {String(issue.autoCorrectValue)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
