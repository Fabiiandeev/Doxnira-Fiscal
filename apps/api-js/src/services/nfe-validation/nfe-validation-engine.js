import { isValidCnpj } from "../../utils/cnpj.js";
import { isValidCpf } from "../../utils/cpf.js";
import { simulateTaxDecision } from "../fiscal-ai/simulate-tax-decision.js";
import { getCurrentCertificate, serializeCertificate } from "../certificate-vault.service.js";
import { prisma } from "../../config/prisma.js";

const UF_CODES = {
  AC: "12", AL: "27", AM: "13", AP: "16", BA: "29",
  CE: "23", DF: "53", ES: "32", GO: "52", MA: "21",
  MG: "31", MS: "50", MT: "51", PA: "15", PB: "25",
  PE: "26", PI: "22", PR: "41", RJ: "33", RN: "24",
  RO: "11", RR: "14", RS: "43", SC: "42", SE: "28",
  SP: "35", TO: "17",
};

const VALID_UFS = Object.keys(UF_CODES);

function makeIssue(code, category, severity, field, description, impact, howToFix, autoCorrectAvailable = false, autoCorrectValue = null, baseLegal = "") {
  return {
    code,
    category,
    severity,
    field,
    description,
    impact,
    howToFix,
    autoCorrectAvailable,
    autoCorrectValue,
    baseLegal,
    resolved: false,
  };
}

function phaseProgress(phase, total = 10) {
  return { phase, completed: true, percent: Math.round(((phase) / total) * 100) };
}

async function validateXmlStructure(nfeData) {
  const issues = [];
  if (!nfeData.versao) {
    issues.push(makeIssue("XML-001", "XML", "CRITICAL", "versao", "Versao do layout nao informada.", "A SEFAZ rejeitara imediatamente a NF-e.", "Informe a versao do layout (4.00).", true, "4.00", "NT 2025.002"));
  } else if (nfeData.versao !== "4.00") {
    issues.push(makeIssue("XML-002", "XML", "CRITICAL", "versao", `Versao ${nfeData.versao} nao e a vigente.`, "A SEFAZ rejeitara por versao invalida.", "Altere para versao 4.00.", true, "4.00", "NT 2025.002"));
  }
  if (!nfeData.naturezaOperacao) {
    issues.push(makeIssue("XML-003", "XML", "CRITICAL", "naturezaOperacao", "Natureza da operacao ausente.", "Tag ide/natOp obrigatoria.", "Informe a natureza da operacao (ex: Venda).", false));
  }
  if (!nfeData.serie && nfeData.serie !== 0) {
    issues.push(makeIssue("XML-004", "XML", "ERROR", "serie", "Serie da NF-e nao informada.", "Campo obrigatoria ausente.", "Informe a serie (1-999).", false));
  }
  if (!nfeData.numero && nfeData.numero !== 0) {
    issues.push(makeIssue("XML-005", "XML", "ERROR", "numero", "Numero da NF-e nao informado.", "Campo obrigatoria ausente.", "Informe o numero da NF-e.", false));
  }
  if (nfeData.tipoOperacao == null) {
    issues.push(makeIssue("XML-006", "XML", "CRITICAL", "tipoOperacao", "Tipo de operacao (tpNF) nao informado.", "0=Entrada, 1=Saida — campo obrigatoria.", "Informe 0 (Entrada) ou 1 (Saida).", false));
  }
  if (!nfeData.finalidadeEmissao) {
    issues.push(makeIssue("XML-007", "XML", "ERROR", "finalidadeEmissao", "Finalidade da emissao nao informada.", "1=Normal, 2=Complementar, 3=Ajuste, 4=Devolucao.", "Informe a finalidade da emissao.", true, "1"));
  }
  return { phase: "xml_structure", issues, name: "Estrutura XML" };
}

