import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import { runNfeValidation } from "../../services/nfe-validation/nfe-validation-engine.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";

export const nfeRouter = Router();

const STATUS_MAP = {
  rascunho: "RASCUNHO",
  "em-validacao": "EM_VALIDACAO",
  em_validacao: "EM_VALIDACAO",
  "em validacao": "EM_VALIDACAO",
  "em validacao": "EM_VALIDACAO",
  "pronta-para-transmissao": "PRONTA_TRANSMISSAO",
  pronta_para_transmissao: "PRONTA_TRANSMISSAO",
  "pronta para transmissao": "PRONTA_TRANSMISSAO",
  transmitindo: "TRANSMITINDO",
  "processando-sefaz": "PROCESSANDO_SEFAZ",
  processando_sefaz: "PROCESSANDO_SEFAZ",
  "processando sefaz": "PROCESSANDO_SEFAZ",
  autorizada: "AUTORIZADA",
  rejeitada: "REJEITADA",
  cancelada: "CANCELADA",
  denegada: "DENEGADA",
  inutilizada: "INUTILIZADA",
};

const SORT_FIELDS = {
  number: "numero",
  numero: "numero",
  series: "serie",
  serie: "serie",
  emissionDate: "dataEmissao",
  dataEmissao: "dataEmissao",
  updatedAt: "updatedAt",
  status: "status",
};

const LOCKED_STATUSES = new Set(["AUTORIZADA", "CANCELADA", "DENEGADA", "INUTILIZADA"]);
const FINALIDADE_CODES = new Set(["1", "2", "3", "4"]);
const TPNF_CODES = new Set(["0", "1"]);
const IND_PRES_CODES = new Set(["0", "1", "2", "3", "4", "5", "9"]);
const IND_FINAL_CODES = new Set(["0", "1"]);

function cleanString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseDateValue(value) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseSmallInt(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value).replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMoney(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeStatus(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return STATUS_MAP[key] || key.toUpperCase();
}

function normalizeEnvironment(value) {
  if (!value) return null;
  const env = String(value).trim().toLowerCase();
  if (env === "production" || env === "producao" || env === "1") return "1";
  if (env === "homologation" || env === "homologacao" || env === "2") return "2";
  return value;
}

function environmentFromCompany(company) {
  return company.environment === "production" ? "1" : "2";
}

function extractCfopCode(value) {
  const code = digits(value).slice(0, 4);
  return code.length === 4 ? code : null;
}

function cfopOperationType(code) {
  const first = String(code || "")[0];
  if (["1", "2", "3"].includes(first)) return "0";
  if (["5", "6", "7"].includes(first)) return "1";
  return null;
}

function cfopDestinationType(code) {
  const first = String(code || "")[0];
  if (["1", "5"].includes(first)) return "interna";
  if (["2", "6"].includes(first)) return "interestadual";
  if (["3", "7"].includes(first)) return "exterior";
  return null;
}

function cfopIdDest(code) {
  const destination = cfopDestinationType(code);
  if (destination === "interna") return "1";
  if (destination === "interestadual") return "2";
  if (destination === "exterior") return "3";
  return null;
}

function isDevolutionCfop(cfop) {
  const text = `${cfop?.descricao || ""} ${cfop?.operacao || ""} ${cfop?.operationNature || ""}`.toLowerCase();
  return text.includes("devolucao") || text.includes("devolu");
}

function mapCfop(cfop) {
  if (!cfop) return null;
  const operationType = cfop.operationType || cfopOperationType(cfop.codigo);
  const destinationType = cfop.destinationType || cfopDestinationType(cfop.codigo);
  return {
    id: cfop.id,
    cfop: cfop.codigo,
    code: cfop.codigo,
    description: cfop.descricao,
    operationNature: cfop.operationNature || cfop.descricao,
    operationType,
    destinationType,
    defaultAdditionalInfo: cfop.defaultAdditionalInfo || cfop.observacoes || null,
    fiscalRules: cfop.fiscalRules || null,
    isActive: cfop.ativo,
    tipo: cfop.tipo,
    operacao: cfop.operacao,
  };
}

function parseDateStart(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildWhere(companyId, query) {
  const where = {
    companyId,
    deletedAt: null,
    modelo: "55",
  };

  const search = String(query.search || "").trim();
  if (search) {
    const onlyDigits = digits(search);
    const number = Number(search);
    where.OR = [
      ...(Number.isFinite(number) && number > 0 ? [{ numero: number }, { serie: number }] : []),
      { chaveAcesso: { contains: onlyDigits || search } },
      { destinatarioNome: { contains: search, mode: "insensitive" } },
      { destinatarioCnpj: { contains: onlyDigits || search } },
      { destinatarioCpf: { contains: onlyDigits || search } },
      { protocolo: { contains: search, mode: "insensitive" } },
      { naturezaOperacao: { contains: search, mode: "insensitive" } },
      { cfop: { contains: onlyDigits || search } },
    ];
  }

  const status = normalizeStatus(query.status);
  if (status) where.status = status;

  const environment = normalizeEnvironment(query.environment);
  if (environment) where.ambiente = environment;

  const startDate = parseDateStart(query.startDate);
  const endDate = parseDateEnd(query.endDate);
  if (startDate || endDate) {
    where.dataEmissao = {};
    if (startDate) where.dataEmissao.gte = startDate;
    if (endDate) where.dataEmissao.lte = endDate;
  }

  if (query.customerId) where.destinatarioId = String(query.customerId);
  if (query.number) where.numero = Number(query.number);
  if (query.series) where.serie = Number(query.series);
  if (query.accessKey) where.chaveAcesso = { contains: digits(query.accessKey) || String(query.accessKey) };
  if (query.uf) where.destinatarioUf = String(query.uf).toUpperCase();
  if (query.operationType) where.tipoOperacao = String(query.operationType);

  if (query.customer) {
    const value = String(query.customer).trim();
    const onlyDigits = digits(value);
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { destinatarioNome: { contains: value, mode: "insensitive" } },
          { destinatarioCnpj: { contains: onlyDigits || value } },
          { destinatarioCpf: { contains: onlyDigits || value } },
        ],
      },
    ];
  }

  if (query.value) {
    const value = parseMoney(query.value, null);
    if (Number.isFinite(value)) {
      where.AND = [
        ...(where.AND || []),
        { totals: { is: { valorTotal: value } } },
      ];
    }
  }

  return where;
}

