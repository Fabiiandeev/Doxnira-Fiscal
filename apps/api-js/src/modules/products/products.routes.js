import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { analyzeNcm } from "./ncm-analysis.service.js";
import { simulateTaxDecision } from "../../services/fiscal-ai/simulate-tax-decision.js";
import { loadCompanyFiscalConfig } from "../../services/company-fiscal-config.service.js";

export const productsRouter = Router();
export const productsStandaloneRouter = Router();

const companySelect = {
  id: true,
  ownerId: true,
  legalName: true,
  tradeName: true,
  cnpj: true,
  stateRegistration: true,
  stateRegistrationStatus: true,
  stateRegistrationSource: true,
  stateRegistrationFormatted: true,
  icmsContributorStatus: true,
  uf: true,
  city: true,
  taxRegime: true,
  status: true,
  environment: true,
  nfeLastNsu: true,
  nfeMaxNsu: true,
  nfeNextAllowedSyncAt: true,
  lastSyncAt: true,
};

async function resolveProductCompany(request, _response, next) {
  if (request.company) {
    next();
    return;
  }

  const requestedCompanyId = request.query.companyId || request.get("x-company-id") || null;
  let company = null;
  if (requestedCompanyId) {
    company = await prisma.company.findFirst({
      where: {
        id: String(requestedCompanyId),
        ownerId: request.user.id,
        status: { not: "deleted" },
      },
      select: companySelect,
    });
  }

  if (!company) {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId: request.user.id },
      select: { defaultCompanyId: true },
    });
    if (preferences?.defaultCompanyId) {
      company = await prisma.company.findFirst({
        where: {
          id: preferences.defaultCompanyId,
          ownerId: request.user.id,
          status: { not: "deleted" },
        },
        select: companySelect,
      });
    }
  }

  if (!company) {
    company = await prisma.company.findFirst({
      where: { ownerId: request.user.id, status: { not: "deleted" } },
      orderBy: { createdAt: "asc" },
      select: companySelect,
    });
  }

  if (!company) {
    throw new AppError("Nenhuma empresa ativa encontrada para produtos.", "COMPANY_NOT_FOUND", 404);
  }

  request.company = company;
  next();
}

productsStandaloneRouter.use(requireAuth);
productsStandaloneRouter.use(asyncHandler(resolveProductCompany));

const PRISMA_FIELDS = new Set([
  "name", "code", "barcode", "brand", "unit", "weight", "length", "width", "height",
  "ncm", "ncmDescription", "cest", "exTipi", "origemMercadoria", "anp", "tipoItem",
  "grupoTributario", "cstCsosnPadrao", "cfopPreferencial", "icmsPadrao", "icmsStPadrao",
  "mvaPadrao", "ipiPadrao", "pisPadrao", "cofinsPadrao", "issPadrao",
  "beneficioFiscalCod", "beneficioRedBase", "beneficioDiferimento", "beneficioIsencao",
  "obsFiscal", "price", "costPrice", "stock", "stockMin", "stockMax", "active",
  "fiscalAi", "scoreProduto", "historicoJson",
]);

function stripUnknownFields(payload) {
  const clean = {};
  for (const key of Object.keys(payload)) {
    if (PRISMA_FIELDS.has(key)) {
      clean[key] = payload[key];
    }
  }
  return clean;
}

const BLOCKED_FIELDS = new Set([
  "id", "companyId", "createdAt", "updatedAt", "ownerId",
  "company", "items", "nfeItems", "createdBy", "updatedBy",
  "score", "alertas", "pendencias", "historico",
  "descricaoNcm",
]);

function sanitizeProductUpdate(body) {
  const normalized = normalizePayload(body);
  for (const field of Object.keys(normalized)) {
    if (BLOCKED_FIELDS.has(field)) {
      delete normalized[field];
    }
  }
  return normalized;
}

const toNullIfEmpty = (v) => (v === "" || v === undefined ? null : v);
const toDecimal = (v) => (v === "" || v === undefined || v === null ? null : Number(v));

function normalizePayload(body) {
  const raw = stripUnknownFields(body);
  const result = {};

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value === "") {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }

  if ("ncm" in result) result.ncm = toNullIfEmpty(result.ncm);
  if ("cest" in result) result.cest = toNullIfEmpty(result.cest);
  if ("barcode" in result) result.barcode = toNullIfEmpty(result.barcode);
  if ("brand" in result) result.brand = toNullIfEmpty(result.brand);
  if ("ncmDescription" in result) result.ncmDescription = toNullIfEmpty(result.ncmDescription);
  if ("exTipi" in result) result.exTipi = toNullIfEmpty(result.exTipi);
  if ("anp" in result) result.anp = toNullIfEmpty(result.anp);
  if ("grupoTributario" in result) result.grupoTributario = toNullIfEmpty(result.grupoTributario);
  if ("cstCsosnPadrao" in result) result.cstCsosnPadrao = toNullIfEmpty(result.cstCsosnPadrao);
  if ("cfopPreferencial" in result) result.cfopPreferencial = toNullIfEmpty(result.cfopPreferencial);
  if ("beneficioFiscalCod" in result) result.beneficioFiscalCod = toNullIfEmpty(result.beneficioFiscalCod);
  if ("obsFiscal" in result) result.obsFiscal = toNullIfEmpty(result.obsFiscal);

  if ("origemMercadoria" in result) {
    const v = result.origemMercadoria;
    result.origemMercadoria = (v === "" || v === null || v === undefined) ? null : Number(v);
  }
  if ("tipoItem" in result) {
    const v = result.tipoItem;
    result.tipoItem = (v === "" || v === null || v === undefined) ? null : Number(v);
  }

  if ("weight" in result) result.weight = toDecimal(result.weight);
  if ("length" in result) result.length = toDecimal(result.length);
  if ("width" in result) result.width = toDecimal(result.width);
  if ("height" in result) result.height = toDecimal(result.height);
  if ("icmsPadrao" in result) result.icmsPadrao = toDecimal(result.icmsPadrao);
  if ("icmsStPadrao" in result) result.icmsStPadrao = toDecimal(result.icmsStPadrao);
  if ("mvaPadrao" in result) result.mvaPadrao = toDecimal(result.mvaPadrao);
  if ("ipiPadrao" in result) result.ipiPadrao = toDecimal(result.ipiPadrao);
  if ("pisPadrao" in result) result.pisPadrao = toDecimal(result.pisPadrao);
  if ("cofinsPadrao" in result) result.cofinsPadrao = toDecimal(result.cofinsPadrao);
  if ("issPadrao" in result) result.issPadrao = toDecimal(result.issPadrao);
  if ("beneficioRedBase" in result) result.beneficioRedBase = toDecimal(result.beneficioRedBase);
  if ("price" in result) result.price = result.price != null && result.price !== "" ? Number(result.price) : 0;
  if ("costPrice" in result) result.costPrice = toDecimal(result.costPrice);
  if ("stock" in result) result.stock = result.stock != null && result.stock !== "" ? Number(result.stock) : 0;
  if ("stockMin" in result) result.stockMin = result.stockMin != null ? Number(result.stockMin) : null;
  if ("stockMax" in result) result.stockMax = result.stockMax != null ? Number(result.stockMax) : null;
  if ("scoreProduto" in result) result.scoreProduto = result.scoreProduto != null ? Number(result.scoreProduto) : null;

  if ("beneficioDiferimento" in result) result.beneficioDiferimento = result.beneficioDiferimento === true || result.beneficioDiferimento === "true";
  if ("beneficioIsencao" in result) result.beneficioIsencao = result.beneficioIsencao === true || result.beneficioIsencao === "true";

  return result;
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function productSettings(product) {
  return jsonObject(jsonObject(product.fiscalAi).productSettings);
}