async function validateEmitente(nfeData, company) {
  const issues = [];
  const emit = nfeData.emitente || {};
  if (!emit.cnpj || !isValidCnpj(String(emit.cnpj).replace(/\D/g, ""))) {
    issues.push(makeIssue("EMIT-001", "EMITENTE", "CRITICAL", "emitente.cnpj", "CNPJ do emitente invalido.", "A SEFAZ rejeitara a NF-e.", "Verifique e corrija o CNPJ do emitente.", false));
  }
  if (!emit.ie) {
    issues.push(makeIssue("EMIT-002", "EMITENTE", "CRITICAL", "emitente.ie", "Inscricao Estadual do emitente ausente.", "Campo obrigatoria para emitente contribuinte.", "Informe a IE do emitente.", false));
  }
  if (!emit.crt) {
    issues.push(makeIssue("EMIT-003", "EMITENTE", "CRITICAL", "emitente.crt", "CRT nao informado.", "1=Simples, 2=Simples+ST, 3=Normal, 4=MEI.", "Informe o CRT.", false));
  } else if (!["1", "2", "3", "4"].includes(String(emit.crt))) {
    issues.push(makeIssue("EMIT-004", "EMITENTE", "CRITICAL", "emitente.crt", `CRT ${emit.crt} invalido.`, "Apenas 1, 2, 3 ou 4 sao validos.", "Corrija o CRT.", true, "1"));
  }
  if (!emit.razaoSocial) {
    issues.push(makeIssue("EMIT-005", "EMITENTE", "ERROR", "emitente.razaoSocial", "Razao Social do emitente ausente.", "Campo obrigatoria.", "Informe a Razao Social.", false));
  }
  if (!emit.uf) {
    issues.push(makeIssue("EMIT-006", "EMITENTE", "ERROR", "emitente.uf", "UF do emitente ausente.", "Necessaria para determinar aliquotas.", "Informe a UF do emitente.", false));
  } else if (!VALID_UFS.includes(emit.uf)) {
    issues.push(makeIssue("EMIT-007", "EMITENTE", "CRITICAL", "emitente.uf", `UF ${emit.uf} invalida.`, "A SEFAZ rejeitara.", "Selecione uma UF valida.", false));
  }
  if (!emit.municipio) {
    issues.push(makeIssue("EMIT-008", "EMITENTE", "ERROR", "emitente.municipio", "Municipio do emitente ausente.", "Campo obrigatoria.", "Informe o municipio.", false));
  }
  if (!emit.codigoIbge) {
    const uf = emit.uf;
    const ibge = uf && UF_CODES[uf] ? UF_CODES[uf] : null;
    if (ibge) {
      issues.push(makeIssue("EMIT-009", "EMITENTE", "ALERT", "emitente.codigoIbge", "Codigo IBGE do municipio ausente.", "A SEFAZ pode rejeitar.", "Preencher automaticamente com base na UF.", true, ibge, "Convencoes IBGE"));
    } else {
      issues.push(makeIssue("EMIT-010", "EMITENTE", "ALERT", "emitente.codigoIbge", "Codigo IBGE do municipio ausente.", "A SEFAZ pode rejeitar.", "Informe o codigo IBGE do municipio.", false));
    }
  }
  return { phase: "emitente", issues, name: "Emitente" };
}

async function validateDestinatario(nfeData) {
  const issues = [];
  const dest = nfeData.destinatario || {};
  const tipo = (dest.tipoPessoa || "").toUpperCase();
  if (tipo === "PJ" || dest.cnpj) {
    const cnpj = String(dest.cnpj || "").replace(/\D/g, "");
    if (!cnpj) {
      issues.push(makeIssue("DEST-001", "DESTINATARIO", "CRITICAL", "destinatario.cnpj", "CNPJ do destinatario ausente.", "Pessoa juridica exige CNPJ.", "Informe o CNPJ.", false));
    } else if (!isValidCnpj(cnpj)) {
      issues.push(makeIssue("DEST-002", "DESTINATARIO", "CRITICAL", "destinatario.cnpj", "CNPJ do destinatario invalido.", "A SEFAZ rejeitara por CNPJ invalido.", "Verifique e corrija o CNPJ.", false));
    }
  } else if (tipo === "PF" || dest.cpf) {
    const cpf = String(dest.cpf || "").replace(/\D/g, "");
    if (!cpf) {
      issues.push(makeIssue("DEST-003", "DESTINATARIO", "CRITICAL", "destinatario.cpf", "CPF do destinatario ausente.", "Pessoa fisica exige CPF.", "Informe o CPF.", false));
    } else if (!isValidCpf(cpf)) {
      issues.push(makeIssue("DEST-004", "DESTINATARIO", "CRITICAL", "destinatario.cpf", "CPF do destinatario invalido.", "A SEFAZ rejeitara.", "Verifique o CPF.", false));
    }
  } else {
    if (!dest.cpf && !dest.cnpj) {
      const isConsumidorFinal = dest.consumidorFinal === true || dest.indicadorIe === "9";
      if (!isConsumidorFinal) {
        issues.push(makeIssue("DEST-005", "DESTINATARIO", "ERROR", "destinatario.documento", "Destinatario sem CPF/CNPJ.", "Exceto consumidor final sem documento.", "Informe CPF/CNPJ ou marque como consumidor final.", false));
      }
    }
  }
  if (!dest.razaoSocial && !dest.nome) {
    issues.push(makeIssue("DEST-006", "DESTINATARIO", "ERROR", "destinatario.nome", "Nome/razao social do destinatario ausente.", "Campo obrigatoria.", "Informe o nome.", false));
  }
  if (!dest.uf) {
    issues.push(makeIssue("DEST-007", "DESTINATARIO", "ALERT", "destinatario.uf", "UF do destinatario ausente.", "Necessaria para determinar CFOP e aliquotas interestaduais.", "Informe a UF.", false));
  } else if (!VALID_UFS.includes(dest.uf)) {
    issues.push(makeIssue("DEST-008", "DESTINATARIO", "CRITICAL", "destinatario.uf", `UF do destinatario ${dest.uf} invalida.`, "A SEFAZ rejeitara.", "Selecione uma UF valida.", false));
  }
  if (dest.ie && dest.indicadorIe && dest.indicadorIe !== "1" && dest.indicadorIe !== "2") {
    if (dest.indicadorIe === "9" && dest.ie && dest.ie !== "ISENTO") {
      issues.push(makeIssue("DEST-009", "DESTINATARIO", "ALERT", "destinatario.ie", `IE ${dest.ie} informada mas indicador IE=9 (nao contribuinte).`, "Inconsistencia entre IE e indicador.", "Verifique se o destinatario e contribuinte.", false));
    }
  }
  return { phase: "destinatario", issues, name: "Destinatario" };
}