function toListItem(note) {
  const value = note.totals?.valorTotal ?? 0;
  return {
    id: note.id,
    number: note.numero,
    series: note.serie,
    customerName: note.destinatarioNome,
    customerDocument: note.destinatarioCnpj || note.destinatarioCpf,
    emissionDate: note.dataEmissao,
    value,
    status: note.status,
    environment: note.ambiente,
    protocol: note.protocolo,
    updatedAt: note.updatedAt,
    accessKey: note.chaveAcesso,
    operationType: note.tipoOperacao,
    canTransmit: note.canTransmit,
    message: note.xMotivo,
    cfop: note.cfop,
    operationNature: note.naturezaOperacao,
  };
}

function toEmitter(company, taxSettings = null) {
  return {
    id: company.id,
    legalName: company.legalName,
    tradeName: company.tradeName,
    cnpj: company.cnpj,
    stateRegistration: company.stateRegistration,
    stateRegistrationStatus: company.stateRegistrationStatus,
    municipalRegistration: taxSettings?.municipalRegistration || null,
    cnae: taxSettings?.mainCnae || null,
    crt: taxSettings?.crt || null,
    taxRegime: taxSettings?.taxRegime || company.taxRegime || null,
    uf: company.uf,
    city: company.city,
    environment: company.environment,
  };
}

function buildSummary(notes) {
  const count = (status) => notes.filter((note) => note.status === status).length;
  const authorizedAmount = notes
    .filter((note) => note.status === "AUTORIZADA")
    .reduce((sum, note) => sum + Number(note.totals?.valorTotal || 0), 0);
  const pendingStatuses = new Set(["RASCUNHO", "EM_VALIDACAO", "PRONTA_TRANSMISSAO", "REJEITADA"]);

  return {
    total: notes.length,
    drafts: count("RASCUNHO"),
    validating: count("EM_VALIDACAO"),
    rejected: count("REJEITADA"),
    authorized: count("AUTORIZADA"),
    cancelled: count("CANCELADA"),
    authorizedValue: authorizedAmount,
    pending: notes.filter((note) => pendingStatuses.has(note.status)).length,
  };
}

function assertEditable(note) {
  if (LOCKED_STATUSES.has(note.status)) {
    throw new AppError("Esta NF-e nao pode ser alterada neste status.", "NFE_STATUS_LOCKED", 409);
  }
}

async function findNfeOrThrow(companyId, nfeId, includeItems = false) {
  const note = await prisma.nfeDocument.findFirst({
    where: { id: nfeId, companyId, deletedAt: null, modelo: "55" },
    include: {
      totals: true,
      items: includeItems
        ? { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } }
        : { where: { deletedAt: null }, take: 1 },
      _count: { select: { items: true } },
    },
  });
  if (!note) throw new AppError("NF-e nao encontrada.", "NFE_NOT_FOUND", 404);
  return note;
}

async function loadCompanyEmitter(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { taxSettings: true },
  });
  return company ? toEmitter(company, company.taxSettings) : null;
}

async function getCfopOrThrow(value) {
  const code = extractCfopCode(value);
  if (!code) throw new AppError("CFOP invalido.", "INVALID_CFOP", 400);
  const cfop = await prisma.cfop.findFirst({ where: { codigo: code, ativo: true } });
  if (!cfop) throw new AppError("CFOP nao encontrado ou inativo.", "CFOP_NOT_FOUND", 404);
  return cfop;
}

function validateFiscalCombination({ cfop, tipoOperacao, finalidade, referenceAccessKey, justificativa }) {
  if (tipoOperacao && !TPNF_CODES.has(tipoOperacao)) {
    throw new AppError("Tipo de operacao invalido. Use 0 para entrada ou 1 para saida.", "INVALID_TPNF", 400);
  }
  if (finalidade && !FINALIDADE_CODES.has(finalidade)) {
    throw new AppError("Finalidade invalida. Use 1, 2, 3 ou 4.", "INVALID_FINNFE", 400);
  }

  const expectedOperation = cfop ? (cfop.operationType || cfopOperationType(cfop.codigo)) : null;
  if (cfop && tipoOperacao && expectedOperation && expectedOperation !== tipoOperacao) {
    throw new AppError(
      "CFOP incompatvel com o tipo de operacao informado.",
      "CFOP_TPNF_MISMATCH",
      400,
      [
        {
          field: "cfop",
          message: "CFOP iniciado por 1/2/3 exige entrada (tpNF=0); CFOP iniciado por 5/6/7 exige saida (tpNF=1).",
        },
      ],
    );
  }

  if (finalidade === "4" && cfop && !isDevolutionCfop(cfop)) {
    throw new AppError("Finalidade devolucao exige CFOP de devolucao.", "FINNFE_CFOP_MISMATCH", 400);
  }
  if (finalidade === "2" && !referenceAccessKey) {
    throw new AppError("NF-e complementar exige chave de acesso referenciada.", "FINNFE_REFERENCE_REQUIRED", 400);
  }
  if (finalidade === "3" && !justificativa) {
    throw new AppError("NF-e de ajuste exige justificativa.", "FINNFE_JUSTIFICATION_REQUIRED", 400);
  }
}