function mergeFiscalAi(product, patch) {
  const current = jsonObject(product.fiscalAi);
  const currentSettings = jsonObject(current.productSettings);
  const nextSettings = jsonObject(patch.productSettings);
  return {
    ...current,
    ...patch,
    productSettings: {
      ...currentSettings,
      ...nextSettings,
    },
  };
}

function makeProductIssue({
  field,
  title,
  explanation,
  impact,
  rule,
  correction,
  severity = "warning",
  confidence = "MEDIA",
  safeAutoFix = false,
  accountant = false,
}) {
  return {
    id: `${severity}_${field}_${rule}`.toUpperCase().replace(/[^A-Z0-9_]+/g, "_"),
    campo: field,
    titulo: title,
    explicacao: explanation,
    impacto: impact,
    regraUtilizada: rule,
    correcaoSugerida: correction,
    confianca: confidence,
    severidade: severity,
    tipo: severity === "error" ? "ERRO" : severity === "info" ? "DICA" : "ALERTA",
    safeAutoFix,
    enviarContador: accountant,
    corrigido: false,
    acoes: [
      { label: "Corrigir", acao: "EDITAR_CAMPO" },
      ...(safeAutoFix ? [{ label: "Corrigir automaticamente", acao: "AUTO_FIX" }] : []),
      { label: "Enviar para contador", acao: "ENVIAR_CONTADOR" },
      { label: "Ignorar com justificativa", acao: "IGNORAR" },
    ],
  };
}

function validGtin(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return true;
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const numbers = digits.split("").map(Number);
  const checkDigit = numbers.pop();
  const sum = numbers
    .reverse()
    .reduce((acc, number, index) => acc + number * (index % 2 === 0 ? 3 : 1), 0);
  const calculated = (10 - (sum % 10)) % 10;
  return calculated === checkDigit;
}

function classifyNcm(product) {
  const ncm = String(product.ncm || "").replace(/\D/g, "");
  if (ncm.length !== 8) return null;
  return analyzeNcm(ncm);
}

