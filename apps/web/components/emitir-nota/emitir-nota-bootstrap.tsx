"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { notify } from "@/components/toast-viewport";
import { createNfeDraft } from "@/lib/services/nfe-service";

export function EmitirNotaBootstrap({ initialProductId }: { initialProductId?: string }) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function startDraft() {
      try {
        const result = await createNfeDraft();
        if (!result.id) throw new Error("A API nao retornou o identificador da NF-e.");
        notify({ title: "Rascunho criado", description: "Abrindo o wizard de emissao NF-e.", tone: "success" });
        const productQuery = initialProductId ? `&productId=${encodeURIComponent(initialProductId)}` : "";
        router.replace(`/emitir-nota?id=${result.id}${productQuery}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Nao foi possivel criar o rascunho.";
        setError(message);
        notify({ title: "NF-e nao criada", description: message, tone: "error" });
      }
    }

    startDraft();
  }, [initialProductId, router]);

  return (
    <div className="rounded-lg border border-line bg-white p-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-muted">
        <Loader2 className="h-5 w-5 animate-spin text-ink" />
      </div>
      <h1 className="mt-4 text-base font-extrabold text-ink">Preparando emissao de NF-e</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-subtle">
        {error || "Criando rascunho numerado e abrindo o fluxo inteligente."}
      </p>
    </div>
  );
}
