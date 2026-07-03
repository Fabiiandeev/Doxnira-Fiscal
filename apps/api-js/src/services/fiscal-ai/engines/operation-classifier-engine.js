export function operationClassifierEngine(ctx) {
  const isInternal = ctx.ufOrigem === ctx.ufDestino;
  const isInterestadual = !isInternal;

  let operationType = "venda";
  if (ctx.finalidade === "devolucao") operationType = "devolucao";
  else if (ctx.finalidade === "complementar") operationType = "complementar";
  else if (ctx.finalidade === "ajuste") operationType = "ajuste";
  else if (ctx.finalidade === "remessa") operationType = "remessa";
  else if (ctx.finalidade === "transferencia") operationType = "transferencia";
  else if (ctx.finalidade === "exportacao") operationType = "exportacao";

  const isConsumidorFinal = ctx.consumidorFinal === true || ctx.consumidorFinal === "true";
  const isContribuinte = ctx.contribuinteIcms !== false && ctx.contribuinteIcms !== "false";

  let difalApplies = false;
  if (isInterestadual && isConsumidorFinal && !isContribuinte) {
    difalApplies = true;
  }

  const isSimples = ctx.crt === "1" || ctx.crt === "2" || ctx.crt === "4" || ctx.regime === "simples";
  const isRegimeNormal = ctx.crt === "3";
  const isMei = ctx.crt === "4";

  const tipoOperacaoResolved = ctx.tipoOperacao || "desconhecido";
  const isProducaoPropria = tipoOperacaoResolved === "producao_propria";
  const isRevenda = tipoOperacaoResolved === "revenda";

  return {
    phase: "classify_operation",
    isInternal,
    isInterestadual,
    operationType,
    isConsumidorFinal,
    isContribuinte,
    difalApplies,
    isSimples,
    isRegimeNormal,
    isMei,
    tipoOperacao: tipoOperacaoResolved,
    isProducaoPropria,
    isRevenda,
  };
}