function buildProductValidation(product) {
  const settings = productSettings(product);
  const marketplace = jsonObject(settings.marketplace);
  const supplier = jsonObject(settings.supplier);
  const ncmAnalysis = classifyNcm(product);
  const issues = [];

  if (!product.name) {
    issues.push(makeProductIssue({
      field: "name",
      title: "Produto sem nome",
      explanation: "A descrição do produto é obrigatória para cadastro, NF-e e SPED.",
      impact: "Bloqueia emissão e escrituração.",
      rule: "PRODUTO_NOME_OBRIGATORIO",
      correction: "Informe a descrição comercial do produto.",
      severity: "error",
    }));
  }
  if (!product.unit) {
    issues.push(makeProductIssue({
      field: "unit",
      title: "Unidade comercial ausente",
      explanation: "A unidade comercial é obrigatória para NF-e/NFC-e.",
      impact: "Pode bloquear itens na emissão.",
      rule: "UNIDADE_COMERCIAL_OBRIGATORIA",
      correction: "Preencha a unidade. Use UN somente quando aplicável.",
      severity: "error",
      safeAutoFix: true,
    }));
  }
  if (!product.ncm) {
    issues.push(makeProductIssue({
      field: "ncm",
      title: "Produto sem NCM",
      explanation: "NCM é obrigatório para emissão fiscal e apuração.",
      impact: "Bloqueia NF-e e SPED.",
      rule: "NCM_OBRIGATORIO",
      correction: "Classifique o produto e confirme o NCM com responsável fiscal.",
      severity: "error",
      accountant: true,
    }));
  } else if (!ncmAnalysis?.valid) {
    issues.push(makeProductIssue({
      field: "ncm",
      title: "NCM inválido",
      explanation: "O NCM deve conter 8 dígitos numéricos.",
      impact: "Bloqueia emissão e validação fiscal.",
      rule: "NCM_FORMATO_INVALIDO",
      correction: "Remova pontos e confirme os 8 dígitos.",
      severity: "error",
      safeAutoFix: true,
      accountant: true,
    }));
  }
  if (ncmAnalysis?.classification?.cestObrigatorio && !product.cest) {
    issues.push(makeProductIssue({
      field: "cest",
      title: "CEST ausente",
      explanation: "O NCM informado pode exigir CEST.",
      impact: "Pode gerar rejeição ou classificação incorreta de ST.",
      rule: "CEST_OBRIGATORIO_POR_NCM",
      correction: "Confirme o CEST aplicável ao produto.",
      severity: "warning",
      accountant: true,
    }));
  }
  if (product.origemMercadoria == null) {
    issues.push(makeProductIssue({
      field: "origemMercadoria",
      title: "Origem da mercadoria ausente",
      explanation: "A origem é obrigatória para ICMS.",
      impact: "Pode bloquear NF-e e classificação de CST/CSOSN.",
      rule: "ORIGEM_MERCADORIA_OBRIGATORIA",
      correction: "Informe a origem da mercadoria.",
      severity: "error",
      accountant: true,
    }));
  }
  if (!product.cfopPreferencial) {
    issues.push(makeProductIssue({
      field: "cfopPreferencial",
      title: "CFOP padrão ausente",
      explanation: "Um CFOP preferencial ajuda a evitar erros na emissão.",
      impact: "Exige revisão manual em cada venda.",
      rule: "CFOP_PADRAO_RECOMENDADO",
      correction: "Configure CFOP interno/interestadual conforme operação.",
      severity: "warning",
      accountant: true,
    }));
  }
  if (!product.cstCsosnPadrao) {
    issues.push(makeProductIssue({
      field: "cstCsosnPadrao",
      title: "CST/CSOSN ausente",
      explanation: "CST ou CSOSN é necessário conforme o regime da empresa.",
      impact: "Bloqueia SPED e pode bloquear emissão.",
      rule: "CST_CSOSN_OBRIGATORIO",
      correction: "Defina CST/CSOSN padrão com confirmação fiscal.",
      severity: "error",
      accountant: true,
    }));
  }
  if (product.pisPadrao == null || product.cofinsPadrao == null) {
    issues.push(makeProductIssue({
      field: "pisCofins",
      title: "PIS/COFINS pendente",
      explanation: "PIS e COFINS devem estar definidos ou calculáveis por regra fiscal.",
      impact: "Pode bloquear apuração e SPED.",
      rule: "PIS_COFINS_RECOMENDADO",
      correction: "Configure alíquotas ou regra fiscal aplicável.",
      severity: "warning",
      accountant: true,
    }));
  }
  if (Number(product.price || 0) <= 0) {
    issues.push(makeProductIssue({
      field: "price",
      title: "Preço de venda zerado",
      explanation: "O preço de venda precisa ser maior que zero para uso comercial.",
      impact: "Impede venda e precificação.",
      rule: "PRECO_VENDA_OBRIGATORIO",
      correction: "Informe o preço de venda.",
      severity: "error",
    }));
  }
  if (product.costPrice == null) {
    issues.push(makeProductIssue({
      field: "costPrice",
      title: "Custo não informado",
      explanation: "O custo é recomendado para cálculo de margem.",
      impact: "Precificação e margem ficam incompletas.",
      rule: "CUSTO_RECOMENDADO",
      correction: "Informe custo de compra ou custo médio.",
      severity: "warning",
    }));
  } else if (Number(product.price || 0) < Number(product.costPrice || 0)) {
    issues.push(makeProductIssue({
      field: "price",
      title: "Preço abaixo do custo",
      explanation: "A margem está negativa.",
      impact: "Pode causar prejuízo na venda.",
      rule: "MARGEM_NEGATIVA",
      correction: "Recalcule preço ideal ou confirme venda estratégica.",
      severity: "warning",
    }));
  }
  if (Number(product.stock || 0) < 0) {
    issues.push(makeProductIssue({
      field: "stock",
      title: "Estoque negativo",
      explanation: "Saldo negativo exige conciliação.",
      impact: "Pode afetar disponibilidade e marketplace.",
      rule: "ESTOQUE_NEGATIVO",
      correction: "Ajuste saldo ou processe entradas pendentes.",
      severity: "warning",
    }));
  }
  if (product.stockMin != null && product.stockMax != null && product.stockMin > product.stockMax) {
    issues.push(makeProductIssue({
      field: "stockMin",
      title: "Estoque mínimo maior que máximo",
      explanation: "A faixa de estoque está inconsistente.",
      impact: "Alertas de reposição podem ficar incorretos.",
      rule: "ESTOQUE_FAIXA_INVALIDA",
      correction: "Configure mínimo menor que máximo.",
      severity: "warning",
    }));
  }
  if (product.barcode && !validGtin(product.barcode)) {
    issues.push(makeProductIssue({
      field: "barcode",
      title: "GTIN inválido",
      explanation: "O dígito verificador do EAN/GTIN não confere.",
      impact: "Pode gerar rejeição em NF-e quando GTIN for obrigatório.",
      rule: "GTIN_INVALIDO",
      correction: "Confirme o código de barras do fabricante.",
      severity: "warning",
      safeAutoFix: true,
    }));
  }
  if (marketplace.enabled && !marketplace.sku) {
    issues.push(makeProductIssue({
      field: "marketplace.sku",
      title: "Marketplace sem SKU",
      explanation: "Produtos sincronizados precisam de SKU por canal.",
      impact: "Bloqueia sincronização de estoque/preço.",
      rule: "MARKETPLACE_SKU_OBRIGATORIO",
      correction: "Vincule o SKU do anúncio.",
      severity: "warning",
    }));
  }
  if (supplier.fromXml && !supplier.code) {
    issues.push(makeProductIssue({
      field: "supplier.code",
      title: "Produto XML sem vínculo interno",
      explanation: "Entradas por XML devem estar vinculadas ao produto interno.",
      impact: "Pode bloquear entrada automática de estoque.",
      rule: "VINCULO_FORNECEDOR_XML",
      correction: "Vincule o código do fornecedor ao cadastro interno.",
      severity: "warning",
    }));
  }

  const pendencias = issues.filter((issue) => issue.severidade === "error");
  const alertas = issues.filter((issue) => issue.severidade === "warning");
  const dicas = issues.filter((issue) => issue.severidade === "info");
  const scoreDetalhes = {
    dadosBasicos: product.name && product.unit ? 100 : product.name || product.unit ? 50 : 0,
    dadosFiscais: Math.max(0, 100 - [
      product.ncm,
      product.origemMercadoria != null,
      product.cfopPreferencial,
      product.cstCsosnPadrao,
    ].filter((ok) => !ok).length * 25),
    tributacao: Math.max(0, 100 - [
      product.cstCsosnPadrao,
      product.pisPadrao != null,
      product.cofinsPadrao != null,
    ].filter((ok) => !ok).length * 30),
    estoque: product.stockMin != null && product.stockMax != null && product.stockMin > product.stockMax ? 50 : 100,
    precificacao: Number(product.price || 0) > 0 ? product.costPrice == null ? 70 : Number(product.price) >= Number(product.costPrice) ? 100 : 60 : 0,
    marketplace: marketplace.enabled ? marketplace.sku ? 100 : 50 : 100,
  };
  const scoreCadastro = Math.round(Object.values(scoreDetalhes).reduce((sum, value) => sum + value, 0) / Object.values(scoreDetalhes).length);
  const status = pendencias.length > 0
    ? "blocked"
    : alertas.length > 0
      ? "attention"
      : "complete";

  return {
    success: true,
    status,
    scoreCadastro,
    scoreDetalhes,
    pendencias,
    alertas,
    dicas,
    sugestoesCorrecao: issues.map((issue) => issue.correcaoSugerida).filter(Boolean),
    podeEmitirNfe: pendencias.length === 0 && Boolean(product.ncm),
    prontoSped: pendencias.length === 0 && Boolean(product.cstCsosnPadrao),
    prontoMarketplace: !marketplace.enabled || Boolean(marketplace.sku),
    validationSource: "VALIDACAO_LOCAL_PRODUTO",
    ncmAnalysis: ncmAnalysis || null,
  };
}

