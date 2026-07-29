import assert from "node:assert/strict";
import test from "node:test";
import { nfceSchema, nfseSchema } from "../../src/modules/fiscal-emission/fiscal-emission.schemas.js";
import { validateNfce } from "../../src/modules/fiscal-emission/fiscal-emission.service.js";

const item = { description:"Produto",quantity:2,unitPrice:10,unit:"UN",ncm:"84713012",cfop:"5102",csosn:"102" };
test("NFC-e valida CSOSN, CFOP, NCM, unidade, total, pagamento e troco",()=>{
 const input={items:[item],payments:[{method:"DINHEIRO",amount:25}],change:5};
 assert.equal(nfceSchema.safeParse(input).success,true);
 assert.deepEqual(validateNfce(input),{valid:true,issues:[],total:20,paid:25,change:5});
});
test("NFC-e rejeita unidade inválida, tributação ausente e total divergente",()=>{
 const result=nfceSchema.safeParse({items:[{...item,unit:"PE",csosn:undefined}],payments:[{method:"PIX",amount:1}],change:0});
 assert.equal(result.success,false);
});
test("NFS-e exige serviço, tomador e valores consistentes",()=>{
 const valid={customerId:"b907e45d-39ee-4afd-8127-7e21d97b83e3",serviceId:"7adc345d-8d91-4dd1-8818-8b9805d9cd57",description:"Consultoria fiscal",value:500,deductions:25};
 assert.equal(nfseSchema.safeParse(valid).success,true);
 assert.equal(nfseSchema.safeParse({...valid,value:-1}).success,false);
});