async function reserveNumber(tx, { companyId, documentModel = "55", serie = 1, environment = "2", documentType = "NFE" }) {
  const where = {
    companyId_documentModel_serie_environment_documentType: {
      companyId,
      documentModel,
      serie,
      environment,
      documentType,
    },
  };

  const existing = await tx.nfeNumberSequence.findUnique({ where });
  if (existing) {
    const updated = await tx.nfeNumberSequence.update({
      where: { id: existing.id },
      data: { lastNumber: { increment: 1 } },
    });
    return updated.lastNumber;
  }

  const lastNote = await tx.nfeDocument.findFirst({
    where: {
      companyId,
      modelo: documentModel,
      serie,
      ambiente: environment,
      numero: { not: null },
    },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });

  const nextNumber = Number(lastNote?.numero || 0) + 1;
  const sequence = await tx.nfeNumberSequence.create({
    data: {
      companyId,
      documentModel,
      serie,
      environment,
      documentType,
      lastNumber: nextNumber,
    },
  });
  return sequence.lastNumber;
}

async function buildUpdateData(companyId, existing, payload) {
  const data = {};
  const referenceAccessKey = digits(payload.referenceAccessKey || payload.chaveAcessoReferenciada);

  let cfop = null;
  const cfopInput = payload.cfop ?? payload.naturezaOperacao ?? payload.operationNature;
  if (cfopInput !== undefined) {
    cfop = await getCfopOrThrow(cfopInput);
    const mapped = mapCfop(cfop);
    data.cfop = mapped.cfop;
    data.naturezaOperacao = cleanString(payload.operationNature) || mapped.operationNature;
    data.tipoOperacao = cleanString(payload.tipoOperacao ?? payload.tpNF) || mapped.operationType;
    data.idDest = cfopIdDest(mapped.cfop);
    if (payload.additionalInfo === undefined && mapped.defaultAdditionalInfo) {
      data.additionalInfo = mapped.defaultAdditionalInfo;
    }
  }

  if (payload.naturezaOperacao !== undefined && !cfop) data.naturezaOperacao = cleanString(payload.naturezaOperacao);
  if (payload.operationNature !== undefined && !cfop) data.naturezaOperacao = cleanString(payload.operationNature);
  if (payload.tipoOperacao !== undefined || payload.tpNF !== undefined) data.tipoOperacao = cleanString(payload.tipoOperacao ?? payload.tpNF);
  if (payload.finalidade !== undefined || payload.finNFe !== undefined) data.finalidade = cleanString(payload.finalidade ?? payload.finNFe);
  if (payload.indicadorPresenca !== undefined || payload.indPres !== undefined) data.indicadorPresenca = cleanString(payload.indicadorPresenca ?? payload.indPres);
  if (payload.consumoFinal !== undefined || payload.indFinal !== undefined) {
    const value = String(payload.consumoFinal ?? payload.indFinal);
    if (!IND_FINAL_CODES.has(value)) throw new AppError("Consumidor final invalido. Use 0 ou 1.", "INVALID_INDFINAL", 400);
    data.consumoFinal = value === "1" || payload.consumoFinal === true;
  }
  if (payload.dataEmissao !== undefined) data.dataEmissao = parseDateValue(payload.dataEmissao);
  if (payload.dataSaida !== undefined) data.dataSaida = parseDateValue(payload.dataSaida);
  if (payload.horaSaida !== undefined) data.horaSaida = cleanString(payload.horaSaida);
  if (payload.additionalInfo !== undefined || payload.informacoesComplementares !== undefined) {
    data.additionalInfo = cleanString(payload.additionalInfo ?? payload.informacoesComplementares);
  }
  if (payload.fiscoInfo !== undefined || payload.informacoesFisco !== undefined) {
    data.fiscoInfo = cleanString(payload.fiscoInfo ?? payload.informacoesFisco);
  }
  if (payload.pedidoRef !== undefined || payload.processoPedido !== undefined) {
    data.pedidoRef = cleanString(payload.pedidoRef ?? payload.processoPedido);
  }
  if (payload.justificativa !== undefined) data.justificativa = cleanString(payload.justificativa);
  if (payload.observacoes !== undefined) data.observacoes = cleanString(payload.observacoes);

  const tipoOperacao = data.tipoOperacao ?? existing.tipoOperacao;
  const finalidade = data.finalidade ?? existing.finalidade;
  const indicadorPresenca = data.indicadorPresenca ?? existing.indicadorPresenca;
  if (indicadorPresenca && !IND_PRES_CODES.has(indicadorPresenca)) {
    throw new AppError("Indicador de presenca invalido. Use 0, 1, 2, 3, 4, 5 ou 9.", "INVALID_INDPRES", 400);
  }

  if (!cfop && (data.cfop || existing.cfop)) {
    cfop = await getCfopOrThrow(data.cfop || existing.cfop);
  }
  validateFiscalCombination({
    cfop,
    tipoOperacao,
    finalidade,
    referenceAccessKey: referenceAccessKey || existing.references?.[0]?.chaveAcesso,
    justificativa: data.justificativa ?? existing.justificativa,
  });

  if (payload.recipientId !== undefined || payload.destinatarioId !== undefined) {
    const recipientId = cleanString(payload.recipientId ?? payload.destinatarioId);
    if (recipientId) {
      const client = await prisma.client.findFirst({ where: { id: recipientId, companyId } });
      if (!client) throw new AppError("Destinatario nao encontrado.", "CLIENT_NOT_FOUND", 404);
      data.destinatarioId = client.id;
      data.destinatarioNome = client.razaoSocial || client.nomeFantasia || client.nome;
      data.destinatarioCnpj = client.cnpj || null;
      data.destinatarioCpf = client.cpf || null;
      data.destinatarioIe = client.inscricaoEstadual || null;
      data.destinatarioUf = client.uf || null;
    } else {
      data.destinatarioId = null;
      data.destinatarioNome = null;
      data.destinatarioCnpj = null;
      data.destinatarioCpf = null;
      data.destinatarioIe = null;
      data.destinatarioUf = null;
    }
  }

  if (payload.destinatarioNome !== undefined || payload.recipientName !== undefined) {
    data.destinatarioNome = cleanString(payload.destinatarioNome ?? payload.recipientName);
  }
  if (payload.destinatarioCnpj !== undefined || payload.recipientCnpj !== undefined) {
    data.destinatarioCnpj = digits(payload.destinatarioCnpj ?? payload.recipientCnpj) || null;
  }
  if (payload.destinatarioCpf !== undefined || payload.recipientCpf !== undefined) {
    data.destinatarioCpf = digits(payload.destinatarioCpf ?? payload.recipientCpf) || null;
  }
  if (payload.destinatarioIe !== undefined || payload.recipientIe !== undefined) {
    data.destinatarioIe = cleanString(payload.destinatarioIe ?? payload.recipientIe);
  }
  if (payload.destinatarioUf !== undefined || payload.recipientUf !== undefined) {
    data.destinatarioUf = cleanString(payload.destinatarioUf ?? payload.recipientUf)?.toUpperCase() || null;
  }

  if (Object.keys(data).length > 0) {
    data.canTransmit = false;
    if (!LOCKED_STATUSES.has(existing.status)) data.status = "RASCUNHO";
  }

  return { data, referenceAccessKey };
}

