import { prisma } from "../../config/prisma.js";
import { logger } from "../../config/logger.js";
import { applyScheduledPlanChange, conditionalUpdate } from "./subscription-lifecycle.service.js";
import { calculateNextPeriod } from "./subscription-period.service.js";
import { createSubscriptionHistory, findReplay, snapshot } from "./subscription-history.service.js";

function deterministicKey(prefix, subscription, effectiveAt) {
  return `${prefix}:${subscription.id}:${new Date(effectiveAt).toISOString()}`;
}

async function transition({ db, source, data, changeType, idempotencyKey, actorId, requestId, effectiveAt, intent }) {
  return db.$transaction(async (tx) => {
    const fresh = await tx.subscription.findUnique({ where: { id: source.id } });
    const replay = await findReplay(tx, source.id, idempotencyKey, changeType, intent);
    if (replay) return { subscription: fresh, reconciled: false, replay: true };
    const mutation = await conditionalUpdate(tx, fresh, data, changeType, idempotencyKey, intent);
    if (mutation.idempotentReplay) return { subscription: mutation.subscription, reconciled: false, replay: true };
    await createSubscriptionHistory({ tx, subscription: mutation.subscription, idempotencyKey, actorId, requestId, changeType, previousState: snapshot(fresh), nextState: snapshot(mutation.subscription), intent, effectiveAt });
    return { subscription: mutation.subscription, reconciled: true, replay: false };
  });
}

export async function reconcileSubscription({ companyId, actorId=null, requestId=null, now=new Date(), db=prisma }) {
  let subscription = await db.subscription.findFirst({ where: { companyId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED"] } } });
  if (!subscription) return null;
  const actions=[];

  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd <= now) {
    const idempotencyKey=deterministicKey("period-end-cancel",subscription,subscription.currentPeriodEnd);
    const intent={changeType:"CANCELED",reason:"period_end_reconciliation"};
    const result=await transition({db,source:subscription,data:{status:"CANCELED",cancelAtPeriodEnd:false,endedAt:subscription.currentPeriodEnd,nextPlanId:null,nextPlanPriceId:null,nextPlanEffectiveAt:null},changeType:"CANCELED",idempotencyKey,actorId,requestId,effectiveAt:subscription.currentPeriodEnd,intent});
    subscription=result.subscription;actions.push("PERIOD_END_CANCELED");
  } else if (subscription.status==="TRIALING" && subscription.trialEndsAt && subscription.trialEndsAt <= now) {
    const idempotencyKey=deterministicKey("trial-expired",subscription,subscription.trialEndsAt);
    const intent={changeType:"MANUAL_ADJUSTMENT",reason:"trial_expired_without_activation"};
    const result=await transition({db,source:subscription,data:{status:"EXPIRED",endedAt:subscription.trialEndsAt,cancelAtPeriodEnd:false,nextPlanId:null,nextPlanPriceId:null,nextPlanEffectiveAt:null},changeType:"MANUAL_ADJUSTMENT",idempotencyKey,actorId,requestId,effectiveAt:subscription.trialEndsAt,intent});
    subscription=result.subscription;actions.push("TRIAL_EXPIRED");
  } else {
    if (subscription.nextPlanEffectiveAt && subscription.nextPlanEffectiveAt <= now) {
      const idempotencyKey=deterministicKey("scheduled-plan-change",subscription,subscription.nextPlanEffectiveAt);
      const result=await applyScheduledPlanChange({subscriptionId:subscription.id,actorId,requestId,idempotencyKey,now,db});
      subscription=await db.subscription.findUnique({where:{id:subscription.id}});actions.push(result.operation.idempotentReplay?"SCHEDULED_CHANGE_REPLAY":"SCHEDULED_CHANGE_APPLIED");
    }
    if (subscription.status==="ACTIVE" && subscription.provider==="MANUAL" && !subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd <= now) {
      let start=subscription.currentPeriodStart;let end=subscription.currentPeriodEnd;
      while(end<=now){const period=calculateNextPeriod({periodStart:end,billingCycle:subscription.billingCycle});start=period.currentPeriodStart;end=period.currentPeriodEnd;}
      const idempotencyKey=deterministicKey("period-renewal",subscription,subscription.currentPeriodEnd);
      const intent={changeType:"RENEWED",periodStart:start.toISOString(),periodEnd:end.toISOString()};
      const result=await transition({db,source:subscription,data:{currentPeriodStart:start,currentPeriodEnd:end},changeType:"RENEWED",idempotencyKey,actorId,requestId,effectiveAt:start,intent});subscription=result.subscription;actions.push("PERIOD_RENEWED");
    }
  }
  if(actions.length)logger.info({subscriptionId:subscription.id,companyId,actorId,requestId,operation:"reconcile",result:actions},"subscription.reconciled");
  return {subscription,actions};
}