function suggestionFromName(product) {
  const text = `${product.name || ""} ${product.brand || ""} ${product.ncmDescription || ""}`.toLowerCase();
  if (text.includes("notebook") || text.includes("computador")) return "84713012";
  if (text.includes("telefone") || text.includes("celular")) return "85171290";
  if (text.includes("pneu")) return "40111000";
  if (text.includes("cerveja")) return "22030000";
  if (text.includes("camiseta") || text.includes("algodão")) return "61102000";
  if (text.includes("caixa") || text.includes("papel")) return "48191000";
  return null;
}

const optionalStr = z.string().optional();
const nullableStr = z.string().nullable().optional();
const optionalNum = z.coerce.number().min(0).optional();
const optionalInt = z.coerce.number().int().min(0).optional();

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  code: z.string().optional(),
  barcode: optionalStr,
  brand: optionalStr,
  unit: optionalStr,
  weight: optionalNum,
  length: optionalNum,
  width: optionalNum,
  height: optionalNum,
  ncm: optionalStr,
  ncmDescription: optionalStr,
  cest: optionalStr,
  exTipi: optionalStr,
  origemMercadoria: z.union([z.coerce.number().int().min(0).max(8), z.null()]).optional(),
  anp: optionalStr,
  tipoItem: z.union([z.coerce.number().int().min(0).max(99), z.null()]).optional(),
  grupoTributario: optionalStr,
  cstCsosnPadrao: optionalStr,
  cfopPreferencial: optionalStr,
  icmsPadrao: optionalNum,
  icmsStPadrao: optionalNum,
  mvaPadrao: optionalNum,
  ipiPadrao: optionalNum,
  pisPadrao: optionalNum,
  cofinsPadrao: optionalNum,
  issPadrao: optionalNum,
  beneficioFiscalCod: optionalStr,
  beneficioRedBase: optionalNum,
  beneficioDiferimento: z.boolean().optional(),
  beneficioIsencao: z.boolean().optional(),
  obsFiscal: optionalStr,
  price: optionalNum,
  costPrice: optionalNum,
  stock: optionalInt,
  stockMin: optionalInt,
  stockMax: optionalInt,
  active: z.boolean().optional(),
  fiscalAi: z.record(z.string(), z.unknown()).optional(),
  scoreProduto: optionalInt,
  historicoJson: z.array(z.record(z.string(), z.unknown())).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").optional(),
  code: z.string().min(1, "Código é obrigatório.").optional(),
  barcode: nullableStr,
  brand: nullableStr,
  unit: optionalStr,
  weight: optionalNum.nullable(),
  length: optionalNum.nullable(),
  width: optionalNum.nullable(),
  height: optionalNum.nullable(),
  ncm: nullableStr,
  ncmDescription: nullableStr,
  cest: nullableStr,
  exTipi: nullableStr,
  origemMercadoria: z.coerce.number().int().min(0).max(8).optional().nullable(),
  anp: nullableStr,
  tipoItem: z.coerce.number().int().min(0).max(99).optional().nullable(),
  grupoTributario: nullableStr,
  cstCsosnPadrao: nullableStr,
  cfopPreferencial: nullableStr,
  icmsPadrao: optionalNum.nullable(),
  icmsStPadrao: optionalNum.nullable(),
  mvaPadrao: optionalNum.nullable(),
  ipiPadrao: optionalNum.nullable(),
  pisPadrao: optionalNum.nullable(),
  cofinsPadrao: optionalNum.nullable(),
  issPadrao: optionalNum.nullable(),
  beneficioFiscalCod: nullableStr,
  beneficioRedBase: optionalNum.nullable(),
  beneficioDiferimento: z.boolean().optional().nullable(),
  beneficioIsencao: z.boolean().optional().nullable(),
  obsFiscal: nullableStr,
  price: optionalNum,
  costPrice: optionalNum.nullable(),
  stock: optionalInt,
  stockMin: optionalInt.nullable(),
  stockMax: optionalInt.nullable(),
  active: z.boolean().optional(),
  fiscalAi: z.record(z.string(), z.unknown()).optional().nullable(),
  scoreProduto: optionalInt.nullable(),
  historicoJson: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
});

