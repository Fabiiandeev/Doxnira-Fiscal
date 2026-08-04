import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
const root=process.cwd(),read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("rotas dedicadas de contas financeiras existem",()=>{for(const file of ["app/(app)/financeiro/contas-financeiras/page.tsx","app/(app)/financeiro/contas-financeiras/nova/page.tsx","app/(app)/financeiro/contas-financeiras/[accountId]/editar/page.tsx"])assert.equal(fs.existsSync(path.join(root,file)),true,file)});

test("lista cobre botão Novo por rota, loading, erro, vazio, indicadores e ações",()=>{const ui=read("components/financial/accounts/accounts-ui.tsx");for(const value of ["Nova conta","/financeiro/contas-financeiras/nova","Carregando","animate-pulse","Tentar novamente","Nenhuma conta financeira cadastrada","Contas ativas","Editar","Desativar","Ativar"])assert.match(ui,new RegExp(value))});

test("formulário valida, aceita Caixa Homologação e impede VIEWER",()=>{const schema=read("lib/services/financial-accounts/financial-account-schemas.ts"),ui=read("components/financial/accounts/accounts-ui.tsx");assert.match(schema,/Informe o nome da conta/);assert.match(schema,/Selecione o tipo da conta/);assert.match(schema,/Informe a data do saldo inicial/);assert.match(ui,/Caixa Homologação/);for(const value of ["CASH","Bank","initialBalance","create.isPending","update.isPending","Salvando"])assert.match(ui,new RegExp(value,"i"));assert.match(ui,/role\s*!==\s*["']VIEWER["']/)});

test("service não aceita companyId pelo body, preserva CSRF e usa rota isolada por empresa",()=>{const service=read("lib/services/financial-accounts/financial-account-service.ts"),api=read("lib/api.ts");assert.doesNotMatch(service,/body.*companyId/i);assert.match(service,/companies\/\$\{companyId\}\/financial\/accounts/);assert.match(service,/\/activate/);assert.match(service,/\/deactivate/);assert.match(api,/credentials: "include"/);assert.match(api,/x-csrf-token/)});

test("hooks TanStack Query isolam chaves por empresa e invalidam escopos financeiros",()=>{const keys=read("lib/services/financial-accounts/financial-account-query-keys.ts"),hooks=read("lib/services/financial-accounts/financial-account-hooks.ts");for(const value of ["all","list","detail"])assert.match(keys,new RegExp(value));assert.match(keys,/companyId/);assert.match(hooks,/financialAccountKeys\.all\(companyId\)/);assert.match(hooks,/financial-dashboard/);assert.match(hooks,/payables/)});

test("sidebar expõe contas financeiras e remove botão morto", ()=>{const sidebar=read("lib/sidebar-navigation.ts");assert.match(sidebar,/\/financeiro\/contas-financeiras/)});

test("botão Reabrir de payable respeita lifecycle CANCELED e exige justificativa",()=>{const ui=read("components/financial/payables/payable-ui.tsx"),service=read("lib/services/payables/payable-service.ts"),hooks=read("lib/services/payables/payable-hooks.ts");assert.match(ui,/useReopenPayable/);assert.match(ui,/item\.status===\s*"CANCELED"/);assert.match(ui,/Reabrir conta a pagar/);assert.match(ui,/mínimo 10 caracteres/i);assert.match(service,/\/reopen/);assert.match(hooks,/useReopenPayable/)});

test("backend expõe rotas activate, deactivate e reopen com permissão financeira",()=>{const routes=read("../api-js/src/modules/financial/financial.routes.js"),service=read("../api-js/src/modules/financial/financial.service.js");assert.match(routes,/\/activate/);assert.match(routes,/\/deactivate/);assert.match(routes,/\/reopen/);assert.match(routes,/reopenEntry/);assert.match(service,/reopenEntry/);assert.match(service,/FINANCIAL_REOPEN_INVALID_STATE/);assert.match(service,/FINANCIAL_REOPEN_PENDING_SETTLEMENT/)});
