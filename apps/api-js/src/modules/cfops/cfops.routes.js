import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";

export const cfopsRouter = Router();

function normalizeOperationType(value) {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  if (text === "0" || text === "entrada") return "0";
  if (text === "1" || text === "saida" || text === "saída") return "1";
  return text;
}

function normalizeDestinationType(value) {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  if (["interna", "interno", "estadual"].includes(text)) return "interna";
  if (["interestadual", "inter estadual"].includes(text)) return "interestadual";
  if (["exterior", "exportacao", "exportação"].includes(text)) return "exterior";
  return text;
}

function operationTypeFromCode(code) {
  const first = String(code || "")[0];
  if (["1", "2", "3"].includes(first)) return "0";
  if (["5", "6", "7"].includes(first)) return "1";
  return null;
}

function destinationTypeFromCode(code) {
  const first = String(code || "")[0];
  if (["1", "5"].includes(first)) return "interna";
  if (["2", "6"].includes(first)) return "interestadual";
  if (["3", "7"].includes(first)) return "exterior";
  return null;
}

function mapCfop(cfop) {
  if (!cfop) return null;
  return {
    id: cfop.id,
    cfop: cfop.codigo,
    code: cfop.codigo,
    description: cfop.descricao,
    operationNature: cfop.operationNature || cfop.descricao,
    operationType: cfop.operationType || operationTypeFromCode(cfop.codigo),
    destinationType: cfop.destinationType || destinationTypeFromCode(cfop.codigo),
    defaultAdditionalInfo: cfop.defaultAdditionalInfo || cfop.observacoes || null,
    fiscalRules: cfop.fiscalRules || null,
    isActive: cfop.ativo,
    tipo: cfop.tipo,
    operacao: cfop.operacao,
  };
}

async function searchCfops(request) {
  const { q, tipo, operationType, destinationType } = request.query;
  const where = { ativo: true };
  const andFilters = [];
  const term = String(q || "").trim();
  if (term) {
    where.OR = [
      { codigo: { contains: term.replace(/\D/g, "") || term } },
      { descricao: { contains: term, mode: "insensitive" } },
      { operacao: { contains: term, mode: "insensitive" } },
      { operationNature: { contains: term, mode: "insensitive" } },
      { defaultAdditionalInfo: { contains: term, mode: "insensitive" } },
    ];
  }

  const normalizedOperationType = normalizeOperationType(operationType || tipo);
  if (normalizedOperationType === "0") {
    andFilters.push({
      OR: [
        { operationType: "0" },
        { tipo: { equals: "entrada", mode: "insensitive" } },
        { codigo: { startsWith: "1" } },
        { codigo: { startsWith: "2" } },
        { codigo: { startsWith: "3" } },
      ],
    });
  } else if (normalizedOperationType === "1") {
    andFilters.push({
      OR: [
        { operationType: "1" },
        { tipo: { equals: "saida", mode: "insensitive" } },
        { tipo: { equals: "saída", mode: "insensitive" } },
        { codigo: { startsWith: "5" } },
        { codigo: { startsWith: "6" } },
        { codigo: { startsWith: "7" } },
      ],
    });
  } else if (tipo) {
    where.tipo = String(tipo);
  }

  const normalizedDestinationType = normalizeDestinationType(destinationType);
  if (normalizedDestinationType) where.destinationType = normalizedDestinationType;
  if (andFilters.length) where.AND = andFilters;

  const cfops = await prisma.cfop.findMany({
    where,
    orderBy: { codigo: "asc" },
    take: Math.min(Math.max(Number(request.query.limit || 50), 1), 100),
  });
  return cfops.map(mapCfop);
}

cfopsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    sendSuccess(response, { data: await searchCfops(request) });
  }),
);

cfopsRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    sendSuccess(response, { data: await searchCfops(request) });
  }),
);

cfopsRouter.get(
  "/:codigo",
  asyncHandler(async (request, response) => {
    const cfop = await prisma.cfop.findUnique({
      where: { codigo: request.params.codigo },
    });
    if (!cfop) {
      return sendSuccess(response, { data: null });
    }
    sendSuccess(response, { data: mapCfop(cfop) });
  }),
);