async function validateProdutos(nfeData) {
  const issues = [];
  const itens = nfeData.itens || [];
  if (itens.length === 0) {
    issues.push(makeIssue("PROD-001", "PRODUTOS", "CRITICAL", "itens", "Nenhum item na NF-e.", "NF-e sem itens sera rejeitada.", "Adicione pelo menos um item.", false));
    return { phase: "produtos", issues, name: "Produtos" };
  }
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    const prefix = `item[${i + 1}]`;
    if (!item.ncm) {
      issues.push(makeIssue("PROD-002", "PRODUTOS", "CRITICAL", `${prefix}.ncm`, `Item ${i + 1}: NCM ausente.`, "A SEFAZ rejeitara por NCM ausente.", "Informe o NCM de 8 digitos.", false));
    } else if (String(item.ncm).replace(/\D/g, "").length !== 8) {
      issues.push(makeIssue("PROD-003", "PRODUTOS", "CRITICAL", `${prefix}.ncm`, `Item ${i + 1}: NCM ${item.ncm} invalido (deve ter 8 digitos).`, "A SEFAZ rejeitara.", "Corrija o NCM.", false));
    }
    if (!item.cfop) {
      issues.push(makeIssue("PROD-004", "PRODUTOS", "CRITICAL", `${prefix}.cfop`, `Item ${i + 1}: CFOP ausente.`, "A SEFAZ rejeitara por CFOP ausente.", "Informe o CFOP.", false));
    } else if (!/^[0-9]{4}$/.test(String(item.cfop))) {
      issues.push(makeIssue("PROD-005", "PRODUTOS", "CRITICAL", `${prefix}.cfop`, `Item ${i + 1}: CFOP ${item.cfop} invalido.`, "CFOP deve ter 4 digitos.", "Corrija o CFOP.", false));
    }
    if (!item.descricao) {
      issues.push(makeIssue("PROD-006", "PRODUTOS", "ERROR", `${prefix}.descricao`, `Item ${i + 1}: Descricao ausente.`, "A SEFAZ exige descricao do produto.", "Informe a descricao.", false));
    }
    if (!item.quantidade || Number(item.quantidade) <= 0) {
      issues.push(makeIssue("PROD-007", "PRODUTOS", "CRITICAL", `${prefix}.quantidade`, `Item ${i + 1}: Quantidade invalida.`, "Quantidade deve ser maior que zero.", "Corrija a quantidade.", false));
    }
    if (!item.valorUnitario || Number(item.valorUnitario) <= 0) {
      issues.push(makeIssue("PROD-008", "PRODUTOS", "CRITICAL", `${prefix}.valorUnitario`, `Item ${i + 1}: Valor unitario invalido.`, "Valor unitario deve ser maior que zero.", "Corrija o valor unitario.", false));
    }
    const qtd = Number(item.quantidade) || 0;
    const vUnit = Number(item.valorUnitario) || 0;
    const vTotal = Number(item.valorTotal) || 0;
    const expectedTotal = +(qtd * vUnit).toFixed(2);
    if (vTotal > 0 && Math.abs(vTotal - expectedTotal) > 0.01) {
      issues.push(makeIssue("PROD-009", "PRODUTOS", "ERROR", `${prefix}.valorTotal`, `Item ${i + 1}: Total R$${vTotal.toFixed(2)} diverge de Qtd x Unit = R$${expectedTotal.toFixed(2)}.`, "A SEFAZ pode rejeitar por divergencia.", "Recalcular automaticamente.", true, expectedTotal));
    }
    if (!item.unidade) {
      issues.push(makeIssue("PROD-010", "PRODUTOS", "ALERT", `${prefix}.unidade`, `Item ${i + 1}: Unidade comercial ausente.`, "Campo obrigatoria.", "Informe a unidade (ex: UN, KG, L).", true, "UN"));
    }
    if (!item.origem && item.origem !== 0) {
      issues.push(makeIssue("PROD-011", "PRODUTOS", "ALERT", `${prefix}.origem`, `Item ${i + 1}: Origem da mercadoria ausente.`, "Campo obrigatoria para ICMS.", "Informe a origem (0=Nacional, 1=Importacao direta, etc).", true, "0"));
    }
  }
  return { phase: "produtos", issues, name: "Produtos" };
}

