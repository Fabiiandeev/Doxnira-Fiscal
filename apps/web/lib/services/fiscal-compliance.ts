import { apiFetch, getCompanyId } from "@/lib/api";
const base=()=>{const id=getCompanyId();if(!id)throw new Error("Selecione uma empresa.");return `/companies/${id}/fiscal-compliance`;};
export type Preparation={id:string;monthlyTaxClosingId:string;periodYear:number;periodMonth:number;status:string;documentsCount:number;itemsCount:number;issuesCount:number;blockingIssuesCount:number;issues?:Array<{id:string;code:string;title:string;severity:string;status:string;message:string}>};
export type FiscalExport={id:string;preparationId:string;type:"SPED_FISCAL"|"SINTEGRA";fileName:string;contentHash:string;generatedAt:string};
export type Forecast={kind:"ESTIMATE";disclaimer:string;period:{year:number;month:number};regime:string|null;components:Record<string,number>;total:number;previousTotal:number|null;variation:number|null;evidence:{closingId:string;status:string;inbound:number;outbound:number;freight:number;documents:number}};
export type TaxGuide={id:string;taxType:string;reference:string;dueDate:string;amount:number;status:"PENDING"|"ISSUED"|"PAID"|"OVERDUE"|"CANCELED";digitLine?:string|null;barcode?:string|null;attachmentUrl?:string|null;notes?:string|null;paymentDate?:string|null};
export const fiscalCompliance={
 preparations:()=>apiFetch<{data:Preparation[]}>(`${base()}/preparations`),
 prepare:(closingId:string)=>apiFetch<Preparation>(`${base()}/preparations`,{method:"POST",body:JSON.stringify({closingId})}),
 detail:(id:string)=>apiFetch<Preparation>(`${base()}/preparations/${id}`),
 rebuild:(id:string)=>apiFetch<Preparation>(`${base()}/preparations/${id}/rebuild`,{method:"POST"}),
 issue:(p:string,id:string,action:"resolve"|"ignore",reason?:string)=>apiFetch(`${base()}/preparations/${p}/issues/${id}/${action}`,{method:"POST",body:JSON.stringify({reason})}),
 exports:(type:string)=>apiFetch<{data:FiscalExport[]}>(`${base()}/exports?type=${type}`),
 generate:(preparationId:string,type:string)=>apiFetch<FiscalExport>(`${base()}/exports`,{method:"POST",body:JSON.stringify({preparationId,type})}),
 download:async(id:string,fileName:string)=>{const response=await fetch(`${process.env.NEXT_PUBLIC_API_URL??"http://localhost:3333/api"}${base()}/exports/${id}/download`,{credentials:"include"});if(!response.ok)throw new Error("Não foi possível baixar o arquivo.");const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=fileName;link.click();URL.revokeObjectURL(url);},
 forecast:(year:number,month:number)=>apiFetch<Forecast>(`${base()}/forecast?year=${year}&month=${month}`),
 guides:(status="",page=1)=>apiFetch<{data:TaxGuide[];pagination:{page:number;total:number;totalPages:number}}>(`${base()}/guides?status=${status}&page=${page}`),
 createGuide:(body:Record<string,unknown>)=>apiFetch<TaxGuide>(`${base()}/guides`,{method:"POST",body:JSON.stringify(body)}),
 updateGuide:(id:string,body:Record<string,unknown>)=>apiFetch<TaxGuide>(`${base()}/guides/${id}`,{method:"PATCH",body:JSON.stringify(body)}),
};
