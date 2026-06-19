"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastDetail = {
  title: string;
  description?: string;
  tone?: "success" | "error" | "info";
};

export function notify(detail: ToastDetail) {
  window.dispatchEvent(new CustomEvent<ToastDetail>("ns-fiscal-toast", { detail }));
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<Array<ToastDetail & { id: number }>>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      const id = Date.now();
      setToasts((items) => [...items.slice(-2), { ...detail, id }]);
      window.setTimeout(
        () => setToasts((items) => items.filter((item) => item.id !== id)),
        4200,
      );
    }
    window.addEventListener("ns-fiscal-toast", onToast);
    return () => window.removeEventListener("ns-fiscal-toast", onToast);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-[min(390px,calc(100vw-2rem))] space-y-2">
      {toasts.map((toast) => {
        const Icon = toast.tone === "error" ? CircleAlert : CheckCircle2;
        return (
          <div key={toast.id} className="flex gap-3 rounded-2xl border border-white/50 bg-ink p-4 text-white shadow-card">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toast.tone === "error" ? "text-red-300" : "text-lime"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold">{toast.title}</p>
              {toast.description && <p className="mt-1 text-[10px] leading-4 text-white/55">{toast.description}</p>}
            </div>
            <button onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} aria-label="Fechar aviso">
              <X className="h-4 w-4 text-white/45" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
