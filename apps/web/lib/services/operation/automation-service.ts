import { apiFetch, getCompanyId } from "@/lib/api";
import type { Automation, AutomationPage, AutomationRun, AutomationRunPage } from "./automation-types";
const base = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return `/companies/${id}/operation`; };
const mutation = <T>(path: string, body: unknown = {}, method: "POST" | "PATCH" = "POST") => apiFetch<T>(`${base()}${path}`, { method, body: JSON.stringify(body) });
export const automationService = {
  list: (query: string) => apiFetch<AutomationPage>(`${base()}/automations?${query}`),
  get: (id: string) => apiFetch<Automation>(`${base()}/automations/${id}`),
  create: (body: unknown) => mutation<Automation>("/automations", body),
  update: (id: string, body: unknown) => mutation<Automation>(`/automations/${id}`, body, "PATCH"),
  action: (id: string, action: string, body?: unknown) => mutation<Automation | AutomationRun | { evaluation: unknown }>(`/automations/${id}/${action}`, body),
  runs: (query: string) => apiFetch<AutomationRunPage>(`${base()}/automation-runs?${query}`),
  run: (id: string) => apiFetch<AutomationRun>(`${base()}/automation-runs/${id}`),
  runAction: (id: string, action: string) => mutation<AutomationRun>(`/automation-runs/${id}/${action}`),
};
