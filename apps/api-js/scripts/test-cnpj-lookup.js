#!/usr/bin/env node

import { lookupCnpj, checkSimpleNacional, searchStateRegistration, resolveSimpleNacionalAnexo, classifyIPI } from "../src/services/cnpj-lookup.service.js";

const testCnpj = "13219857000149";

async function test() {
  console.log(`\n=== Testando CNPJ ${testCnpj} ===\n`);

  try {
    console.log("1. Buscando dados cadastrais...");
    const data = await lookupCnpj(testCnpj);
    console.log("   ✓ Dados encontrados:");
    console.log(`   - Razão Social: ${data.legalName}`);
    console.log(`   - Nome Fantasia: ${data.tradeName}`);
    console.log(`   - Cidade: ${data.city}, ${data.uf}`);
    console.log(`   - CNAE: ${data.cnaePrincipal}`);
    console.log(`   - Atividade: ${data.atividadePrincipal}`);
    console.log(`   - Situação: ${data.situacao}`);

    console.log("\n2. Verificando Simples Nacional...");
    const isSimples = await checkSimpleNacional(testCnpj);
    console.log(`   - Optante: ${isSimples === true ? "Sim" : isSimples === false ? "Não" : "Desconhecido"}`);

    if (!isSimples) {
      console.log("   - Esperado: regime tributário PENDENTE_CONFIRMACAO");
      console.log("   - Esperado: PIS/COFINS PENDENTE_CONFIRMACAO");
      console.log("   - Esperado: anexoSimples null");
    }

    console.log("\n3. Buscando Inscrição Estadual...");
    const ieResult = await searchStateRegistration(testCnpj, data.uf);
    console.log(`   - Encontrada: ${ieResult.found}`);
    if (ieResult.found) {
      console.log(`   - IE: ${ieResult.inscricaoEstadual}`);
      console.log(`   - Ativo: ${ieResult.ativo}`);
    } else {
      console.log("   - Esperado: contribuinteICMS PENDENTE_SINTEGRA");
    }

    console.log("\n4. Resolvendo Simples Nacional...");
    const anexo = resolveSimpleNacionalAnexo(data.cnaePrincipal);
    console.log(`   - Anexo: ${anexo || "Não resolvido"}`);

    console.log("\n5. Classificando IPI...");
    const ipi = classifyIPI(data.cnaePrincipal);
    console.log(`   - Classificação: ${ipi}`);
    if (ipi === "PROVAVEL") {
      console.log("   - Esperado: alerta para confirmar incidência por NCM");
    }

    console.log("\n✓ Teste completado com sucesso\n");
  } catch (error) {
    console.error("✗ Erro durante teste:", error.message);
    process.exit(1);
  }
}

test();