async function validateTributacao(nfeData, company) {
  const issues = [];
  const itens = nfeData.itens || [];
  const emit = nfeData.emitente || {};
  const dest = nfeData.destinatario || {};
  const crt = String(emit.crt || "");
  const isSimples = crt === "1" || crt === "2" || crt === "4";
  const ufOrigem = emit.uf || "";
  const ufDestino = dest.uf || "";

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    const prefix = `item[${i + 1}]`;
    if (isSimples) {
      if (!item.csosn) {
        issues.push(makeIssue("TRIB-001", "TRIBUTACAO", "CRITICAL", `${prefix}.csosn`, `Item ${i + 1}: CSOSN ausente (CRT ${crt} exige CSOSN).`, "A SEFAZ rejeitara.", "Informe o CSOSN (101, 102, 103, etc).", false));
      } else if (item.cst && !item.csosn) {
        issues.push(makeIssue("TRIB-002", "TRIBUTACAO", "CRITICAL", `${prefix}.cst`, `Item ${i + 1}: CST informado em vez de CSOSN (Simples Nacional).`, "A SEFAZ rejeitara — Simples usa CSOSN.", "Substituir CST por CSOSN.", false));
      }
    } else {
      if (!item.cst) {
        issues.push(makeIssue("TRIB-003", "TRIBUTACAO", "CRITICAL", `${prefix}.cst`, `Item ${i + 1}: CST ICMS ausente (Regime Normal exige CST).`, "A SEFAZ rejeitara.", "Informe o CST (00, 10, 20, etc).", false));
      } else if (item.csosn && !item.cst) {
        issues.push(makeIssue("TRIB-004", "TRIBUTACAO", "CRITICAL", `${prefix}.csosn`, `Item ${i + 1}: CSOSN informado em vez de CST (Regime Normal).`, "A SEFAZ rejeitara — Regime Normal usa CST.", "Substituir CSOSN por CST.", false));
      }
    }
    if (item.csosn === "201" || item.csosn === "202" || item.csosn === "203" || item.cst === "10" || item.cst === "30") {
      if (!item.cest) {
        issues.push(makeIssue("TRIB-005", "TRIBUTACAO", "ALERT", `${prefix}.cest`, `Item ${i + 1}: ST detectada mas CEST ausente.`, "Cistencia de protocolos ST.", "Informe o CEST.", false));
      }
    }
    if (ufOrigem && ufDestino && ufOrigem !== ufDestino) {
      const cfopStr = String(item.cfop || "");
      if (cfopStr.startsWith("5")) {
        issues.push(makeIssue("TRIB-006", "TRIBUTACAO", "CRITICAL", `${prefix}.cfop`, `Item ${i + 1}: CFOP ${cfopStr} (interno) para operacao interestadual (${ufOrigem}->${ufDestino}).`, "A SEFAZ rejeitara por CFOP incompativel.", `Usar CFOP 6${cfopStr.slice(1)}.`, true, `6${cfopStr.slice(1)}`, "Ajuste SINIEF 07/2005"));
      }
    }
    if (ufOrigem && ufDestino && ufOrigem === ufDestino) {
      const cfopStr = String(item.cfop || "");
      if (cfopStr.startsWith("6")) {
        issues.push(makeIssue("TRIB-007", "TRIBUTACAO", "CRITICAL", `${prefix}.cfop`, `Item ${i + 1}: CFOP ${cfopStr} (interestadual) para operacao interna (${ufOrigem}).`, "A SEFAZ rejeitara.", `Usar CFOP 5${cfopStr.slice(1)}.`, true, `5${cfopStr.slice(1)}`, "Ajuste SINIEF 07/2005"));
      }
    }
  }
  return { phase: "tributacao", issues, name: "Tributacao" };
}