function buildValidationPayload(note, company, emitter) {
  const items = note.items || [];
  return {
    versao: "4.00",
    modelo: "55",
    serie: note.serie,
    numero: note.numero,
    naturezaOperacao: note.naturezaOperacao,
    tipoOperacao: note.tipoOperacao,
    finalidadeEmissao: note.finalidade,
    ambiente: note.ambiente,
    ufAutorizadora: company.uf,
    emitente: {
      cnpj: company.cnpj,
      ie: company.stateRegistration,
      razaoSocial: company.legalName,
      uf: company.uf,
      municipio: company.city,
      crt: emitter?.crt || null,
    },
    destinatario: {
      nome: note.destinatarioNome,
      cnpj: note.destinatarioCnpj,
      cpf: note.destinatarioCpf,
      ie: note.destinatarioIe,
      uf: note.destinatarioUf,
      indicadorIe: note.destinatarioIe ? "1" : "9",
      consumidorFinal: note.consumoFinal,
    },
    itens: items.map((item) => ({
      codigo: item.productCode,
      descricao: item.description,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade: item.unidade,
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valorUnitario),
      valorTotal: Number(item.valorTotal),
      desconto: Number(item.descontoValor || 0),
      cst: item.cst,
      csosn: item.csosn,
      origem: item.origem,
      icmsBase: Number(item.icmsBase || 0),
      icmsAmount: Number(item.icmsAmount || 0),
      ipiAmount: Number(item.ipiAmount || 0),
      pisAmount: Number(item.pisAmount || 0),
      cofinsAmount: Number(item.cofinsAmount || 0),
    })),
    totais: {
      valorProdutos: Number(note.totals?.valorProdutos || 0),
      valorNota: Number(note.totals?.valorTotal || 0),
      desconto: Number(note.totals?.desconto || 0),
      frete: Number(note.totals?.frete || 0),
      seguro: Number(note.totals?.seguro || 0),
      outrasDespesas: Number(note.totals?.outrasDespesas || 0),
    },
    transporte: {
      modalidadeFrete: note.transport?.modalidadeFrete || "9",
    },
    cobranca: {},
    pagamento: {},
  };
}

function assertEmitterReady(company, emitter) {
  const missing = [];
  if (!digits(company.cnpj) || digits(company.cnpj).length !== 14) missing.push("CNPJ do emitente");
  if (!company.legalName) missing.push("Razao social do emitente");
  if (!company.uf) missing.push("UF do emitente");
  if (!company.city) missing.push("Municipio do emitente");
  if (!company.stateRegistration) missing.push("Inscricao Estadual do emitente");
  if (!emitter?.crt) missing.push("CRT do emitente");
  if (missing.length) {
    throw new AppError("Cadastro do emitente incompleto para emissao de NF-e.", "EMITTER_INCOMPLETE", 400, missing.map((message) => ({ field: "emitente", message })));
  }
}

