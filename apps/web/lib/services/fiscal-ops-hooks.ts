"use client";import{useMutation,useQuery,useQueryClient}from"@tanstack/react-query";import{fiscalOps}from"./fiscal-ops";
export const useFiscalXml=(q:string,p:number,t:string)=>useQuery({queryKey:["fiscal-xml",q,p,t],queryFn:()=>fiscalOps.xml(q,p,t)});
export const useRejections=(q:string,p:number,s:string,st:string)=>useQuery({queryKey:["rejections",q,p,s,st],queryFn:()=>fiscalOps.rejections(q,p,s,st)});
export const useRejectionAction=()=>{const c=useQueryClient();return useMutation({mutationFn:({id,...body}:{id:string;action:string;justification?:string;assignee?:string})=>fiscalOps.rejectionAction(id,body),onSuccess:()=>c.invalidateQueries({queryKey:["rejections"]})})};
