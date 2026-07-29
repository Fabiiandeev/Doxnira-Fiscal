"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "./service";
import type { SettingsKind } from "./types";
const paths:Record<SettingsKind,string>={overview:"",company:"/company",fiscal:"/fiscal",certificate:"/certificate",integrations:"/integrations",users:"/users",security:"/audit"};
export function useSettings(kind:SettingsKind){return useQuery({queryKey:["settings",kind],queryFn:()=>settingsApi.get<Record<string,unknown>>(paths[kind])});}
export function useSettingsMutation(){const qc=useQueryClient();return useMutation({mutationFn:(input:{type:"company"|"integration"|"revoke";body?:Record<string,unknown>;provider?:string;action?:string})=>input.type==="company"?settingsApi.updateCompany(input.body||{}):input.type==="revoke"?settingsApi.revokeCertificate():settingsApi.integrationAction(input.provider||"",input.action||"test"),onSuccess:()=>qc.invalidateQueries({queryKey:["settings"]})});}
