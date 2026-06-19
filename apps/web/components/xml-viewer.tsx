"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { getDocumentXml } from "@/lib/services/fiscal-service";

export function XmlViewer({ documentId }: { documentId: string }) {
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ["document-xml", documentId],
    queryFn: () => getDocumentXml(documentId),
    staleTime: 10 * 60_000,
  });

  async function copyXml() {
    if (!query.data) return;
    await navigator.clipboard.writeText(query.data.xml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadXml() {
    if (!query.data) return;
    const url = URL.createObjectURL(
      new Blob([query.data.xml], { type: "application/xml;charset=utf-8" }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${query.data.accessKey}.xml`;
    link.click();
    URL.revokeObjectURL(url);
    notify({ title: "XML baixado", description: "Download auditado pelo backend." });
  }

  if (query.isLoading) {
    return <div className="grid min-h-64 place-items-center rounded-2xl bg-ink text-white"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (query.isError || !query.data) {
    return <div className="rounded-2xl bg-red-50 p-5 text-xs font-bold text-red-700">{query.error?.message || "XML indisponível."}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#1F211D]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
            XML fiscal sanitizado
          </p>
          <p className="mt-1 text-[9px] text-white/35">Carregado sob demanda · SHA-256 {query.data.hash.slice(0, 12)}…</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={copyXml}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={downloadXml}>
            <Download className="h-3.5 w-3.5" />
            Baixar
          </Button>
        </div>
      </div>
      <pre className="max-h-[460px] overflow-auto p-5 font-mono text-[11px] leading-6 text-emerald-200/85">
        {query.data.xml}
      </pre>
    </div>
  );
}