productsRouter.post(
  "/",
  validate(createSchema),
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const payload = normalizePayload(request.body);

    if (!payload.name || payload.name.trim() === "") {
      throw new AppError("Nome (descrição) do produto é obrigatório.", "MISSING_NAME", 400);
    }

    if (!payload.code || payload.code.trim() === "") {
      const last = await prisma.product.findFirst({
        where: { companyId, code: { not: "" } },
        orderBy: { code: "desc" },
        select: { code: true },
      });
      const nextNum = last ? (parseInt(last.code, 10) || 0) + 1 : 1;
      payload.code = String(nextNum);
    }

    const existing = await prisma.product.findUnique({
      where: { companyId_code: { companyId, code: payload.code } },
    });
    if (existing) {
      throw new AppError("Já existe um produto com esse código.", "DUPLICATE_CODE", 409);
    }

    try {
      const product = await prisma.product.create({
        data: { ...payload, companyId },
      });
      sendSuccess(response, product, 201);
    } catch (err) {
      if (err.code === "P2002") {
        const target = err.meta?.target || [];
        const field = Array.isArray(target) ? target.join(", ") : String(target);
        throw new AppError(`Campo duplicado: ${field}.`, "DUPLICATE_FIELD", 409);
      }

      if (err.name === "PrismaClientValidationError" || /unknown argument/i.test(err.message)) {
        throw new AppError(`Campo inválido no payload: ${err.message}`, "INVALID_FIELD", 400);
      }

      if (err.name === "PrismaClientKnownRequestError") {
        throw new AppError(`Erro de banco: ${err.message}`, err.code || "DB_ERROR", 400);
      }

      if (/invalid value/i.test(err.message) || /type mismatch/i.test(err.message)) {
        throw new AppError(`Tipo inválido: ${err.message}`, "TYPE_MISMATCH", 400);
      }

      logger.error({ err, companyId, code: payload.code }, "Product create failed");
      throw new AppError(
        env.NODE_ENV !== "production" ? `Erro ao criar produto: ${err.message}` : "Erro ao criar produto.",
        "INTERNAL_ERROR",
        500,
      );
    }
  }),
);

productsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const search = request.query.search || request.query.q || "";
    const { active } = request.query;

    const where = { companyId };
    if (active !== undefined) {
      where.active = active === "true";
    }
    if (search) {
      const term = String(search).trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
        { ncm: { contains: term, mode: "insensitive" } },
        { barcode: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { grupoTributario: { contains: term, mode: "insensitive" } },
        { cfopPreferencial: { contains: term, mode: "insensitive" } },
      ];
    }

    const items = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
    });
    sendSuccess(response, { data: items });
  }),
);

productsRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const search = String(request.query.q || request.query.search || "").trim();
    const where = { companyId, active: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { ncm: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { grupoTributario: { contains: search, mode: "insensitive" } },
        { cfopPreferencial: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      take: Math.min(Math.max(Number(request.query.limit || 25), 1), 100),
    });
    sendSuccess(response, { data: items });
  }),
);

productsRouter.post(
  "/validar-fiscal",
  asyncHandler(async (request, response) => {
    const draft = {
      ...normalizePayload(request.body || {}),
      companyId: request.company.id,
      active: true,
      price: request.body?.price == null ? 0 : Number(request.body.price),
      stock: request.body?.stock == null ? 0 : Number(request.body.stock),
    };
    sendSuccess(response, buildProductValidation(draft));
  }),
);

const NCM_TABLE = [
  { ncm: "39100030", descricao: "Silicones em formas primárias", capitulo: "39", cestObrigatorio: false, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "39269090", descricao: "Outros artefatos de plástico", capitulo: "39", cestObrigatorio: false, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "84713012", descricao: "Máquinas para processamento de dados - Portáteis", capitulo: "84", cestObrigatorio: true, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "85171290", descricao: "Outros telefones para redes celulares", capitulo: "85", cestObrigatorio: true, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "87089990", descricao: "Outras partes e acessórios de veículos automóveis", capitulo: "87", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "22030000", descricao: "Cervejas de malte", capitulo: "22", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: true, aliquotaInterestadual: null },
  { ncm: "24022000", descricao: "Cigarros contendo tabaco", capitulo: "24", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: true, aliquotaInterestadual: null },
  { ncm: "27101259", descricao: "Outras gasolinas", capitulo: "27", cestObrigatorio: true, st: false, monofasico: true, ipi: true, fcp: true, aliquotaInterestadual: null },
  { ncm: "27111910", descricao: "Gás natural, liquefeito (GNL)", capitulo: "27", cestObrigatorio: false, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "30049099", descricao: "Outros medicamentos para uso humano", capitulo: "30", cestObrigatorio: false, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "34011190", descricao: "Outros sabões e detergentes", capitulo: "34", cestObrigatorio: true, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "40111000", descricao: "Pneus novos de borracha, para automóveis", capitulo: "40", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "48191000", descricao: "Caixas de papel ou cartão ondulado", capitulo: "48", cestObrigatorio: false, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "48201090", descricao: "Outros papéis de uso sanitário ou doméstico", capitulo: "48", cestObrigatorio: true, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "61102000", descricao: "Camisetas de algodão", capitulo: "61", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "84715010", descricao: "Unidades de processamento digitais (gabinetes)", capitulo: "84", cestObrigatorio: true, st: false, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "85287290", descricao: "Outros aparelhos receptores de televisão", capitulo: "85", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: 12 },
  { ncm: "94035090", descricao: "Outros móveis de madeira para quarto", capitulo: "94", cestObrigatorio: true, st: true, monofasico: false, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "21069050", descricao: "Preparações para dietas especiais (suplementos)", capitulo: "21", cestObrigatorio: false, st: false, monofasico: true, ipi: true, fcp: false, aliquotaInterestadual: null },
  { ncm: "02023000", descricao: "Carnes de bovino, congeladas", capitulo: "02", cestObrigatorio: false, st: false, monofasico: false, ipi: false, fcp: false, aliquotaInterestadual: 12 },
];

productsRouter.get(
  "/ncm/:ncm",
  asyncHandler(async (request, response) => {
    const ncm = String(request.params.ncm).replace(/\D/g, "");
    if (ncm.length !== 8) {
      throw new AppError("NCM deve conter 8 dígitos.", "INVALID_NCM", 400);
    }
    const analysis = analyzeNcm(ncm);
    sendSuccess(response, analysis.ncmLookup);
  }),
);

productsRouter.get(
  "/ncm/:ncm/analysis",
  asyncHandler(async (request, response) => {
    const ncm = String(request.params.ncm).replace(/\D/g, "");
    if (ncm.length !== 8) {
      throw new AppError("NCM deve conter 8 dígitos.", "INVALID_NCM", 400);
    }
    const analysis = analyzeNcm(ncm);
    if (!analysis.valid) {
      throw new AppError(analysis.error, "INVALID_NCM", 400);
    }
    sendSuccess(response, analysis);
  }),
);

