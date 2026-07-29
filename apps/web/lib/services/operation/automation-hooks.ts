"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { automationService } from "./automation-service";
export const useAutomations = (query: string) => useQuery({ queryKey: ["operation", "automations", query], queryFn: () => automationService.list(query) });
export const useAutomation = (id?: string) => useQuery({ queryKey: ["operation", "automation", id], queryFn: () => automationService.get(id!), enabled: Boolean(id) });
export const useAutomationRuns = (query: string) => useQuery({ queryKey: ["operation", "automation-runs", query], queryFn: () => automationService.runs(query) });
export const useAutomationRun = (id?: string) => useQuery({ queryKey: ["operation", "automation-run", id], queryFn: () => automationService.run(id!), enabled: Boolean(id) });
export const useAutomationMutation = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, action, body }: { id?: string; action: string; body?: unknown }) => action === "create" ? automationService.create(body) : action === "update" ? automationService.update(id!, body) : action.startsWith("run.") ? automationService.runAction(id!, action.slice(4)) : automationService.action(id!, action, body), onSuccess: () => client.invalidateQueries({ queryKey: ["operation"] }) }); };
