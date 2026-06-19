"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileCheck2, Loader2 } from "lucide-react";
import { useState } from "react";

import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { manifestDocument } from "@/lib/services/fiscal-service";

const eventMap = {
  AWARE: "Ciência da operação",
  CONFIRMED: "Confirmação da operação",
  UNKNOWN: "Desconhecimento da operação",
  NOT_PERFORMED: "Operação não realizada",
} as const;

export function ManifestationModal({
  documentIds,
  trigger,
}: {
  documentIds: string[];
  trigger?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [eventType, setEventType] = useState<keyof typeof eventMap>("AWARE");
  const [justification, setJustification] = useState("");
  const [mode, setMode] = useState<"mock" | "real">("mock");
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      if (eventType === "NOT_PERFORMED" && justification.trim().length < 15) {
        throw new Error("Informe uma justificativa com pelo menos 15 caracteres.");
      }
      if (mode === "real" && !confirmed) {
        throw new Error("Confirme explicitamente o envio real.");
      }
      return Promise.all(
        documentIds.map((id) =>
          manifestDocument(id, eventType, justification, mode, confirmed),
        ),
      );
    },
    onSuccess: () => {
      notify({
        title: "Manifestação registrada",
        description: `${documentIds.length} documento(s) atualizado(s) no ambiente mock.`,
      });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document"] });
    },
    onError: (error) => {
      notify({ title: "Manifestação não registrada", description: error.message, tone: "error" });
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="lime">
            <FileCheck2 className="h-4 w-4" />
            Manifestar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Manifestação do destinatário</DialogTitle>
        <DialogDescription>
          O evento será persistido no backend e na auditoria, sem envio real à SEFAZ.
        </DialogDescription>
        <div className="mt-6 space-y-4">
          <label>
            <span className="mb-2 block text-[11px] font-extrabold">Tipo de evento</span>
            <select
              className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none"
              value={eventType}
              onChange={(event) => setEventType(event.target.value as keyof typeof eventMap)}
            >
              {Object.entries(eventMap).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[11px] font-extrabold">Modo</span>
            <select
              className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as "mock" | "real");
                setConfirmed(false);
              }}
            >
              <option value="mock">Simulado</option>
              <option value="real">Real controlado</option>
            </select>
          </label>
          {mode === "real" && (
            <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              <span className="text-[10px] font-bold leading-5 text-red-800">
                Confirmo o envio deste evento à SEFAZ no ambiente configurado.
              </span>
            </label>
          )}
          {eventType === "NOT_PERFORMED" && (
            <label>
              <span className="mb-2 block text-[11px] font-extrabold">
                Justificativa obrigatória
              </span>
              <textarea
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                className="min-h-28 w-full resize-none rounded-xl border border-line bg-white p-3.5 text-sm outline-none"
                placeholder="Descreva o motivo com pelo menos 15 caracteres..."
              />
            </label>
          )}
          <div className="flex items-start gap-3 rounded-2xl bg-pastel-yellow p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-[10px] leading-4 text-amber-900">
              Confirma o registro de {eventMap[eventType].toLowerCase()} para {documentIds.length} documento(s)?
            </p>
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-2">
          <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
          <Button variant="lime" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar evento mockado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
