import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import * as repo from "./fiscal-emission.repository.js";
const typeName = (kind) => kind === "nfce" ? "NFCE_DRAFT" : "NFSE_DRAFT";
const configured = (kind) => kind === "nfce" ? Boolean(process.env.NFCE_PROVIDER_URL && process.env.NFCE_PROVIDER_TOKEN) : Boolean(process.env.NFSE_PROVIDER_URL && process.env.NFSE_PROVIDER_TOKEN);
function serialize(log){return {id:log.metadata.documentId,status:log.metadata.status,payload:log.metadata.payload,validation:log.metadata.validation||null,createdAt:log.createdAt,updatedAt:log.createdAt};}
export async function list(companyId,kind){const rows=await repo.logs(companyId,typeName(kind));const latest=new Map();for(const row of rows)if(!latest.has(row.metadata?.documentId))latest.set(row.metadata.documentId,row);return {data:[...latest.values()].map(serialize)};}
export async function get(companyId,kind,id){const rows=await repo.logs(companyId,typeName(kind));const row=rows.find(r=>r.metadata?.documentId===id);if(!row)throw new AppError("Documento não encontrado.","DOCUMENT_NOT_FOUND",404);return serialize(row);}
export async function save({companyId,userId,kind,id,payload,request}){
  if(id)await get(companyId,kind,id); const documentId=id||crypto.randomUUID();
  const validation=kind==="nfse"?await validateNfse(companyId,payload):validateNfce(payload);
  const row=await repo.log({companyId,userId,action:id?`${kind.toUpperCase()}_UPDATED`:`${kind.toUpperCase()}_CREATED`,entityType:typeName(kind),entityId:documentId,ipAddress:request.ip,userAgent:request.get("user-agent"),metadata:{documentId,status:validation.valid?"VALIDATED":"DRAFT",payload,validation}});
  return serialize(row);
}
export function validateNfce(payload){const total=payload.items.reduce((s,i)=>s+i.quantity*i.unitPrice,0);const paid=payload.payments.reduce((s,p)=>s+p.amount,0);const issues=[];if(Math.abs(paid-payload.change-total)>0.01)issues.push("Pagamentos e total divergentes.");return{valid:issues.length===0,issues,total,paid,change:payload.change};}
export async function validateNfse(companyId,payload){const [company,customer,service]=await Promise.all([repo.company(companyId),repo.customer(companyId,payload.customerId),repo.service(companyId,payload.serviceId)]);if(!customer)throw new AppError("Tomador não encontrado.","CUSTOMER_NOT_FOUND",404);if(!service)throw new AppError("Serviço não encontrado.","SERVICE_NOT_FOUND",404);const issues=[];if(!company?.stateRegistration&&!company?.taxSettings)issues.push("Configuração fiscal do prestador incompleta.");if(!service.municipalityIbgeCode)issues.push("Município de incidência não configurado.");const taxable=Math.max(0,payload.value-payload.deductions);const iss=taxable*Number(service.issRate)/100;return{valid:issues.length===0,issues,taxable,iss,withholdings:{inss:taxable*Number(service.inssRate)/100,ir:taxable*Number(service.irRate)/100,csll:taxable*Number(service.csllRate)/100,pis:taxable*Number(service.pisRate)/100,cofins:taxable*Number(service.cofinsRate)/100},service:{code:service.code,municipalCode:service.municipalCode,nationalCode:service.nationalCode,municipality:service.municipality}};}
export async function transmit({companyId,userId,kind,id,idempotencyKey,request}){
 const doc=await get(companyId,kind,id);if(doc.status==="TRANSMITTED")return doc;
 const prior=(await repo.logs(companyId,typeName(kind))).find(r=>r.metadata?.idempotencyKey===idempotencyKey);if(prior)return serialize(prior);
 if(!doc.validation?.valid)throw new AppError("Corrija as pendências antes de transmitir.","DOCUMENT_INVALID",409);
 if(!configured(kind))throw new AppError(kind==="nfce"?"Configuração NFC-e necessária":"Integração municipal necessária","PROVIDER_CONFIGURATION_REQUIRED",409);
 throw new AppError("Envio externo não habilitado neste ambiente.","EXTERNAL_TRANSMISSION_DISABLED",409);
}
export async function cancel({companyId,userId,kind,id,justification,request}){const doc=await get(companyId,kind,id);if(doc.status!=="TRANSMITTED")throw new AppError("Somente documento transmitido pode ser cancelado.","INVALID_STATUS",409);const row=await repo.log({companyId,userId,action:`${kind.toUpperCase()}_CANCELLED`,entityType:typeName(kind),entityId:id,ipAddress:request.ip,metadata:{documentId:id,status:"CANCELLED",payload:doc.payload,validation:doc.validation,justification}});return serialize(row);}
