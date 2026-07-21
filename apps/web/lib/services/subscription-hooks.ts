"use client";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {subscriptionService,type BillingCycle} from "./subscription-service";
const key=["subscription"];
const operationKey=()=>crypto.randomUUID();
export function useSubscription(){return useQuery({queryKey:[...key,"current"],queryFn:subscriptionService.current});}
export function useSubscriptionCatalog(){return useQuery({queryKey:[...key,"catalog"],queryFn:subscriptionService.catalog});}
export function useSubscriptionUsage(){return useQuery({queryKey:[...key,"usage"],queryFn:subscriptionService.usage});}
export function useSubscriptionActions(){const client=useQueryClient();const refresh=()=>client.invalidateQueries({queryKey:key});return {change:useMutation({mutationFn:(input:{targetPlanCode:string;targetBillingCycle:BillingCycle;reason?:string})=>subscriptionService.change(input,operationKey()),onSuccess:refresh}),cancel:useMutation({mutationFn:(input:{mode:"IMMEDIATE"|"PERIOD_END";reason?:string})=>subscriptionService.cancel(input.mode,input.reason,operationKey()),onSuccess:refresh}),reactivate:useMutation({mutationFn:()=>subscriptionService.reactivate(operationKey()),onSuccess:refresh})};}