async function recalculateTotals(tx, nfeDocumentId, companyId) {
  const items = await tx.nfeItem.findMany({
    where: { nfeDocumentId, companyId, deletedAt: null },
  });

  const totals = items.reduce(
    (sum, item) => {
      sum.valorProdutos += Number(item.valorTotal || 0);
      sum.desconto += Number(item.descontoValor || 0);
      sum.frete += Number(item.freightValue || 0);
      sum.seguro += Number(item.insuranceValue || 0);
      sum.outrasDespesas += Number(item.otherCosts || 0);
      sum.totalIcmsBase += Number(item.icmsBase || 0);
      sum.totalIcms += Number(item.icmsAmount || 0);
      sum.totalIcmsStBase += Number(item.icmsStBase || 0);
      sum.totalIcmsSt += Number(item.icmsStAmount || 0);
      sum.totalFcp += Number(item.fcpAmount || 0);
      sum.totalIpi += Number(item.ipiAmount || 0);
      sum.totalPis += Number(item.pisAmount || 0);
      sum.totalCofins += Number(item.cofinsAmount || 0);
      return sum;
    },
    {
      valorProdutos: 0,
      desconto: 0,
      frete: 0,
      seguro: 0,
      outrasDespesas: 0,
      totalIcmsBase: 0,
      totalIcms: 0,
      totalIcmsStBase: 0,
      totalIcmsSt: 0,
      totalFcp: 0,
      totalIpi: 0,
      totalPis: 0,
      totalCofins: 0,
    },
  );

  const valorTotal = round2(
    totals.valorProdutos -
      totals.desconto +
      totals.frete +
      totals.seguro +
      totals.outrasDespesas +
      totals.totalIpi +
      totals.totalIcmsSt,
  );

  return tx.nfeTotal.upsert({
    where: { nfeDocumentId },
    create: {
      nfeDocumentId,
      companyId,
      valorProdutos: round2(totals.valorProdutos),
      valorTotal,
      desconto: round2(totals.desconto),
      frete: round2(totals.frete),
      seguro: round2(totals.seguro),
      outrasDespesas: round2(totals.outrasDespesas),
      totalIcmsBase: round2(totals.totalIcmsBase),
      totalIcms: round2(totals.totalIcms),
      totalIcmsStBase: round2(totals.totalIcmsStBase),
      totalIcmsSt: round2(totals.totalIcmsSt),
      totalFcp: round2(totals.totalFcp),
      totalIpi: round2(totals.totalIpi),
      totalPis: round2(totals.totalPis),
      totalCofins: round2(totals.totalCofins),
    },
    update: {
      valorProdutos: round2(totals.valorProdutos),
      valorTotal,
      desconto: round2(totals.desconto),
      frete: round2(totals.frete),
      seguro: round2(totals.seguro),
      outrasDespesas: round2(totals.outrasDespesas),
      totalIcmsBase: round2(totals.totalIcmsBase),
      totalIcms: round2(totals.totalIcms),
      totalIcmsStBase: round2(totals.totalIcmsStBase),
      totalIcmsSt: round2(totals.totalIcmsSt),
      totalFcp: round2(totals.totalFcp),
      totalIpi: round2(totals.totalIpi),
      totalPis: round2(totals.totalPis),
      totalCofins: round2(totals.totalCofins),
    },
  });
}