async function validateTotais(nfeData) {
  const issues = [];
  const tot = nfeData.totais || {};
  const itens = nfeData.itens || [];
  const firstNumber = (...values) => {
    const found = values.find((value) => value !== undefined && value !== null && value !== "");
    return Number(found) || 0;
  };
  let calcProdutos = 0;
  let calcIcms = 0;
  let calcIpi = 0;
  let calcPis = 0;
  let calcCofins = 0;
  let calcDesconto = 0;
  let calcFrete = 0;
  let calcSeguro = 0;
  let calcOutras = 0;
  let calcFcp = 0;
  for (const item of itens) {
    calcProdutos += Number(item.valorTotal) || 0;
    calcIcms += firstNumber(item.icmsValor, item.icmsAmount);
    calcIpi += firstNumber(item.ipiValor, item.ipiAmount);
    calcPis += firstNumber(item.pisValor, item.pisAmount);
    calcCofins += firstNumber(item.cofinsValor, item.cofinsAmount);
    calcDesconto += firstNumber(item.descontoValor, item.desconto);
    calcFrete += firstNumber(item.freteValor, item.freightValue);
    calcSeguro += firstNumber(item.seguroValor, item.insuranceValue);
    calcOutras += firstNumber(item.outrasDespesasValor, item.otherCosts);
    calcFcp += firstNumber(item.fcpValor, item.fcpAmount);
  }
  calcProdutos = +calcProdutos.toFixed(2);
  calcIcms = +calcIcms.toFixed(2);
  calcIpi = +calcIpi.toFixed(2);
  calcPis = +calcPis.toFixed(2);
  calcCofins = +calcCofins.toFixed(2);
  calcDesconto = +calcDesconto.toFixed(2);
  calcFrete = +calcFrete.toFixed(2);
  calcSeguro = +calcSeguro.toFixed(2);
  calcOutras = +calcOutras.toFixed(2);
  calcFcp = +calcFcp.toFixed(2);
  const checkField = (field, reported, calculated, label) => {
    const rep = +Number(reported).toFixed(2);
    const calc = +calculated.toFixed(2);
    if (Math.abs(rep - calc) > 0.01) {
      issues.push(makeIssue(`TOT-${field.toUpperCase()}`, "TOTAIS", "ERROR", `totais.${field}`, `${label}: informado R$${rep} vs calculado R$${calc}.`, "A SEFAZ pode rejeitar por divergencia nos totais.", "Recalcular automaticamente.", true, calc));
    }
  };
  checkField("produtos", tot.valorProdutos, calcProdutos, "Total Produtos");
  checkField("icms", firstNumber(tot.icmsTotal, tot.totalIcms), calcIcms, "Total ICMS");
  checkField("ipi", firstNumber(tot.ipiTotal, tot.totalIpi), calcIpi, "Total IPI");
  checkField("pis", firstNumber(tot.pisTotal, tot.totalPis), calcPis, "Total PIS");
  checkField("cofins", firstNumber(tot.cofinsTotal, tot.totalCofins), calcCofins, "Total COFINS");
  checkField("desconto", firstNumber(tot.descontoTotal, tot.desconto), calcDesconto, "Total Desconto");
  checkField("frete", firstNumber(tot.freteTotal, tot.frete), calcFrete, "Total Frete");
  checkField("seguro", firstNumber(tot.seguroTotal, tot.seguro), calcSeguro, "Total Seguro");
  checkField("outras", firstNumber(tot.outrasDespesasTotal, tot.outrasDespesas), calcOutras, "Outras Despesas");
  checkField("fcp", firstNumber(tot.fcpTotal, tot.totalFcp), calcFcp, "Total FCP");
  const expectedNota = +(calcProdutos - calcDesconto + calcFrete + calcSeguro + calcOutras + calcIpi).toFixed(2);
  const reportedNota = +firstNumber(tot.valorNota, tot.valorTotal).toFixed(2);
  if (tot.valorNota != null && Math.abs(reportedNota - expectedNota) > 0.01) {
    issues.push(makeIssue("TOT-NOTA", "TOTAIS", "CRITICAL", "totais.valorNota", `Valor da NF-e: informado R$${reportedNota} vs calculado R$${expectedNota}.`, "A SEFAZ rejeitara por divergencia no valor da nota.", "Recalcular automaticamente.", true, expectedNota));
  }
  return { phase: "totais", issues, name: "Totais" };
}

