import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { analyzeNcm } from "./ncm-analysis.service.js";
import { simulateTaxDecision } from "../../services/fiscal-ai/simulate-tax-decision.js";
import { loadCompanyFiscalConfig } from "../../services/company-fiscal-config.service.js";

export const productsRouter = Router();

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
      console.error("CREATE_PRODUCT_ERROR_NAME", err.name);
      console.error("CREATE_PRODUCT_ERROR_MESSAGE", err.message);
      console.error("CREATE_PRODUCT_ERROR_CODE", err.code);
      console.error("CREATE_PRODUCT_ERROR_META", JSON.stringify(err.meta, null, 2));

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
    const { search, active } = request.query;

    const where = { companyId };
    if (active !== undefined) {
      where.active = active === "true";
    }
    if (search) {
      const term = String(search);
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
      console.error("UPDATE_PRODUCT_ERROR", error);

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