async function buildItemData(companyId, note, payload, existingItem = null) {
  const productId = cleanString(payload.productId ?? payload.produtoId) || existingItem?.productId || null;
  let product = null;
  if (productId) {
    product = await prisma.product.findFirst({ where: { id: productId, companyId, active: true } });
    if (!product) throw new AppError("Produto nao encontrado ou inativo.", "PRODUCT_NOT_FOUND", 404);
  }

  if (!product && !existingItem) {
    throw new AppError("Produto real e obrigatorio para incluir item de NF-e.", "PRODUCT_REQUIRED", 400);
  }

  const quantity = parseMoney(payload.quantity ?? payload.quantidade, Number(existingItem?.quantidade || 1));
  const unitValue = parseMoney(payload.unitValue ?? payload.valorUnitario, Number(existingItem?.valorUnitario ?? product?.price ?? 0));
  const discountValue = parseMoney(payload.discountValue ?? payload.descontoValor, Number(existingItem?.descontoValor || 0));
  const freightValue = parseMoney(payload.freightValue ?? payload.frete, Number(existingItem?.freightValue || 0));
  const insuranceValue = parseMoney(payload.insuranceValue ?? payload.seguro, Number(existingItem?.insuranceValue || 0));
  const otherCosts = parseMoney(payload.otherCosts ?? payload.outrasDespesas, Number(existingItem?.otherCosts || 0));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError("Quantidade do item deve ser maior que zero.", "INVALID_ITEM_QUANTITY", 400);
  }
  if (!Number.isFinite(unitValue) || unitValue < 0) {
    throw new AppError("Valor unitario do item invalido.", "INVALID_ITEM_VALUE", 400);
  }

  const cfopCode = extractCfopCode(payload.cfop || product?.cfopPreferencial || existingItem?.cfop || note.cfop);
  const cfop = await getCfopOrThrow(cfopCode);
  validateFiscalCombination({
    cfop,
    tipoOperacao: note.tipoOperacao,
    finalidade: note.finalidade,
    referenceAccessKey: note.finalidade === "2" ? "referenced" : null,
    justificativa: note.justificativa,
  });

  const total = round2(quantity * unitValue);
  const itemData = {
    productId: product?.id || productId,
    productCode: cleanString(payload.productCode ?? payload.codigoProduto) || product?.code || existingItem?.productCode || null,
    ean: cleanString(payload.ean ?? payload.barcode) || product?.barcode || existingItem?.ean || null,
    description: cleanString(payload.description ?? payload.descricao) || product?.name || existingItem?.description,
    ncm: cleanString(payload.ncm) || product?.ncm || existingItem?.ncm || null,
    cest: cleanString(payload.cest) || product?.cest || existingItem?.cest || null,
    cfop: cfop.codigo,
    cst: cleanString(payload.cst) || existingItem?.cst || null,
    csosn: cleanString(payload.csosn) || product?.cstCsosnPadrao || existingItem?.csosn || null,
    origem: parseSmallInt(payload.origem ?? payload.origin, product?.origemMercadoria ?? existingItem?.origem ?? 0),
    unidade: cleanString(payload.unit ?? payload.unidade) || product?.unit || existingItem?.unidade || "UN",
    quantidade: quantity,
    valorUnitario: unitValue,
    valorTotal: total,
    descontoValor: discountValue,
    descontoPercent: parseMoney(payload.discountPercent ?? payload.descontoPercent, Number(existingItem?.descontoPercent || 0)),
    freightValue,
    insuranceValue,
    otherCosts,
    icmsRate: parseMoney(payload.icmsRate, Number(product?.icmsPadrao || existingItem?.icmsRate || 0)),
    ipiRate: parseMoney(payload.ipiRate, Number(product?.ipiPadrao || existingItem?.ipiRate || 0)),
    pisRate: parseMoney(payload.pisRate, Number(product?.pisPadrao || existingItem?.pisRate || 0)),
    cofinsRate: parseMoney(payload.cofinsRate, Number(product?.cofinsPadrao || existingItem?.cofinsRate || 0)),
  };

  itemData.icmsBase = total;
  itemData.icmsAmount = round2((total * itemData.icmsRate) / 100);
  itemData.ipiBase = total;
  itemData.ipiAmount = round2((total * itemData.ipiRate) / 100);
  itemData.pisBase = total;
  itemData.pisAmount = round2((total * itemData.pisRate) / 100);
  itemData.cofinsBase = total;
  itemData.cofinsAmount = round2((total * itemData.cofinsRate) / 100);

  return itemData;
}

nfeRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const page = Math.max(Number(request.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(request.query.limit || 10), 1), 100);
    const skip = (page - 1) * limit;
    const sortBy = SORT_FIELDS[request.query.sortBy] || "updatedAt";
    const sortOrder = String(request.query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const where = buildWhere(companyId, request.query);

    const [data, total, summaryRows] = await Promise.all([
      prisma.nfeDocument.findMany({
        where,
        include: { totals: true },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.nfeDocument.count({ where }),
      prisma.nfeDocument.findMany({
        where,
        select: {
          status: true,
          totals: { select: { valorTotal: true } },
        },
      }),
    ]);

    sendSuccess(response, {
      data: data.map(toListItem),
      summary: buildSummary(summaryRows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  }),
);

nfeRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const company = request.company;
    const payload = request.body || {};
    const serie = parseSmallInt(payload.serie ?? payload.series, 1);
    const ambiente = normalizeEnvironment(payload.ambiente ?? payload.environment) || environmentFromCompany(company);
    const defaultCfop = await prisma.cfop.findFirst({ where: { codigo: "5102", ativo: true } });
    const numero = await prisma.$transaction((tx) =>
      reserveNumber(tx, {
        companyId: company.id,
        documentModel: "55",
        serie,
        environment: ambiente,
        documentType: "NFE",
      }),
    );

    const note = await prisma.nfeDocument.create({
      data: {
        companyId: company.id,
        userId: request.user.id,
        status: "RASCUNHO",
        numero,
        modelo: "55",
        serie,
        naturezaOperacao: defaultCfop?.operationNature || defaultCfop?.descricao || "Venda de mercadoria",
        cfop: defaultCfop?.codigo || "5102",
        tipoOperacao: "1",
        finalidade: "1",
        consumoFinal: false,
        indicadorPresenca: "1",
        idDest: "1",
        additionalInfo: defaultCfop?.defaultAdditionalInfo || null,
        ambiente,
        dataEmissao: new Date(),
        destinatarioUf: company.uf || null,
        totals: {
          create: {
            companyId: company.id,
            valorProdutos: 0,
            valorTotal: 0,
            desconto: 0,
            frete: 0,
            seguro: 0,
            outrasDespesas: 0,
          },
        },
        logs: {
          create: {
            companyId: company.id,
            userId: request.user.id,
            action: "nfe.draft.created",
            details: { source: "nfe-list", sequence: { serie, ambiente, numero } },
          },
        },
      },
      include: { totals: true },
    });

    sendSuccess(response, { id: note.id, data: toListItem(note) }, 201);
  }),
);

nfeRouter.get(
  "/:nfeId/status",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId);
    sendSuccess(response, {
      id: note.id,
      status: note.status,
      canTransmit: note.canTransmit,
      protocol: note.protocolo,
      message: note.xMotivo,
      updatedAt: note.updatedAt,
    });
  }),
);

