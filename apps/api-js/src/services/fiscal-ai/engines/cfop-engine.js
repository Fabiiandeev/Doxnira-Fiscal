export function cfopEngine(classification, ctx) {
  const { isInternal, operationType, isProducaoPropria, isRevenda } = classification;
  const prefix = isInternal ? "5" : "6";

  let options = [];

  if (operationType === "devolucao") {
    options = [
      {
        codigo: `${prefix}201`,
        descricao: "Devolução de venda de produção do estabelecimento",
        aplicacao: "Produto fabricado pelo emitente — devolução",
        recomendado: isProducaoPropria,
        motivo: `Devolução ${isInternal ? "interna" : "interestadual"} de produção própria`,
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
      {
        codigo: `${prefix}202`,
        descricao: "Devolução de venda de mercadoria adquirida ou recebida de terceiros",
        aplicacao: "Produto de terceiros — devolução",
        recomendado: isRevenda,
        motivo: `Devolução ${isInternal ? "interna" : "interestadual"} de mercadoria de terceiros`,
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
    ];
  } else if (operationType === "complementar") {
    options = [
      {
        codigo: `${prefix}151`,
        descricao: "Venda de produção do estabelecimento, sujeita ao ICMS e à incidência do IPI",
        aplicacao: "Venda complementar de produção própria",
        recomendado: isProducaoPropria,
        motivo: `Venda complementar ${isInternal ? "interna" : "interestadual"} — produção própria`,
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
      {
        codigo: `${prefix}152`,
        descricao: "Venda de mercadoria adquirida ou recebida de terceiros, sujeita ao ICMS e à incidência do IPI",
        aplicacao: "Venda complementar de revenda",
        recomendado: isRevenda,
        motivo: `Venda complementar ${isInternal ? "interna" : "interestadual"} — revenda`,
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
    ];
  } else if (operationType === "exportacao") {
    options = [
      {
        codigo: "7101",
        descricao: "Venda de produção do estabelecimento, efetuada ao exterior",
        aplicacao: "Exportação de produção própria",
        recomendado: isProducaoPropria,
        motivo: "Exportação — produção própria",
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
      {
        codigo: "7102",
        descricao: "Venda de mercadoria adquirida ou recebida de terceiros, efetuada ao exterior",
        aplicacao: "Exportação de revenda",
        recomendado: isRevenda,
        motivo: "Exportação — revenda",
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
    ];
  } else {
    options = [
      {
        codigo: `${prefix}101`,
        descricao: "Venda de produção do estabelecimento",
        aplicacao: "Produto fabricado/industrializado pelo emitente",
        recomendado: isProducaoPropria,
        motivo: `Operação ${isInternal ? "interna" : "interestadual"} — venda de produção própria`,
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
      {
        codigo: `${prefix}102`,
        descricao: "Venda de mercadoria adquirida ou recebida de terceiros",
        aplicacao: "Produto adquirido para revenda",
        recomendado: isRevenda,
        motivo: `Operação ${isInternal ? "interna" : "interestadual"} — venda de mercadoria de terceiros`,
        fonte: "Tabela CFOP — Ajuste SINIEF 05/2019",
      },
    ];
  }

  const selectedCfop = ctx.selectedCfop && options.some(o => o.codigo === ctx.selectedCfop)
    ? ctx.selectedCfop
    : (options.find(o => o.recomendado) || options[0])?.codigo || null;

  const selected = options.find(o => o.codigo === selectedCfop) || null;

  return {
    phase: "determine_cfop",
    cfopOptions: options,
    selectedCfop,
    selectedCfopInfo: selected,
    justificativa: selected?.motivo || "",
    fonte: selected?.fonte || "Tabela CFOP — Ajuste SINIEF 05/2019",
  };
}
