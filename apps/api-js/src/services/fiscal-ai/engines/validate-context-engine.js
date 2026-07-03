import { TAX_STATUS, makeTaxLine } from "../simulation-types.js";

export function validateContextEngine(ctx) {
  const errors = [];
  const warnings = [];
  const normalizedContext = { ...ctx };

  if (!ctx.ncm || String(ctx.ncm).replace(/\D/g, "").length !== 8) {
    errors.push({ field: "ncm", message: "NCM deve conter 8 dígitos." });
  } else {
    normalizedContext.ncm = String(ctx.ncm).replace(/\D/g, "");
  }

  const UF_VALID = /^(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/;
  if (!UF_VALID.test(ctx.ufOrigem)) {
    errors.push({ field: "ufOrigem", message: "UF origem inválida." });
  }
  if (!UF_VALID.test(ctx.ufDestino)) {
    errors.push({ field: "ufDestino", message: "UF destino inválida." });
  }

  if (!ctx.crt || !["1", "2", "3", "4"].includes(String(ctx.crt))) {
    errors.push({ field: "crt", message: "CRT inválido. Use 1, 2, 3 ou 4." });
  }

  if (ctx.valorProduto == null || Number(ctx.valorProduto) <= 0) {
    errors.push({ field: "valorProduto", message: "Valor do produto deve ser maior que zero." });
  }

  if (!ctx.tipoOperacao) {
    warnings.push({ field: "tipoOperacao", message: "Tipo de operação não informado. CFOP pode não ser o ideal." });
    normalizedContext.tipoOperacao = "desconhecido";
  }

  if (!ctx.regime) {
    normalizedContext.regime = ctx.crt === "3" ? "presumido" : "simples";
  }

  if (ctx.contribuinteIcms == null) {
    normalizedContext.contribuinteIcms = true;
    warnings.push({ field: "contribuinteIcms", message: "Contribuinte ICMS não informado — assumido como Sim." });
  }

  if (!ctx.finalidade) {
    normalizedContext.finalidade = "normal";
  }

  const valid = errors.length === 0;

  return {
    phase: "validate_context",
    valid,
    errors,
    warnings,
    context: normalizedContext,
  };
}