async function validateTransporte(nfeData) {
  const issues = [];
  const transp = nfeData.transporte || {};
  if (!transp.modalidadeFrete) {
    issues.push(makeIssue("TRANS-001", "TRANSPORTE", "ERROR", "transporte.modalidadeFrete", "Modalidade do frete nao informada.", "0=Entrada, 1=Conta emitente, 2=Por conta destinatario, 3=Proprio, 4=Proprio destinatario, 9=Sem frete.", "Informe a modalidade.", true, "9"));
  } else if (!["0", "1", "2", "3", "4", "9"].includes(String(transp.modalidadeFrete))) {
    issues.push(makeIssue("TRANS-002", "TRANSPORTE", "CRITICAL", "transporte.modalidadeFrete", `Modalidade ${transp.modalidadeFrete} invalida.`, "A SEFAZ rejeitara.", "Use 0-4 ou 9.", false));
  }
  const hasTransportadora = transp.cnpj || transp.cpf || transp.razaoSocial;
  if (hasTransportadora) {
    if (transp.cnpj) {
      const cnpj = String(transp.cnpj).replace(/\D/g, "");
      if (!isValidCnpj(cnpj)) {
        issues.push(makeIssue("TRANS-003", "TRANSPORTE", "ERROR", "transporte.cnpj", "CNPJ da transportadora invalido.", "Pode causar rejeicao.", "Verifique o CNPJ.", false));
      }
    }
    if (transp.placa && transp.ufPlaca) {
      if (!VALID_UFS.includes(transp.ufPlaca)) {
        issues.push(makeIssue("TRANS-004", "TRANSPORTE", "ALERT", "transporte.ufPlaca", `UF da placa ${transp.ufPlaca} invalida.`, "Informacao inconsistente.", "Selecione uma UF valida.", false));
      }
    }
  }
  const volumes = transp.volumes || [];
  if (volumes.length > 0) {
    for (let i = 0; i < volumes.length; i++) {
      const vol = volumes[i];
      if (vol.pesoBrto && vol.pesoLiquido && Number(vol.pesoLiquido) > Number(vol.pesoBrto)) {
        issues.push(makeIssue("TRANS-005", "TRANSPORTE", "ALERT", `transporte.volumes[${i}].pesoLiquido`, `Volume ${i + 1}: Peso liquido maior que bruto.`, "Inconsistencia logica.", "Corrija os pesos.", false));
      }
    }
  }
  return { phase: "transporte", issues, name: "Transporte" };
}

async function validateCobranca(nfeData) {
  const issues = [];
  const cob = nfeData.cobranca || {};
  const pag = nfeData.pagamento || {};
  if (!pag.formaPagamento) {
    issues.push(makeIssue("COB-001", "COBRANCA", "ERROR", "pagamento.formaPagamento", "Forma de pagamento nao informada.", "0=Pagamento a vista, 1=Prazo, 2=Outros.", "Informe a forma de pagamento.", false));
  }
  const duplicatas = cob.duplicatas || [];
  if (duplicatas.length > 0) {
    let totalDups = 0;
    for (let i = 0; i < duplicatas.length; i++) {
      const dup = duplicatas[i];
      if (!dup.numero) {
        issues.push(makeIssue("COB-002", "COBRANCA", "ALERT", `cobranca.duplicatas[${i}].numero`, `Duplicata ${i + 1} sem numero.`, "Campo opcional mas recomendado.", "Informe o numero da duplicata.", false));
      }
      if (!dup.vencimento) {
        issues.push(makeIssue("COB-003", "COBRANCA", "ALERT", `cobranca.duplicatas[${i}].vencimento`, `Duplicata ${i + 1} sem vencimento.`, "Campo recomendado.", "Informe o vencimento.", false));
      }
      if (!dup.valor || Number(dup.valor) <= 0) {
        issues.push(makeIssue("COB-004", "COBRANCA", "ERROR", `cobranca.duplicatas[${i}].valor`, `Duplicata ${i + 1} com valor invalido.`, "Valor deve ser maior que zero.", "Corrija o valor.", false));
      }
      totalDups += Number(dup.valor) || 0;
    }
    const totalNota = Number(nfeData.totais?.valorNota) || 0;
    totalDups = +totalDups.toFixed(2);
    if (totalNota > 0 && Math.abs(totalDups - totalNota) > 0.01) {
      issues.push(makeIssue("COB-005", "COBRANCA", "ALERT", "cobranca.totalDuplicatas", `Total duplicatas R$${totalDups} diverge do valor da nota R$${totalNota.toFixed(2)}.`, "Possivel inconsistencia.", "Verifique as duplicatas.", false));
    }
  }
  return { phase: "cobranca", issues, name: "Cobranca" };
}