nfeRouter.post(
  "/:nfeId/validate",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    if (LOCKED_STATUSES.has(note.status)) {
      throw new AppError("Esta NF-e nao pode ser validada neste status.", "NFE_STATUS_LOCKED", 409);
    }

    const emitter = await loadCompanyEmitter(request.company.id);
    assertEmitterReady(request.company, emitter);

    const validationPayload = buildValidationPayload(note, request.company, emitter);
    const validationResult = await runNfeValidation(validationPayload, request.company);
    const canTransmit = validationResult.canTransmit;
    const status = canTransmit ? "PRONTA_TRANSMISSAO" : "EM_VALIDACAO";
    const message = canTransmit
      ? "NF-e pronta para transmissao."
      : "Complete destinatario, emitente, itens e tributacao antes de transmitir.";

    const updated = await prisma.nfeDocument.update({
      where: { id: note.id },
      data: {
        status,
        canTransmit,
        validationScore: validationResult.score,
        xMotivo: message,
        validations: {
          create: {
            companyId: request.company.id,
            score: validationResult.score,
            errorCount: validationResult.errorCount,
            alertCount: validationResult.alertCount,
            infoCount: validationResult.infoCount,
            autoCorrections: validationResult.autoCorrections,
            rejectionProbability: validationResult.rejectionProbability,
            canTransmit,
            phases: validationResult.phases,
            durationMs: validationResult.durationMs,
            validatedAt: validationResult.validatedAt ? new Date(validationResult.validatedAt) : new Date(),
          },
        },
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.validated",
            details: { canTransmit, message, score: validationResult.score },
          },
        },
      },
      include: { totals: true },
    });

    sendSuccess(response, { data: toListItem(updated), message, canTransmit, validation: validationResult });
  }),
);

nfeRouter.post(
  "/:nfeId/transmit",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const emitter = await loadCompanyEmitter(request.company.id);
    assertEmitterReady(request.company, emitter);

    if (!note.canTransmit || note.status !== "PRONTA_TRANSMISSAO") {
      throw new AppError(
        "Nao e possivel transmitir rascunho incompleto. Valide e corrija a NF-e antes.",
        "NFE_NOT_READY",
        409,
      );
    }

    const updated = await prisma.nfeDocument.update({
      where: { id: note.id },
      data: {
        status: "TRANSMITINDO",
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.transmission.started",
            details: { source: "nfe-list" },
          },
        },
      },
      include: { totals: true },
    });

    sendSuccess(response, { data: toListItem(updated), message: "Transmissao iniciada." });
  }),
);

nfeRouter.post(
  "/:nfeId/duplicate",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const serie = note.serie || 1;
    const ambiente = note.ambiente || environmentFromCompany(request.company);
    const numero = await prisma.$transaction((tx) =>
      reserveNumber(tx, {
        companyId: request.company.id,
        documentModel: "55",
        serie,
        environment: ambiente,
        documentType: "NFE",
      }),
    );

    const duplicated = await prisma.nfeDocument.create({
      data: {
        companyId: request.company.id,
        userId: request.user.id,
        status: "RASCUNHO",
        numero,
        modelo: "55",
        serie,
        naturezaOperacao: note.naturezaOperacao,
        cfop: note.cfop,
        tipoOperacao: note.tipoOperacao,
        finalidade: note.finalidade,
        consumoFinal: note.consumoFinal,
        indicadorPresenca: note.indicadorPresenca,
        idDest: note.idDest,
        additionalInfo: note.additionalInfo,
        fiscoInfo: note.fiscoInfo,
        pedidoRef: note.pedidoRef,
        justificativa: note.justificativa,
        ambiente,
        dataEmissao: new Date(),
        destinatarioId: note.destinatarioId,
        destinatarioNome: note.destinatarioNome,
        destinatarioCnpj: note.destinatarioCnpj,
        destinatarioCpf: note.destinatarioCpf,
        destinatarioIe: note.destinatarioIe,
        destinatarioUf: note.destinatarioUf,
        totals: note.totals
          ? {
              create: {
                companyId: request.company.id,
                valorProdutos: note.totals.valorProdutos,
                valorTotal: note.totals.valorTotal,
                desconto: note.totals.desconto,
                frete: note.totals.frete,
                seguro: note.totals.seguro,
                outrasDespesas: note.totals.outrasDespesas,
              },
            }
          : undefined,
        items: {
          create: note.items.map((item) => ({
            companyId: request.company.id,
            itemNumber: item.itemNumber,
            productId: item.productId,
            productCode: item.productCode,
            ean: item.ean,
            description: item.description,
            ncm: item.ncm,
            cest: item.cest,
            cfop: item.cfop,
            cst: item.cst,
            csosn: item.csosn,
            origem: item.origem,
            unidade: item.unidade,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            descontoValor: item.descontoValor,
            descontoPercent: item.descontoPercent,
            freightValue: item.freightValue,
            insuranceValue: item.insuranceValue,
            otherCosts: item.otherCosts,
            icmsBase: item.icmsBase,
            icmsRate: item.icmsRate,
            icmsAmount: item.icmsAmount,
            ipiBase: item.ipiBase,
            ipiRate: item.ipiRate,
            ipiAmount: item.ipiAmount,
            pisBase: item.pisBase,
            pisRate: item.pisRate,
            pisAmount: item.pisAmount,
            cofinsBase: item.cofinsBase,
            cofinsRate: item.cofinsRate,
            cofinsAmount: item.cofinsAmount,
          })),
        },
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.duplicated",
            details: { sourceId: note.id, sequence: { serie, ambiente, numero } },
          },
        },
      },
      include: { totals: true },
    });

    sendSuccess(response, { id: duplicated.id, data: toListItem(duplicated) }, 201);
  }),
);

