import { prisma } from "../../config/prisma.js";
import { SubscriptionConfigurationError, SubscriptionUsageConflictError } from "./subscription.errors.js";
export function buildUsageIdempotencyKey({companyId,usageCode,sourceType,sourceId,periodStart}) { if(!companyId||!usageCode||!sourceType||!sourceId) throw new SubscriptionConfigurationError({reason:"usage_idempotency_source_required"}); return `${companyId}:${usageCode}:${sourceType}:${sourceId}:${new Date(periodStart).toISOString().slice(0,7)}`; }
export async function recordUsage(input) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new SubscriptionConfigurationError({ reason: "usage_quantity_invalid" });
  }
  return runUsage({ ...input, quantity: input.quantity, direction: 1 });
}
export async function releaseUsage(input) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new SubscriptionConfigurationError({ reason: "usage_quantity_invalid" });
  }
  return runUsage({ ...input, quantity: -input.quantity, direction: -1 });
}
async function runUsage(input) { try{return await changeUsage(input);}catch(error){if(error?.code!=="P2002")throw error;const replay=await (input.db??prisma).subscriptionUsage.findUnique({where:{idempotencyKey:input.idempotencyKey}});if(!replay)throw error;return {...replay,idempotentReplay:true};} }
async function changeUsage({subscriptionId,companyId,usageCode,quantity,idempotencyKey,sourceType=null,sourceId=null,occurredAt=new Date(),metadata=null,direction,db=prisma}) { if(!Number.isInteger(quantity)||quantity===0) throw new SubscriptionConfigurationError({reason:"usage_quantity_invalid"}); return db.$transaction(async tx=>{const subscription=await tx.subscription.findFirst({where:{id:subscriptionId,companyId}});if(!subscription)throw new SubscriptionUsageConflictError({subscriptionId,companyId});const replay=await tx.subscriptionUsage.findUnique({where:{idempotencyKey}});if(replay)return {...replay,idempotentReplay:true};const where={subscriptionId_usageCode_periodStart_periodEnd:{subscriptionId,usageCode,periodStart:subscription.currentPeriodStart,periodEnd:subscription.currentPeriodEnd}};const counter=await tx.subscriptionUsageCounter.upsert({where,create:{subscriptionId,companyId,usageCode,periodStart:subscription.currentPeriodStart,periodEnd:subscription.currentPeriodEnd,quantity:0},update:{}});const event=await tx.subscriptionUsage.create({data:{subscriptionId,companyId,usageCode,quantity,idempotencyKey,sourceType,sourceId,periodStart:subscription.currentPeriodStart,periodEnd:subscription.currentPeriodEnd,occurredAt,metadata}});const updated=quantity<0?await tx.subscriptionUsageCounter.updateMany({where:{id:counter.id,quantity:{gte:-quantity}},data:{quantity:{increment:quantity}}}):await tx.subscriptionUsageCounter.updateMany({where:{id:counter.id},data:{quantity:{increment:quantity}}});if(updated.count!==1)throw new SubscriptionUsageConflictError({reason:"usage_counter_negative"});return {...event,idempotentReplay:false};}); }