async function validateCertificado(companyId, nfeData = {}) {
  const issues = [];
  if (nfeData.mock === true) {
    return { phase: "certificado", issues, name: "Certificado Digital Mock" };
  }
  try {
    const cert = await getCurrentCertificate(companyId);
    const serialized = serializeCertificate(cert);
    if (!serialized) {
      issues.push(makeIssue("CERT-001", "CERTIFICADO", "CRITICAL", "certificado", "Nenhum certificado digital A1 cadastrado.", "A NF-e nao pode ser assinada nem transmitida.", "Cadastre um certificado A1.", false));
    } else if (serialized.expired) {
      issues.push(makeIssue("CERT-002", "CERTIFICADO", "CRITICAL", "certificado.validUntil", "Certificado digital vencido.", "A SEFAZ rejeitara assinatura de certificado vencido.", "Renove o certificado.", false));
    } else if (serialized.daysRemaining != null && serialized.daysRemaining <= 30) {
      issues.push(makeIssue("CERT-003", "CERTIFICADO", "ALERT", "certificado.validUntil", `Certificado vence em ${serialized.daysRemaining} dias.`, "Risco de indisponibilidade futura.", "Renove o certificado com antecedencia.", false));
    }
    if (serialized && !serialized.valid) {
      issues.push(makeIssue("CERT-004", "CERTIFICADO", "CRITICAL", "certificado", "Certificado digital invalido ou nao validado.", "A assinatura digital sera invalida.", "Valide o certificado.", false));
    }
  } catch {
    issues.push(makeIssue("CERT-005", "CERTIFICADO", "CRITICAL", "certificado", "Erro ao verificar certificado digital.", "Nao e possivel garantir a assinatura.", "Cadastre um certificado A1.", false));
  }
  return { phase: "certificado", issues, name: "Certificado Digital" };
}

async function validateAmbiente(nfeData, company) {
  const issues = [];
  const env = nfeData.ambiente || "";
  const companyEnv = company.environment || "production";
  if (!env) {
    issues.push(makeIssue("AMB-001", "AMBIENTE", "ALERT", "ambiente", "Ambiente de destino nao informado.", "Pode causar transmissao para ambiente errado.", `Informe o ambiente (${companyEnv}).`, true, companyEnv));
  } else if (env !== "1" && env !== "2") {
    issues.push(makeIssue("AMB-002", "AMBIENTE", "ERROR", "ambiente", `Ambiente ${env} invalido (1=Producao, 2=Homologacao).`, "A SEFAZ rejeitara.", "Use 1 (Producao) ou 2 (Homologacao).", false));
  }
  if (!nfeData.ufAutorizadora) {
    const emitUf = nfeData.emitente?.uf || company.uf;
    if (emitUf) {
      issues.push(makeIssue("AMB-003", "AMBIENTE", "ALERT", "ufAutorizadora", "UF autorizadora nao informada.", "A SEFAZ pode rejeitar.", `Usar UF do emitente: ${emitUf}.`, true, emitUf));
    }
  }
  return { phase: "ambiente", issues, name: "Ambiente" };
}

async function validateSimulacaoSEFAZ(nfeData, company) {
  const issues = [];
  const itens = nfeData.itens || [];
  const emit = nfeData.emitente || {};
  const dest = nfeData.destinatario || {};
  const taxSettings = await prisma.companyTaxSetting.findUnique({
    where: { companyId: company.id },
  });
  if (!taxSettings) {
    issues.push(makeIssue("SEFAZ-001", "SIMULACAO", "ALERT", "taxSettings", "Configuracao fiscal da empresa ausente.", "Simulacao SEFAZ limitada.", "Configure a fiscal antes de emitir em producao.", false));
  }
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    const ncm = String(item.ncm || "").replace(/\D/g, "");
    if (ncm.length !== 8) continue;
    try {
      const result = simulateTaxDecision({
        ncm,
        ufOrigem: emit.uf || "",
        ufDestino: dest.uf || "",
        crt: emit.crt || "1",
        tipoOperacao: nfeData.finalidadeEmissao === "4" ? "devolucao" : "venda",
        consumidorFinal: dest.consumidorFinal === true,
        contribuinteIcms: dest.indicadorIe === "1" || dest.indicadorIe === "2",
        valorProduto: Number(item.valorTotal) || 0,
        selectedCfop: String(item.cfop || ""),
        mode: "OFFICIAL_NFE",
        fiscalConfig: taxSettings ? {
          icmsRatesByUf: null,
          fcpRatesByUf: null,
          tipiTable: null,
          stTable: null,
          companyConfig: taxSettings,
        } : null,
      });
      if (result.valid && result.nfeRules?.blocks?.length > 0) {
        for (const block of result.nfeRules.blocks) {
          issues.push(makeIssue(
            `SEFAZ-${block.id || i}`,
            "SIMULACAO",
            "CRITICAL",
            `item[${i + 1}].${block.field || "fiscal"}`,
            block.message || `Bloqueio SEFAZ item ${i + 1}`,
            "A SEFAZ rejeitara esta NF-e.",
            "Resolva o bloqueio antes de transmitir.",
            false,
          ));
        }
      }
      if (result.valid && result.nfeRules?.warnings?.length > 0) {
        for (const w of result.nfeRules.warnings) {
          issues.push(makeIssue(
            `SEFAZ-W${i}`,
            "SIMULACAO",
            "ALERT",
            `item[${i + 1}].${w.field || "fiscal"}`,
            w.message || `Alerta fiscal item ${i + 1}`,
            "Pode causar rejeicao ou exigir retificacao.",
            "Verifique o alerta.",
            false,
          ));
        }
      }
      if (result.audit?.score != null && result.audit.score < 50) {
        issues.push(makeIssue("SEFAZ-SCORE", "SIMULACAO", "ALERT", `item[${i + 1}].score`, `Score fiscal item ${i + 1}: ${result.audit.score}/100.`, "Score baixo indica risco de rejeicao.", "Revise os dados tributarios.", false));
      }
    } catch {
      issues.push(makeIssue("SEFAZ-ERR", "SIMULACAO", "ALERT", `item[${i + 1}]`, `Erro ao simular regras SEFAZ para item ${i + 1}.`, "Nao foi possivel validar completamente.", "Verifique manualmente os dados tributarios.", false));
    }
  }
  return { phase: "simulacao_sefaz", issues, name: "Simulacao SEFAZ" };
}

