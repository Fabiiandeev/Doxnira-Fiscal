"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Send, Wrench } from "lucide-react";
import Link from "next/link";

import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  validateCompany,
  type CompanyValidationIssue,
  type CompanyValidationResult,
} from "@/lib/services/company-validation-service";
import { cn } from "@/lib/utils";

function severityLabel(severity: CompanyValidationIssue["severity"]) {
  if (severity === "error") return "Erro";
  if (severity === "warning") return "Alerta";
  return "Info";
}

function severityVariant(severity: CompanyValidationIssue["severity"]) {
  if (severity === "error") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function getFixHref(companyId: string, issue: CompanyValidationIssue) {
  if (issue.field === "certificate") return `/companies/${companyId}/settings`;
  if (
    [
      "crt",
      "mainCnae",
      "municipalRegistration",
      "simplesNominalRate",
      "stateRegistration",
    ].includes(issue.field)
  ) {
    return `/companies/${companyId}/fiscal`;
  }
  return `/companies/${companyId}/edit`;
}

export function CompanyValidationPanel({
  companyId,
  initialValidation,
  compact = false,
}: {
  companyId: string;
  initialValidation?: CompanyValidationResult;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["company-validation", companyId],
    queryFn: () => validateCompany(companyId),
    initialData: initialValidation,
    enabled: Boolean(companyId),
  });
  const validate = useMutation({
    mutationFn: () => validateCompany(companyId),
    onSuccess: (result) => {
      notify({
        title: result.issues.length ? "Validação concluída com pendências" : "Cadastro validado",
        description: result.issues.length
          ? `${result.issues.length} pendência(s) encontrada(s).`
          : "Nenhuma pendência fiscal encontrada.",
      });
      queryClient.setQueryData(["company-validation", companyId], result);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (error) =>
      notify({
        title: "Validação não concluída",
        description: error.message,
        tone: "error",
      }),
  });

  const validation = query.data;
  const issues = validation?.issues ?? [];
  const status = validation?.status ?? "attention";

  return (
    <Card className={cn("p-5", compact && "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold text-ink">Pendências fiscais da empresa</h2>
            <Badge
              variant={
                status === "ready" ? "success" : status === "blocked" ? "danger" : "warning"
              }
            >
              Score {validation?.score ?? 0}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-subtle">
            Validação cadastral básica para emissão, sincronização e fechamento fiscal.
          </p>
        </div>
        <Button variant="lime" onClick={() => validate.mutate()} disabled={validate.isPending}>
          <Wrench className="h-4 w-4" />
          {validate.isPending ? "Validando..." : "Validar cadastro"}
        </Button>
      </div>

      {issues.length === 0 ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-extrabold">Nenhuma pendência encontrada.</p>
            <p className="mt-1 text-xs">A empresa está pronta para avançar no fluxo fiscal.</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {issues.map((issue) => (
            <div key={issue.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4",
                        issue.severity === "error" ? "text-red-600" : "text-amber-600",
                      )}
                    />
                    <h3 className="text-sm font-extrabold text-ink">{issue.title}</h3>
                    <Badge variant={severityVariant(issue.severity)}>
                      {severityLabel(issue.severity)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-subtle">{issue.explanation}</p>
                  <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-3">
                    <p><span className="font-extrabold text-ink">Impacto:</span> {issue.impact}</p>
                    <p><span className="font-extrabold text-ink">Campo:</span> {issue.field}</p>
                    <p><span className="font-extrabold text-ink">Ação:</span> {issue.action}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={getFixHref(companyId, issue)}>Corrigir</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      notify({
                        title: "Pendência enviada ao contador",
                        description: `${issue.title} foi adicionada à fila de revisão.`,
                      })
                    }
                  >
                    <Send className="h-4 w-4" />
                    Enviar para contador
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