nfeRouter.put(
  "/:nfeId",
  asyncHandler(async (request, response) => {
    const existing = await prisma.nfeDocument.findFirst({
      where: { id: request.params.nfeId, companyId: request.company.id, deletedAt: null, modelo: "55" },
      include: { references: true },
    });
    if (!existing) throw new AppError("NF-e nao encontrada.", "NFE_NOT_FOUND", 404);
    assertEditable(existing);

    const { data, referenceAccessKey } = await buildUpdateData(request.company.id, existing, request.body || {});
    const updated = await prisma.nfeDocument.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(referenceAccessKey
          ? {
              references: {
                create: {
                  companyId: request.company.id,
                  tipo: "NFE",
                  chaveAcesso: referenceAccessKey,
                },
              },
            }
          : {}),
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.updated",
            details: { fields: Object.keys(data) },
          },
        },
      },
      include: {
        totals: true,
        items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
        references: true,
        observations: true,
        logs: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    sendSuccess(response, { data: { ...updated, emitente: await loadCompanyEmitter(request.company.id) } });
  }),
);

nfeRouter.post(
  "/:nfeId/items",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    assertEditable(note);

    const itemData = await buildItemData(request.company.id, note, request.body || {});
    const updated = await prisma.$transaction(async (tx) => {
      const lastItem = await tx.nfeItem.findFirst({
        where: { nfeDocumentId: note.id },
        orderBy: { itemNumber: "desc" },
        select: { itemNumber: true },
      });
      await tx.nfeItem.create({
        data: {
          ...itemData,
          nfeDocumentId: note.id,
          companyId: request.company.id,
          itemNumber: Number(lastItem?.itemNumber || 0) + 1,
        },
      });
      await recalculateTotals(tx, note.id, request.company.id);
      return tx.nfeDocument.update({
        where: { id: note.id },
        data: {
          status: "RASCUNHO",
          canTransmit: false,
          logs: {
            create: {
              companyId: request.company.id,
              userId: request.user.id,
              action: "nfe.item.created",
              details: { productId: itemData.productId },
            },
          },
        },
        include: {
          totals: true,
          items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
        },
      });
    });

    sendSuccess(response, { data: updated }, 201);
  }),
);

nfeRouter.put(
  "/:nfeId/items/:itemId",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    assertEditable(note);
    const item = await prisma.nfeItem.findFirst({
      where: { id: request.params.itemId, nfeDocumentId: note.id, companyId: request.company.id, deletedAt: null },
    });
    if (!item) throw new AppError("Item da NF-e nao encontrado.", "NFE_ITEM_NOT_FOUND", 404);

    const itemData = await buildItemData(request.company.id, note, request.body || {}, item);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.nfeItem.update({
        where: { id: item.id },
        data: itemData,
      });
      await recalculateTotals(tx, note.id, request.company.id);
      return tx.nfeDocument.update({
        where: { id: note.id },
        data: {
          status: "RASCUNHO",
          canTransmit: false,
          logs: {
            create: {
              companyId: request.company.id,
              userId: request.user.id,
              action: "nfe.item.updated",
              details: { itemId: item.id },
            },
          },
        },
        include: {
          totals: true,
          items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
        },
      });
    });

    sendSuccess(response, { data: updated });
  }),
);

nfeRouter.delete(
  "/:nfeId/items/:itemId",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    assertEditable(note);
    const item = await prisma.nfeItem.findFirst({
      where: { id: request.params.itemId, nfeDocumentId: note.id, companyId: request.company.id, deletedAt: null },
    });
    if (!item) throw new AppError("Item da NF-e nao encontrado.", "NFE_ITEM_NOT_FOUND", 404);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.nfeItem.update({
        where: { id: item.id },
        data: { deletedAt: new Date() },
      });
      await recalculateTotals(tx, note.id, request.company.id);
      return tx.nfeDocument.update({
        where: { id: note.id },
        data: {
          status: "RASCUNHO",
          canTransmit: false,
          logs: {
            create: {
              companyId: request.company.id,
              userId: request.user.id,
              action: "nfe.item.deleted",
              details: { itemId: item.id },
            },
          },
        },
        include: {
          totals: true,
          items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
        },
      });
    });

    sendSuccess(response, { data: updated });
  }),
);

nfeRouter.get(
  "/:nfeId",
  asyncHandler(async (request, response) => {
    const note = await prisma.nfeDocument.findFirst({
      where: { id: request.params.nfeId, companyId: request.company.id, deletedAt: null, modelo: "55" },
      include: {
        totals: true,
        items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
        transport: true,
        billing: { include: { installments: true } },
        observations: true,
        references: true,
        files: true,
        logs: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!note) throw new AppError("NF-e nao encontrada.", "NFE_NOT_FOUND", 404);
    sendSuccess(response, { data: { ...note, emitente: await loadCompanyEmitter(request.company.id) } });
  }),
);

nfeRouter.delete(
  "/:nfeId",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId);
    if (note.status !== "RASCUNHO") {
      throw new AppError("Somente rascunhos podem ser excluidos.", "NFE_DELETE_FORBIDDEN", 409);
    }

    await prisma.nfeDocument.update({
      where: { id: note.id },
      data: {
        deletedAt: new Date(),
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.draft.deleted",
          },
        },
      },
    });

    sendSuccess(response, { ok: true });
  }),
);
