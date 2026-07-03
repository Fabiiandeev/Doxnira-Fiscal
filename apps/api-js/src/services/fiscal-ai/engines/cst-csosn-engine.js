export function cstCsosnEngine(classification, cfopResult, ctx) {
  const { isSimples } = classification;
  const cfop = cfopResult.selectedCfop;

  if (isSimples) {
    let codigo = "102";
    let descricao = "Tributada pelo Simples Nacional sem permissão de crédito";
    let aplicacao = "Venda para não contribuinte — sem crédito";
    let fonte = "Tabela CSOSN — Simples Nacional (Convênio SINIEF)";

    if (cfop && classification.isContribuinte && !classification.isConsumidorFinal) {
      codigo = "101";
      descricao = "Tributada pelo Simples Nacional com permissão de crédito";
      aplicacao = "Venda para contribuinte — permite crédito";
    }

    return {
      phase: "determine_cst_csosn",
      tipo: "CSOSN",
      codigo,
      descricao,
      aplicacao,
      fonte,
      usesCsosn: true,
      usesCst: false,
    };
  }

  let codigo = "00";
  let descricao = "Tributada integralmente";
  let aplicacao = "Operação sem redução e sem diferimento";
  let fonte = "Tabela CST ICMS — Regime Normal (Convênio SINIEF)";

  if (ctx.ncmEntry?.st) {
    codigo = "10";
    descricao = "Tributada e ST";
    aplicacao = "Tributada com cobrança de ICMS-ST";
  }

  return {
    phase: "determine_cst_csosn",
    tipo: "CST",
    codigo,
    descricao,
    aplicacao,
    fonte,
    usesCsosn: false,
    usesCst: true,
  };
}