export async function runNfeValidation(nfeData, company) {
  const startTime = Date.now();
  const phases = [];
  const allIssues = [];

  const runPhase = async (fn, ...args) => {
    const result = await fn(...args);
    phases.push({ phase: result.phase, name: result.name, issueCount: result.issues.length });
    allIssues.push(...result.issues);
    return result;
  };

  await runPhase(validateXmlStructure, nfeData);
  await runPhase(validateEmitente, nfeData, company);
  await runPhase(validateDestinatario, nfeData);
  await runPhase(validateProdutos, nfeData);
  await runPhase(validateTributacao, nfeData, company);
  await runPhase(validateTotais, nfeData);
  await runPhase(validateTransporte, nfeData);
  await runPhase(validateCobranca, nfeData);
  await runPhase(validateCertificado, company.id, nfeData);
  await runPhase(validateAmbiente, nfeData, company);
  await runPhase(validateSimulacaoSEFAZ, nfeData, company);

  const errorCount = allIssues.filter(i => i.severity === "CRITICAL" || i.severity === "ERROR").length;
  const alertCount = allIssues.filter(i => i.severity === "ALERT").length;
  const infoCount = allIssues.filter(i => i.severity === "INFO").length;

  let score = 100;
  for (const issue of allIssues) {
    if (issue.severity === "CRITICAL") score -= 15;
    else if (issue.severity === "ERROR") score -= 10;
    else if (issue.severity === "ALERT") score -= 3;
    else if (issue.severity === "INFO") score -= 1;
  }
  score = Math.max(0, Math.min(100, score));

  const rejectionProbability = score >= 95 ? "Muito Baixa" : score >= 80 ? "Baixa" : score >= 60 ? "Media" : score >= 40 ? "Alta" : "Muito Alta";
  const situation = errorCount === 0 && score >= 80 ? "Pronta para transmissao" : errorCount > 0 ? "Nao pode transmitir" : alertCount > 3 ? "Revisao recomendada" : "Pronta para transmissao";
  const canTransmit = errorCount === 0 && score >= 50;

  const durationMs = Date.now() - startTime;

  return {
    score,
    errorCount,
    alertCount,
    infoCount,
    rejectionProbability,
    situation,
    canTransmit,
    autoCorrections: 0,
    issues: allIssues,
    phases,
    durationMs,
    validatedAt: new Date().toISOString(),
  };
}

export function applyAutoCorrections(issues, nfeData) {
  const corrected = { ...nfeData };
  const corrections = [];
  const correctedFields = new Set();

  for (const issue of issues) {
    if (!issue.autoCorrectAvailable || issue.resolved) continue;
    if (correctedFields.has(issue.field)) continue;
    correctedFields.add(issue.field);

    const parts = issue.field.replace(/\[(\d+)\]/g, ".$1").split(".");
    let obj = corrected;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (obj[key] == null) obj[key] = {};
      obj = obj[key];
    }
    const lastKey = parts[parts.length - 1];
    const oldValue = obj[lastKey];
    obj[lastKey] = issue.autoCorrectValue;

    corrections.push({
      field: issue.field,
      oldValue: oldValue ?? null,
      newValue: issue.autoCorrectValue,
      code: issue.code,
      description: issue.description,
    });
    issue.resolved = true;
  }

  return { corrected, corrections, correctionCount: corrections.length };
}