productsRouter.get(
  "/next-code",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const last = await prisma.product.findFirst({
      where: { companyId, code: { not: "" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const nextNum = last ? (parseInt(last.code, 10) || 0) + 1 : 1;
    sendSuccess(response, { nextCode: String(nextNum) });
  }),
);

productsRouter.post(
  "/ncm/:ncm/simulate",
  asyncHandler(async (request, response) => {
    const ncm = String(request.params.ncm).replace(/\D/g, "");
    if (ncm.length !== 8) {
      throw new AppError("NCM deve conter 8 dígitos.", "INVALID_NCM", 400);
    }

    const analysis = analyzeNcm(ncm);
    if (!analysis.valid) {
      throw new AppError(analysis.error, "INVALID_NCM", 400);
    }

    const {
      ufOrigem,
      ufDestino,
      crt,
      regime,
      tipoOperacao,
      consumidorFinal,
      contribuinteIcms,
      finalidade,
      valorProduto,
      frete,
      seguro,
      desconto,
      selectedCfop,
    } = request.body;

    const UF_VALID = /^(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/;
    if (!UF_VALID.test(ufOrigem)) {
      throw new AppError("ufOrigem inválida.", "INVALID_UF", 400);
    }
    if (!UF_VALID.test(ufDestino)) {
      throw new AppError("ufDestino inválida.", "INVALID_UF", 400);
    }
    if (valorProduto == null || Number(valorProduto) <= 0) {
      throw new AppError("valorProduto deve ser maior que zero.", "INVALID_VALUE", 400);
    }

    const fiscalConfig = await loadCompanyFiscalConfig(request.company.id);

    const result = simulateTaxDecision({
      ncm,
      ncmEntry: analysis.ncmLookup,
      ufOrigem,
      ufDestino,
      crt: crt || "3",
      regime: regime || "presumido",
      tipoOperacao: tipoOperacao || "desconhecido",
      consumidorFinal: consumidorFinal === true || consumidorFinal === "true",
      contribuinteIcms: contribuinteIcms !== false && contribuinteIcms !== "false",
      finalidade: finalidade || "normal",
      valorProduto,
      frete: frete || 0,
      seguro: seguro || 0,
      desconto: desconto || 0,
      selectedCfop: selectedCfop || undefined,
      mode: "SIMULATION",
      fiscalConfig,
    });

    sendSuccess(response, result);
  }),
);

productsRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findUnique({
      where: { id: request.params.id },
    });
    if (!product || product.companyId !== request.company.id) {
      throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    }
    sendSuccess(response, product);
  }),
);

productsRouter.put(
  "/:id",
  validate(updateSchema),
  asyncHandler(async (request, response) => {
    const productId = request.params.id;
    const companyId = request.company.id;

    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!existing) {
      throw new AppError("Produto não encontrado nesta empresa.", "PRODUCT_NOT_FOUND", 404);
    }

    const data = sanitizeProductUpdate(request.body);

    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.product.findFirst({
        where: { companyId, code: data.code, id: { not: productId } },
      });
      if (duplicate) {
        throw new AppError("Já existe outro produto com este código.", "DUPLICATE_PRODUCT_CODE", 409);
      }
    }

    try {
      const updated = await prisma.product.update({
        where: { id: productId },
        data,
      });
      sendSuccess(response, updated);
    } catch (error) {
      if (error?.code === "P2002") {
        const field = Array.isArray(error.meta?.target) ? error.meta.target.join(".") : String(error.meta?.target ?? "");
        throw new AppError(`Produto duplicado: ${field}.`, "DUPLICATE_PRODUCT", 409);
      }

      if (error?.code === "P2025") {
        throw new AppError("Produto não encontrado para atualização.", "PRODUCT_NOT_FOUND", 404);
      }

      if (error?.message?.includes("Unknown argument")) {
        throw new AppError(`Campo inválido no payload: ${error.message}`, "INVALID_PRODUCT_FIELD", 400);
      }

      if (error?.name === "PrismaClientValidationError") {
        throw new AppError(`Validação Prisma: ${error.message}`, "VALIDATION_ERROR", 400);
      }

      if (error?.name === "PrismaClientKnownRequestError") {
        throw new AppError(`Erro de banco: ${error.message}`, error.code || "DB_ERROR", 400);
      }

      if (/invalid value/i.test(error?.message) || /type mismatch/i.test(error?.message)) {
        throw new AppError(`Tipo inválido: ${error.message}`, "TYPE_MISMATCH", 400);
      }

      logger.error({ error, id: productId }, "Product update failed");

      if (env.NODE_ENV === "production") {
        throw new AppError("Erro ao atualizar produto.", "UPDATE_PRODUCT_FAILED", 500);
      }

      response.status(500).json({
        code: "UPDATE_PRODUCT_FAILED",
        message: error?.message,
        details: {
          name: error?.name,
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack,
        },
      });
      return;
    }
  }),
);

productsRouter.patch(
  "/:id",
  validate(updateSchema),
  asyncHandler(async (request, response) => {
    const productId = request.params.id;
    const companyId = request.company.id;

    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!existing) {
      throw new AppError("Produto não encontrado nesta empresa.", "PRODUCT_NOT_FOUND", 404);
    }

    const data = sanitizeProductUpdate(request.body);
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.product.findFirst({
        where: { companyId, code: data.code, id: { not: productId } },
      });
      if (duplicate) {
        throw new AppError("Já existe outro produto com este código.", "DUPLICATE_PRODUCT_CODE", 409);
      }
    }

    try {
      const updated = await prisma.product.update({ where: { id: productId }, data });
      sendSuccess(response, updated);
    } catch (error) {
      if (error?.code === "P2002") {
        const field = Array.isArray(error.meta?.target) ? error.meta.target.join(".") : String(error.meta?.target ?? "");
        throw new AppError(`Produto duplicado: ${field}.`, "DUPLICATE_PRODUCT", 409);
      }
      if (error?.code === "P2025") {
        throw new AppError("Produto não encontrado para atualização.", "PRODUCT_NOT_FOUND", 404);
      }
      if (error?.message?.includes("Unknown argument")) {
        throw new AppError(`Campo inválido no payload: ${error.message}`, "INVALID_PRODUCT_FIELD", 400);
      }
      if (error?.name === "PrismaClientValidationError") {
        throw new AppError(`Validação Prisma: ${error.message}`, "VALIDATION_ERROR", 400);
      }
      logger.error({ error, id: productId }, "Product patch failed");
      throw new AppError(
        env.NODE_ENV !== "production" ? `Erro ao atualizar produto: ${error?.message}` : "Erro ao atualizar produto.",
        "UPDATE_PRODUCT_FAILED",
        500,
      );
    }
  }),
);

