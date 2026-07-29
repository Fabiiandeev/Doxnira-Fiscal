import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { dispatchOperationEvent } from "../../src/modules/operation/automation-event-dispatcher.js";
import { runAutomation } from "../../src/modules/operation/automation-runner.js";
import { getOperationDashboard } from "../../src/modules/operation/operation.service.js";

after(disconnectDatabase);
test("evento real percorre dispatcher, condição, ação segura, execução e auditoria", async () => {
  const fixture=randomUUID().replaceAll("-",""),user=await prisma.user.create({data:{name:"Automation Integration",email:`automation-${fixture}@test.invalid`,passwordHash:"test"}}),company=await prisma.company.create({data:{ownerId:user.id,legalName:"Automation Integration",cnpj:fixture.slice(0,14)}});
  try {
    const empty=await getOperationDashboard(company.id,{}); assert.equal(empty.indicators.inventoryValue,0);
    const rule=await prisma.operationAutomation.create({data:{companyId:company.id,name:"Compra aprovada",module:"PURCHASE",event:"PURCHASE_APPROVED",conditions:[{field:"total",operator:"GREATER_OR_EQUAL",value:100,valueType:"NUMBER",group:"default"}],conditionLogic:"AND",actions:[{type:"CREATE_ALERT",config:{title:"Compra relevante",message:"Revisar"}}],status:"ACTIVE",cooldownSeconds:0,maxDepth:3}});
    const runs=await dispatchOperationEvent({companyId:company.id,event:"PURCHASE_APPROVED",payload:{total:150,token:"secret"},correlationId:fixture,requestId:`req-${fixture}`,origin:"PURCHASE",userId:user.id});
    assert.equal(runs[0].status,"COMPLETED"); assert.equal(runs[0].payload.token,"[REDACTED]");
    assert.equal(await prisma.alert.count({where:{companyId:company.id,type:"CREATE_ALERT"}}),1);
    assert.equal(await prisma.auditLog.count({where:{companyId:company.id,action:"operation.automation.executed"}}),1);
    assert.equal((await dispatchOperationEvent({companyId:company.id,event:"PURCHASE_APPROVED",payload:{total:150},correlationId:fixture,requestId:`req-${fixture}`}))[0].id,runs[0].id);
    const depth=await runAutomation(rule,{payload:{total:150},idempotencyKey:`depth:${fixture}`,depth:4,origin:"TEST"});assert.equal(depth.status,"SKIPPED");
    const sensitive=await prisma.operationAutomation.create({data:{companyId:company.id,name:"Sensível",module:"FISCAL",event:"FISCAL_DOCUMENT_AUTHORIZED",conditions:[],actions:[{type:"ISSUE_FISCAL_DOCUMENT",config:{}}],status:"ACTIVE"}});
    const blocked=await runAutomation(sensitive,{payload:{},idempotencyKey:`sensitive:${fixture}`,depth:0,origin:"TEST"});assert.equal(blocked.status,"SKIPPED");assert.equal(blocked.blockedActions.length,1);
    const filled=await getOperationDashboard(company.id,{});assert.equal(filled.indicators.activeAutomations,2);assert.equal(filled.indicators.operationalAlerts,1);
  } finally {
    await prisma.operationAutomationRun.deleteMany({where:{companyId:company.id}});await prisma.operationAutomation.deleteMany({where:{companyId:company.id}});await prisma.alert.deleteMany({where:{companyId:company.id}});await prisma.auditLog.deleteMany({where:{companyId:company.id}});await prisma.company.delete({where:{id:company.id}});await prisma.user.delete({where:{id:user.id}});
  }
});
