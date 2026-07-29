"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useSubmitContact, useSubmitLead } from "@/lib/services/marketing-hooks";

type Intent = "lead" | "contact" | "enterprise";
type DialogState = { openContact: (input: { planCode?: string; intent: Intent }) => void };
const ContactContext = createContext<DialogState | null>(null);

export function ContactDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ intent: Intent; planCode?: string } | null>(null);
  const lead = useSubmitLead(); const contact = useSubmitContact();
  const pending = lead.isPending || contact.isPending;
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form); const email = String(data.get("email") || "").trim();
    if (String(data.get("website") || "")) return;
    if (state?.intent === "contact") await contact.mutateAsync({ subject: String(data.get("subject")), message: String(data.get("message")), companyName: String(data.get("companyName")), contact: email, consent: true, source: window.location.pathname });
    else await lead.mutateAsync({ name: String(data.get("name")), email, phone: String(data.get("phone")), companyName: String(data.get("companyName")), interest: state?.intent === "enterprise" ? "PLAN_INFO" : "DEMO", planCode: state?.planCode, message: String(data.get("message") || ""), consent: true, source: window.location.pathname });
    setState(null);
  }
  return <ContactContext.Provider value={{ openContact: (input) => setState(input) }}>{children}{state && <div role="dialog" aria-modal="true" aria-label="Contato" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-xl" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><div className="flex justify-between"><h2 className="text-xl font-bold">{state.intent === "enterprise" ? "Plano personalizado" : "Fale conosco"}</h2><button type="button" onClick={() => setState(null)} aria-label="Fechar">×</button></div><input name="website" tabIndex={-1} className="hidden" autoComplete="off" />{state.intent !== "contact" && <><input required name="name" placeholder="Nome completo" className="w-full rounded border p-2" /><input required name="phone" placeholder="Telefone" className="w-full rounded border p-2" /></>}<input required name="email" type="email" placeholder="E-mail corporativo" className="w-full rounded border p-2" /><input required name="companyName" placeholder="Empresa" className="w-full rounded border p-2" />{state.intent === "contact" && <input required name="subject" placeholder="Assunto" className="w-full rounded border p-2" />}<textarea required name="message" minLength={10} placeholder="Como podemos ajudar?" className="w-full rounded border p-2" /><label className="flex gap-2 text-sm"><input required type="checkbox" /> Autorizo o contato da Doxnira.</label>{(lead.error || contact.error) && <p role="alert" className="text-sm text-red-700">Não foi possível enviar. Tente novamente.</p>}<button disabled={pending} className="w-full rounded bg-lime-400 p-2 font-bold">{pending ? "Enviando…" : "Enviar solicitação"}</button></form></div>}</ContactContext.Provider>;
}
export function useContactDialog() { const value = useContext(ContactContext); if (!value) throw new Error("ContactDialogProvider ausente"); return value; }