productsRouter.post(
  "/:id/validate",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);

    const validation = buildProductValidation(product);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        fiscalAi: mergeFiscalAi(product, { validation }),
        scoreProduto: validation.scoreCadastro,
      },
    });
    sendSuccess(response, { ...validation, product: updated });
  }),
);

productsRouter.post(
  "/:id/auto-fix",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);

    const data = {};
    const corrections = [];
    const setCorrection = (field, value, label) => {
      if (value === undefined || value === product[field]) return;
      data[field] = value;
      corrections.push({ field, label, previous: product[field] ?? null, next: value ?? null });
    };

    if (product.ncm) setCorrection("ncm", String(product.ncm).replace(/\D/g, ""), "Normalizar NCM");
    if (product.cest) setCorrection("cest", String(product.cest).replace(/\D/g, ""), "Normalizar CEST");
    if (product.barcode) setCorrection("barcode", String(product.barcode).replace(/\D/g, ""), "Normalizar EAN/GTIN");
    if (!product.unit) setCorrection("unit", "UN", "Preencher unidade padrão");

    const settings = productSettings(product);
    const price = Number(data.price ?? product.price ?? 0);
    const cost = Number(data.costPrice ?? product.costPrice ?? 0);
    const stock = Number(data.stock ?? product.stock ?? 0);
    const stockReserved = Number(jsonObject(settings.stock).reserved ?? 0);
    const margin = cost > 0 ? Number((((price - cost) / cost) * 100).toFixed(2)) : null;
    const fiscalAi = mergeFiscalAi(product, {
      productSettings: {
        stock: {
          ...jsonObject(settings.stock),
          available: Math.max(0, stock - stockReserved),
        },
        pricing: {
          ...jsonObject(settings.pricing),
          margin,
          netProfit: cost > 0 ? Number((price - cost).toFixed(2)) : null,
        },
      },
    });

    const nextProduct = { ...product, ...data, fiscalAi };
    const validation = buildProductValidation(nextProduct);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        ...data,
        fiscalAi: mergeFiscalAi(nextProduct, { validation }),
        scoreProduto: validation.scoreCadastro,
        historicoJson: [
          ...(Array.isArray(product.historicoJson) ? product.historicoJson : []),
          ...corrections.map((correction) => ({
            quem: "FiscalAI",
            campo: correction.label,
            valorAnterior: correction.previous == null ? null : String(correction.previous),
            valorNovo: correction.next == null ? null : String(correction.next),
            origem: "FISCAL_AI",
            data: new Date().toISOString(),
          })),
        ],
      },
    });

    sendSuccess(response, {
      corrected: corrections.length > 0,
      corrections,
      product: updated,
      validation,
    });
  }),
);

productsRouter.post(
  "/:id/suggest-ncm",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    const current = product.ncm ? String(product.ncm).replace(/\D/g, "") : null;
    const suggested = current?.length === 8 ? current : suggestionFromName(product);
    const analysis = suggested ? analyzeNcm(suggested) : null;
    sendSuccess(response, {
      suggestion: suggested,
      confidence: suggested ? (current ? "ALTA" : "MEDIA") : "BAIXA",
      requiresConfirmation: true,
      source: "BASE_LOCAL_ASSISTIDA",
      analysis,
      message: suggested
        ? "Sugestão gerada. Confirme a classificação fiscal antes de aplicar."
        : "Não foi possível sugerir NCM com segurança a partir dos dados atuais.",
    });
  }),
);

productsRouter.post(
  "/:id/suggest-cest",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    const analysis = classifyNcm(product);
    sendSuccess(response, {
      suggestion: null,
      requiresConfirmation: true,
      source: "CONFIRMACAO_CONTABIL",
      cestObrigatorio: Boolean(analysis?.classification?.cestObrigatorio),
      message: analysis?.classification?.cestObrigatorio
        ? "Este NCM pode exigir CEST. Confirme o CEST aplicável com o contador."
        : "CEST não foi identificado como obrigatório para este NCM na base local.",
    });
  }),
);

productsRouter.post(
  "/:id/apply-fiscal-rule",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);

    const body = request.body || {};
    const analysis = classifyNcm(product);
    const data = sanitizeProductUpdate({
      grupoTributario: body.grupoTributario || product.grupoTributario || (analysis?.ncmLookup?.st ? "Tributado com ST" : "Tributado integralmente"),
      cfopPreferencial: body.cfopPreferencial || product.cfopPreferencial || "5102",
      cstCsosnPadrao: body.cstCsosnPadrao || product.cstCsosnPadrao || "102",
      origemMercadoria: body.origemMercadoria ?? product.origemMercadoria ?? 0,
      pisPadrao: body.pisPadrao ?? product.pisPadrao ?? 0,
      cofinsPadrao: body.cofinsPadrao ?? product.cofinsPadrao ?? 0,
    });
    const updatedDraft = { ...product, ...data };
    const validation = buildProductValidation(updatedDraft);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        ...data,
        fiscalAi: mergeFiscalAi(updatedDraft, {
          validation,
          lastFiscalRuleAppliedAt: new Date().toISOString(),
        }),
        scoreProduto: validation.scoreCadastro,
      },
    });
    sendSuccess(response, { product: updated, validation, requiresConfirmation: true });
  }),
);

productsRouter.get(
  "/:id/stock",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    const stockSettings = jsonObject(productSettings(product).stock);
    const reserved = Number(stockSettings.reserved ?? 0);
    sendSuccess(response, {
      stock: product.stock,
      stockMin: product.stockMin,
      stockMax: product.stockMax,
      critical: product.stockMin != null ? product.stock <= product.stockMin : false,
      available: Math.max(0, Number(product.stock || 0) - reserved),
      committed: reserved,
      settings: stockSettings,
    });
  }),
);

productsRouter.patch(
  "/:id/stock-settings",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    const data = sanitizeProductUpdate({
      stock: request.body.stock,
      stockMin: request.body.stockMin,
      stockMax: request.body.stockMax,
    });
    const settings = productSettings(product);
    const stockSettings = {
      ...jsonObject(settings.stock),
      controlsStock: request.body.controlsStock ?? jsonObject(settings.stock).controlsStock ?? true,
      location: request.body.location ?? jsonObject(settings.stock).location ?? null,
      autoEntryByNfe: request.body.autoEntryByNfe ?? jsonObject(settings.stock).autoEntryByNfe ?? true,
      autoExitBySale: request.body.autoExitBySale ?? jsonObject(settings.stock).autoExitBySale ?? true,
      reserved: Number(request.body.reserved ?? jsonObject(settings.stock).reserved ?? 0),
    };
    const draft = { ...product, ...data, fiscalAi: mergeFiscalAi(product, { productSettings: { stock: stockSettings } }) };
    const validation = buildProductValidation(draft);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        ...data,
        fiscalAi: mergeFiscalAi(draft, { validation }),
        scoreProduto: validation.scoreCadastro,
      },
    });
    sendSuccess(response, { product: updated, stock: stockSettings, validation });
  }),
);

productsRouter.patch(
  "/:id/pricing",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    const data = sanitizeProductUpdate({
      price: request.body.price,
      costPrice: request.body.costPrice,
    });
    const price = Number(data.price ?? product.price ?? 0);
    const cost = Number(data.costPrice ?? product.costPrice ?? 0);
    const desiredMargin = Number(request.body.desiredMargin ?? 30);
    const idealPrice = cost > 0 ? Number((cost * (1 + desiredMargin / 100)).toFixed(2)) : price;
    const settings = productSettings(product);
    const pricing = {
      ...jsonObject(settings.pricing),
      desiredMargin,
      freightCost: Number(request.body.freightCost ?? jsonObject(settings.pricing).freightCost ?? 0),
      packagingCost: Number(request.body.packagingCost ?? jsonObject(settings.pricing).packagingCost ?? 0),
      marketplaceCommission: Number(request.body.marketplaceCommission ?? jsonObject(settings.pricing).marketplaceCommission ?? 0),
      idealPrice,
      minimumPrice: cost,
      margin: cost > 0 ? Number((((price - cost) / cost) * 100).toFixed(2)) : null,
      negativeMargin: cost > 0 && price < cost,
    };
    const draft = { ...product, ...data, fiscalAi: mergeFiscalAi(product, { productSettings: { pricing } }) };
    const validation = buildProductValidation(draft);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        ...data,
        fiscalAi: mergeFiscalAi(draft, { validation }),
        scoreProduto: validation.scoreCadastro,
      },
    });
    sendSuccess(response, { product: updated, pricing, validation });
  }),
);

productsRouter.patch(
  "/:id/marketplace",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    const settings = productSettings(product);
    const marketplace = {
      ...jsonObject(settings.marketplace),
      enabled: request.body.enabled ?? jsonObject(settings.marketplace).enabled ?? true,
      sku: request.body.sku ?? jsonObject(settings.marketplace).sku ?? null,
      mercadoLivreSku: request.body.mercadoLivreSku ?? jsonObject(settings.marketplace).mercadoLivreSku ?? null,
      shopeeSku: request.body.shopeeSku ?? jsonObject(settings.marketplace).shopeeSku ?? null,
      title: request.body.title ?? jsonObject(settings.marketplace).title ?? product.name,
      status: request.body.status ?? jsonObject(settings.marketplace).status ?? "preparado",
      syncStock: request.body.syncStock ?? jsonObject(settings.marketplace).syncStock ?? false,
      syncPrice: request.body.syncPrice ?? jsonObject(settings.marketplace).syncPrice ?? false,
      syncListing: request.body.syncListing ?? jsonObject(settings.marketplace).syncListing ?? false,
    };
    const draft = { ...product, fiscalAi: mergeFiscalAi(product, { productSettings: { marketplace } }) };
    const validation = buildProductValidation(draft);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        fiscalAi: mergeFiscalAi(draft, { validation }),
        scoreProduto: validation.scoreCadastro,
      },
    });
    sendSuccess(response, { product: updated, marketplace, validation });
  }),
);

productsRouter.get(
  "/:id/documents",
  asyncHandler(async (request, response) => {
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!product) throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    const clauses = [];
    if (product.code) clauses.push({ productCode: product.code });
    if (product.barcode) clauses.push({ ean: String(product.barcode).replace(/\D/g, "") || product.barcode });
    if (product.ncm) clauses.push({ ncm: String(product.ncm).replace(/\D/g, "") || product.ncm });
    if (product.name) clauses.push({ description: { contains: product.name.slice(0, 80), mode: "insensitive" } });
    if (clauses.length === 0) {
      sendSuccess(response, { data: [], total: 0 });
      return;
    }
    const items = await prisma.fiscalDocumentItem.findMany({
      where: {
        companyId: request.company.id,
        OR: clauses,
      },
      select: {
        id: true,
        itemNumber: true,
        productCode: true,
        ean: true,
        description: true,
        ncm: true,
        cfop: true,
        quantity: true,
        unit: true,
        unitValue: true,
        totalValue: true,
        document: {
          select: {
            id: true,
            documentType: true,
            invoiceNumber: true,
            series: true,
            accessKey: true,
            status: true,
            issuerName: true,
            issuerCnpj: true,
            recipientName: true,
            recipientCnpj: true,
            emissionDate: true,
            totalAmount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    sendSuccess(response, {
      data: items.map((item) => ({
        ...item,
        quantity: item.quantity == null ? null : Number(item.quantity),
        unitValue: item.unitValue == null ? null : Number(item.unitValue),
        totalValue: item.totalValue == null ? null : Number(item.totalValue),
        document: item.document
          ? {
              ...item.document,
              totalAmount: item.document.totalAmount == null ? null : Number(item.document.totalAmount),
            }
          : null,
      })),
      total: items.length,
    });
  }),
);

productsRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const existing = await prisma.product.findUnique({
      where: { id: request.params.id },
    });
    if (!existing || existing.companyId !== request.company.id) {
      throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    }
    await prisma.product.delete({ where: { id: existing.id } });
    sendSuccess(response, { message: "Produto removido com sucesso." });
  }),
);

productsStandaloneRouter.use(productsRouter);
