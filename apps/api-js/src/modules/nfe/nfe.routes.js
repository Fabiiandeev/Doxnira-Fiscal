import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import { applyAutoCorrections, runNfeValidation } from "../../services/nfe-validation/nfe-validation-engine.js";
import { AppError } from "../../utils/app-error.js";
import { buildMockNfeAccessKey } from "../../utils/nfe-access-key.js";
import { lookupCompanyFiscalData, resolveIbgeCode } from "../../services/cnpj-lookup.service.js";
import { loadCertificateSigningMaterial } from "../../services/certificate-vault.service.js";
import { signNfeXml } from "../../services/xml-signature.service.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";

export const nfeRouter = Router();

const STATUS_MAP = {
  rascunho: "RASCUNHO",
  "em-validacao": "EM_VALIDACAO",
  em_validacao: "EM_VALIDACAO",
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

const LOCKED_STATUSES = new Set(["TRANSMITINDO", "PROCESSANDO_SEFAZ", "AUTORIZADA", "CANCELADA", "DENEGADA", "INUTILIZADA"]);
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

function formatNfeDateTime(value) {
  const date = new Date(value || new Date());
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(" ", "T");
  return `${parts}-03:00`;
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

function inferCrt(company, taxSettings = null) {
  if (taxSettings?.crt) return String(taxSettings.crt);
  const regime = String(taxSettings?.taxRegime || company?.taxRegime || "").toUpperCase();
  if (regime.includes("SIMPLES") || regime === "MEI") return "1";
  return "3";
}

function isSimpleTaxProfile(company, taxSettings = null) {
  const crt = inferCrt(company, taxSettings);
  const regime = String(taxSettings?.taxRegime || company?.taxRegime || "").toUpperCase();
  return ["1", "2", "4"].includes(crt) || regime.includes("SIMPLES") || regime === "MEI";
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
  if (query.minValue || query.maxValue) {
    const minValue = query.minValue ? parseMoney(query.minValue, null) : null;
    const maxValue = query.maxValue ? parseMoney(query.maxValue, null) : null;
    const range = {};
    if (Number.isFinite(minValue)) range.gte = minValue;
    if (Number.isFinite(maxValue)) range.lte = maxValue;
    if (Object.keys(range).length) {
      where.AND = [...(where.AND || []), { totals: { is: { valorTotal: range } } }];
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
    crt: inferCrt(company, taxSettings),
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
  const pendingStatuses = new Set(["RASCUNHO", "EM_VALIDACAO", "PRONTA_TRANSMISSAO", "TRANSMITINDO", "PROCESSANDO_SEFAZ", "REJEITADA"]);

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
      transport: true,
      billing: { include: { installments: { orderBy: { dataVencimento: "asc" } } } },
      validations: includeItems
        ? {
            orderBy: { validatedAt: "desc" },
            take: 1,
            include: { issues: { orderBy: { createdAt: "desc" } } },
          }
        : false,
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
  if (!company) return null;
  const emitter = toEmitter(company, company.taxSettings);
  emitter.codigoIbge = await resolveIbgeCode(company.city, company.uf, null);
  emitter.address = { city: company.city, uf: company.uf };
  try {
    const fiscalData = await lookupCompanyFiscalData(company.cnpj);
    const address = fiscalData?.empresa || {};
    emitter.address = {
      street: address.endereco,
      number: address.numero,
      complement: address.complemento,
      district: address.bairro,
      city: address.cidade || company.city,
      uf: address.uf || company.uf,
      cep: address.cep,
      phone: address.telefone,
    };
    if (!emitter.codigoIbge) {
      emitter.codigoIbge = await resolveIbgeCode(
        emitter.address.city,
        emitter.address.uf,
        address.cep,
      );
    }
  } catch {
    // O endpoint retornará uma mensagem objetiva se o endereço fiscal estiver incompleto.
  }
  return emitter;
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

function parseAutoFixItemField(field) {
  const match = String(field || "").match(/^item\[(\d+)\]\.(.+)$/);
  if (!match) return null;
  return {
    index: Number(match[1]) - 1,
    name: match[2],
  };
}

async function persistValidationSnapshot(tx, { request, note, validationResult, message }) {
  const canTransmit = Boolean(validationResult.canTransmit);
  const status = canTransmit ? "PRONTA_TRANSMISSAO" : "EM_VALIDACAO";

  const validationRecord = await tx.nfeValidationResult.create({
    data: {
      nfeDocumentId: note.id,
      companyId: request.company.id,
      score: validationResult.score,
      errorCount: validationResult.errorCount,
      alertCount: validationResult.alertCount,
      infoCount: validationResult.infoCount,
      autoCorrections: validationResult.autoCorrections ?? 0,
      rejectionProbability: validationResult.rejectionProbability,
      canTransmit,
      phases: validationResult.phases,
      durationMs: validationResult.durationMs,
      validatedAt: validationResult.validatedAt ? new Date(validationResult.validatedAt) : new Date(),
      issues: {
        create: validationResult.issues.slice(0, 200).map((issue) => ({
          companyId: request.company.id,
          code: String(issue.code || "NFE").slice(0, 20),
          category: String(issue.category || "GERAL").slice(0, 40),
          severity: String(issue.severity || "INFO").slice(0, 10),
          field: issue.field ? String(issue.field).slice(0, 120) : null,
          description: String(issue.description || "Apontamento fiscal").slice(0, 500),
          impact: issue.impact ? String(issue.impact).slice(0, 500) : null,
          howToFix: issue.howToFix ? String(issue.howToFix).slice(0, 500) : null,
          autoCorrectAvailable: Boolean(issue.autoCorrectAvailable),
          autoCorrectValue:
            issue.autoCorrectValue === undefined || issue.autoCorrectValue === null
              ? null
              : String(issue.autoCorrectValue).slice(0, 255),
          baseLegal: issue.baseLegal ? String(issue.baseLegal).slice(0, 255) : null,
        })),
      },
    },
  });

  const updated = await tx.nfeDocument.update({
    where: { id: note.id },
    data: {
      status,
      canTransmit,
      validationScore: validationResult.score,
      xMotivo: message,
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

  return { validationRecord, updated, canTransmit };
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
  const installments = note.billing?.installments || [];
  const transport = note.transport || {};
  const volumes = Array.isArray(transport.volumes) ? transport.volumes : [];
  return {
    versao: "4.00",
    mock: true,
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
      description: item.description,
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
      icmsValor: Number(item.icmsAmount || 0),
      icmsAmount: Number(item.icmsAmount || 0),
      ipiValor: Number(item.ipiAmount || 0),
      ipiAmount: Number(item.ipiAmount || 0),
      pisValor: Number(item.pisAmount || 0),
      pisAmount: Number(item.pisAmount || 0),
      cofinsValor: Number(item.cofinsAmount || 0),
      cofinsAmount: Number(item.cofinsAmount || 0),
      freteValor: Number(item.freightValue || 0),
      seguroValor: Number(item.insuranceValue || 0),
      outrasDespesasValor: Number(item.otherCosts || 0),
      fcpValor: Number(item.fcpAmount || 0),
    })),
    totais: {
      valorProdutos: Number(note.totals?.valorProdutos || 0),
      valorNota: Number(note.totals?.valorTotal || 0),
      desconto: Number(note.totals?.desconto || 0),
      descontoTotal: Number(note.totals?.desconto || 0),
      frete: Number(note.totals?.frete || 0),
      freteTotal: Number(note.totals?.frete || 0),
      seguro: Number(note.totals?.seguro || 0),
      seguroTotal: Number(note.totals?.seguro || 0),
      outrasDespesas: Number(note.totals?.outrasDespesas || 0),
      outrasDespesasTotal: Number(note.totals?.outrasDespesas || 0),
      icmsTotal: Number(note.totals?.totalIcms || 0),
      ipiTotal: Number(note.totals?.totalIpi || 0),
      pisTotal: Number(note.totals?.totalPis || 0),
      cofinsTotal: Number(note.totals?.totalCofins || 0),
      fcpTotal: Number(note.totals?.totalFcp || 0),
    },
    transporte: {
      modalidadeFrete: transport.modalidadeFrete || "9",
      transportadoraId: transport.transportadoraId || null,
      cnpj: transport.cnpjTransportadora || null,
      nomeTransportadora: transport.nomeTransportadora || null,
      ie: transport.ieTransportadora || null,
      ufPlaca: transport.ufPlaca || null,
      placaVeiculo: transport.placaVeiculo || null,
      rntc: transport.rntc || null,
      volumes,
    },
    cobranca: {
      duplicatas: installments.map((installment) => ({
        numero: installment.numero,
        vencimento: installment.dataVencimento,
        valor: Number(installment.valor || 0),
      })),
    },
    pagamento: {
      formaPagamento: note.billing?.formaPagamento || (Number(note.totals?.valorTotal || 0) > 0 ? "1" : "0"),
      meioPagamento: note.billing?.meioPagamento || "15",
      valorPagamento: Number(note.billing?.valorPagamento || note.totals?.valorTotal || 0),
    },
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
  const totalTributos = round2(
    totals.totalIcms +
      totals.totalIcmsSt +
      totals.totalFcp +
      totals.totalIpi +
      totals.totalPis +
      totals.totalCofins,
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
      totalTributos,
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
      totalTributos,
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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { taxSettings: true },
  });
  const simpleProfile = isSimpleTaxProfile(company, company?.taxSettings);
  const pisCofinsRegime = String(company?.taxSettings?.pisCofinsRegime || company?.taxSettings?.taxRegime || "").toUpperCase();
  const defaultPisRate = pisCofinsRegime.includes("PRESUMIDO") ? 0.65 : 1.65;
  const defaultCofinsRate = pisCofinsRegime.includes("PRESUMIDO") ? 3 : 7.6;
  const productTaxCode = cleanString(product?.cstCsosnPadrao);
  const payloadCst = cleanString(payload.cst);
  const payloadCsosn = cleanString(payload.csosn);
  const total = round2(quantity * unitValue);
  const taxBase = round2(Math.max(total - discountValue + freightValue + insuranceValue + otherCosts, 0));
  const itemData = {
    productId: product?.id || productId,
    productCode: cleanString(payload.productCode ?? payload.codigoProduto) || product?.code || existingItem?.productCode || null,
    ean: cleanString(payload.ean ?? payload.barcode) || product?.barcode || existingItem?.ean || null,
    description: cleanString(payload.description ?? payload.descricao) || product?.name || existingItem?.description,
    ncm: cleanString(payload.ncm) || product?.ncm || existingItem?.ncm || null,
    cest: cleanString(payload.cest) || product?.cest || existingItem?.cest || null,
    cfop: cfop.codigo,
    cst: simpleProfile ? null : payloadCst || (productTaxCode && productTaxCode.length <= 2 ? productTaxCode : null) || existingItem?.cst || "00",
    csosn: simpleProfile ? payloadCsosn || (productTaxCode && productTaxCode.length > 2 ? productTaxCode : null) || existingItem?.csosn || "102" : null,
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
    icmsRate: simpleProfile ? 0 : parseMoney(payload.icmsRate, Number(product?.icmsPadrao || existingItem?.icmsRate || 18)),
    ipiRate: parseMoney(payload.ipiRate, Number(product?.ipiPadrao || existingItem?.ipiRate || 0)),
    pisRate: simpleProfile ? 0 : parseMoney(payload.pisRate, Number(product?.pisPadrao || existingItem?.pisRate || defaultPisRate)),
    cofinsRate: simpleProfile ? 0 : parseMoney(payload.cofinsRate, Number(product?.cofinsPadrao || existingItem?.cofinsRate || defaultCofinsRate)),
  };

  itemData.icmsBase = simpleProfile ? 0 : taxBase;
  itemData.icmsAmount = simpleProfile ? 0 : round2((taxBase * itemData.icmsRate) / 100);
  itemData.ipiBase = itemData.ipiRate > 0 ? taxBase : 0;
  itemData.ipiAmount = round2((itemData.ipiBase * itemData.ipiRate) / 100);
  itemData.pisBase = simpleProfile ? 0 : taxBase;
  itemData.pisAmount = simpleProfile ? 0 : round2((taxBase * itemData.pisRate) / 100);
  itemData.cofinsBase = simpleProfile ? 0 : taxBase;
  itemData.cofinsAmount = simpleProfile ? 0 : round2((taxBase * itemData.cofinsRate) / 100);

  return itemData;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizePaymentCode(value, fallback) {
  const text = cleanString(value);
  if (!text) return fallback;
  const code = digits(text).slice(0, 3);
  return code || text.slice(0, 3);
}

function buildInstallmentPlan(note, payload = {}) {
  const total = round2(parseMoney(payload.valorPagamento ?? payload.paymentValue, Number(note.totals?.valorTotal || 0)));
  const explicit = Array.isArray(payload.installments) ? payload.installments : [];
  if (explicit.length > 0) {
    return explicit.map((installment, index) => ({
      numero: cleanString(installment.numero ?? installment.number) || String(index + 1).padStart(3, "0"),
      dataVencimento:
        parseDateValue(installment.dataVencimento ?? installment.dueDate) || addDays(new Date(), 7 + index * 30),
      valor: round2(parseMoney(installment.valor ?? installment.value, index === 0 ? total : 0)),
    }));
  }

  const count = Math.max(parseSmallInt(payload.parcelas ?? payload.installmentCount, 1), 1);
  const firstDueDate = parseDateValue(payload.primeiraParcela ?? payload.firstDueDate) || addDays(new Date(), 7);
  const baseValue = round2(total / count);
  let accumulated = 0;
  return Array.from({ length: count }, (_, index) => {
    const value = index === count - 1 ? round2(total - accumulated) : baseValue;
    accumulated = round2(accumulated + value);
    return {
      numero: String(index + 1).padStart(3, "0"),
      dataVencimento: addDays(firstDueDate, index * 30),
      valor: value,
    };
  });
}

function receivablesFromBilling(billing) {
  return (billing?.installments || []).map((installment) => ({
    id: installment.id,
    number: installment.numero,
    dueDate: installment.dataVencimento,
    value: Number(installment.valor || 0),
    status: "OPEN",
    source: "NFE",
  }));
}

async function syncBilling(tx, { note, companyId, userId, payload = {} }) {
  const installments = buildInstallmentPlan(note, payload);
  const value = round2(installments.reduce((sum, installment) => sum + Number(installment.valor || 0), 0));
  const billing = await tx.nfeBilling.upsert({
    where: { nfeDocumentId: note.id },
    create: {
      nfeDocumentId: note.id,
      companyId,
      formaPagamento: normalizePaymentCode(payload.formaPagamento ?? payload.paymentForm, installments.length > 1 ? "1" : "0"),
      meioPagamento: normalizePaymentCode(payload.meioPagamento ?? payload.paymentMethod, "15"),
      valorPagamento: value,
      cartaoCnpj: digits(payload.cartaoCnpj) || null,
      cartaoNumero: cleanString(payload.cartaoNumero) || null,
    },
    update: {
      formaPagamento: normalizePaymentCode(payload.formaPagamento ?? payload.paymentForm, installments.length > 1 ? "1" : "0"),
      meioPagamento: normalizePaymentCode(payload.meioPagamento ?? payload.paymentMethod, "15"),
      valorPagamento: value,
      cartaoCnpj: digits(payload.cartaoCnpj) || null,
      cartaoNumero: cleanString(payload.cartaoNumero) || null,
    },
  });

  await tx.nfeInstallment.deleteMany({ where: { nfeBillingId: billing.id, companyId } });
  if (installments.length > 0) {
    await tx.nfeInstallment.createMany({
      data: installments.map((installment) => ({
        nfeBillingId: billing.id,
        companyId,
        numero: installment.numero,
        dataVencimento: installment.dataVencimento,
        valor: installment.valor,
      })),
    });
  }

  await tx.nfeLog.create({
    data: {
      nfeDocumentId: note.id,
      companyId,
      userId,
      action: "nfe.billing.synced",
      details: { installments: installments.length, value },
    },
  });

  return tx.nfeBilling.findUnique({
    where: { id: billing.id },
    include: { installments: { orderBy: { dataVencimento: "asc" } } },
  });
}

async function ensureBillingForNote(tx, { note, companyId, userId }) {
  const existing = await tx.nfeBilling.findUnique({
    where: { nfeDocumentId: note.id },
    include: { installments: { orderBy: { dataVencimento: "asc" } } },
  });
  if (existing?.installments?.length) return existing;
  return syncBilling(tx, { note, companyId, userId, payload: { parcelas: 1, meioPagamento: "15" } });
}

function normalizeTransportVolumes(volumes) {
  if (!Array.isArray(volumes)) return [];
  return volumes.map((volume) => ({
    quantidade: volume?.quantidade === undefined || volume?.quantidade === null || volume?.quantidade === "" ? null : parseMoney(volume.quantidade, null),
    especie: cleanString(volume?.especie),
    marca: cleanString(volume?.marca),
    numeracao: cleanString(volume?.numeracao),
    pesoLiquido: volume?.pesoLiquido === undefined || volume?.pesoLiquido === null || volume?.pesoLiquido === "" ? null : parseMoney(volume.pesoLiquido, null),
    pesoBruto: volume?.pesoBruto === undefined || volume?.pesoBruto === null || volume?.pesoBruto === "" ? null : parseMoney(volume.pesoBruto, null),
  }));
}

function buildTransportSyncData(payload = {}) {
  return {
    modalidadeFrete: String(payload.modalidadeFrete ?? payload.frete ?? "9").trim().slice(0, 2) || "9",
    transportadoraId: cleanString(payload.transportadoraId),
    cnpjTransportadora: digits(payload.cpfCnpj ?? payload.cnpjTransportadora) || null,
    nomeTransportadora: cleanString(payload.nomeTransportadora ?? payload.transportadoraNome),
    ieTransportadora: cleanString(payload.inscricaoEstadual ?? payload.ieTransportadora),
    enderecoTransportadora: cleanString(payload.endereco ?? payload.enderecoTransportadora),
    municipioTransportadora: cleanString(payload.municipio ?? payload.municipioTransportadora),
    ufTransportadora: (cleanString(payload.uf ?? payload.ufTransportadora) || "").toUpperCase().slice(0, 2) || null,
    placaVeiculo: (cleanString(payload.placa ?? payload.placaVeiculo) || "").toUpperCase().replace(/\s+/g, "") || null,
    ufPlaca: (cleanString(payload.ufPlaca) || "").toUpperCase().slice(0, 2) || null,
    rntc: cleanString(payload.rntc),
    volumes: normalizeTransportVolumes(payload.volumes),
  };
}

async function syncTransport(tx, { note, companyId, userId, payload = {} }) {
  const transportData = buildTransportSyncData(payload);
  await tx.nfeTransport.upsert({
    where: { nfeDocumentId: note.id },
    create: {
      nfeDocumentId: note.id,
      companyId,
      ...transportData,
    },
    update: {
      ...transportData,
    },
  });

  await tx.nfeDocument.update({
    where: { id: note.id },
    data: {
      status: "RASCUNHO",
      canTransmit: false,
      logs: {
        create: {
          companyId,
          userId,
          action: "nfe.transport.synced",
          details: {
            modalidadeFrete: transportData.modalidadeFrete,
            transportadoraId: transportData.transportadoraId,
            volumes: transportData.volumes?.length || 0,
          },
        },
      },
    },
  });

  return tx.nfeDocument.findUnique({
    where: { id: note.id },
    include: {
      totals: true,
      items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
      transport: true,
      billing: { include: { installments: { orderBy: { dataVencimento: "asc" } } } },
      observations: true,
      references: true,
      files: true,
      logs: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
}

async function performMockTransmission({ request, note, emitter }) {
  const stagedAt = new Date();
  const accessKey = buildMockNfeAccessKey({
    uf: request.company.uf,
    issuerCnpj: request.company.cnpj,
    invoiceNumber: note.numero,
    series: note.serie,
    model: note.modelo,
    issuedAt: note.dataEmissao || stagedAt,
    seed: note.id,
  });
  const protocol = `135${String(stagedAt.getFullYear()).slice(-2)}${String(note.numero || 0).padStart(9, "0")}${String(stagedAt.getTime()).slice(-4)}`;
  const receipt = `REC${String(note.numero || 0).padStart(9, "0")}`;
  const xml = buildMockNfeXml(note, accessKey, protocol, stagedAt, emitter);
  const receiptXml = buildMockSefazReturnXml({
    cStat: "103",
    xMotivo: "Lote recebido com sucesso",
    nRec: receipt,
  });
  const processingXml = buildMockSefazReturnXml({
    cStat: "105",
    xMotivo: "Lote em processamento",
    nRec: receipt,
  });
  const authorizationReturnXml = buildMockSefazReturnXml({
    cStat: "104",
    xMotivo: "Lote processado",
    nRec: receipt,
    protocolo,
  });

  const stageOne = await prisma.$transaction(async (tx) => {
    const billing = await ensureBillingForNote(tx, {
      note,
      companyId: request.company.id,
      userId: request.user.id,
    });

    await tx.nfeTransmissionAttempt.create({
      data: {
        nfeDocumentId: note.id,
        companyId: request.company.id,
        userId: request.user.id,
        status: "SENT",
        xmlEnviado: xml,
        cStat: "103",
        xMotivo: "Lote recebido com sucesso",
        nRec: receipt,
        ambiente: note.ambiente,
        uf: request.company.uf,
        retornoEm: stagedAt,
      },
    });

    await tx.nfeSefazReturn.upsert({
      where: { nfeDocumentId: note.id },
      create: {
        nfeDocumentId: note.id,
        companyId: request.company.id,
        cStat: "103",
        xMotivo: "Lote recebido com sucesso",
        nRec: receipt,
        protocolo: null,
        ambiente: note.ambiente,
        uf: request.company.uf,
        xmlRetorno: receiptXml,
        dhRecebto: stagedAt,
        tempoMedio: 1,
      },
      update: {
        cStat: "103",
        xMotivo: "Lote recebido com sucesso",
        nRec: receipt,
        protocolo: null,
        ambiente: note.ambiente,
        uf: request.company.uf,
        xmlRetorno: receiptXml,
        dhRecebto: stagedAt,
        tempoMedio: 1,
      },
    });

    await tx.nfeDocument.update({
      where: { id: note.id },
      data: {
        status: "TRANSMITINDO",
        canTransmit: false,
        chaveAcesso: accessKey,
        protocolo: null,
        xmlAssinado: xml,
        xmlTransmitido: xml,
        xmlRetorno: receiptXml,
        xmlProtocolo: null,
        xmlDanfe: null,
        cStat: "103",
        xMotivo: "Lote recebido com sucesso",
        nRec: receipt,
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.transmission.started",
            details: {
              accessKey,
              receipt,
            },
          },
        },
      },
    });

    return billing;
  });

  scheduleMockSefazProcessing({
    request,
    noteId: note.id,
    emitter,
    accessKey,
    protocol,
    receipt,
    xml,
    processingXml,
    authorizationReturnXml,
  });

  const updated = await findNfeOrThrow(request.company.id, note.id, true);

  return {
    updated,
    billing: stageOne,
    protocol: null,
    accessKey,
  };
}

async function claimTransmission(note) {
  const claim = await prisma.nfeDocument.updateMany({
    where: {
      id: note.id,
      companyId: note.companyId,
      status: "PRONTA_TRANSMISSAO",
      canTransmit: true,
      deletedAt: null,
    },
    data: { status: "TRANSMITINDO", canTransmit: false },
  });
  if (claim.count !== 1) {
    throw new AppError(
      "A transmissão desta NF-e já foi iniciada ou o documento não está mais pronto para envio.",
      "NFE_TRANSMISSION_ALREADY_CLAIMED",
      409,
    );
  }
}

async function releaseTransmissionClaim(note) {
  await prisma.nfeDocument.updateMany({
    where: {
      id: note.id,
      companyId: note.companyId,
      status: "TRANSMITINDO",
      nRec: null,
      protocolo: null,
    },
    data: { status: "PRONTA_TRANSMISSAO", canTransmit: true },
  });
}

function buildMockBoleto(note, billing) {
  const firstInstallment = billing?.installments?.[0];
  const nossoNumero = `${String(note.numero || 0).padStart(9, "0")}${String(note.serie || 1).padStart(3, "0")}`;
  const value = Number(firstInstallment?.valor || billing?.valorPagamento || note.totals?.valorTotal || 0);
  return {
    nossoNumero,
    numeroDocumento: `${note.serie || 1}/${String(note.numero || 0).padStart(9, "0")}`,
    vencimento: firstInstallment?.dataVencimento || addDays(new Date(), 7),
    valor: round2(value),
    linhaDigitavel: `34191.79001 01043.${String(note.numero || 0).padStart(5, "0")} 91020.${String(note.serie || 1).padStart(6, "0")} 8 000000${String(Math.round(value * 100)).padStart(10, "0")}`,
    codigoBarras: `3419${String(Math.round(value * 100)).padStart(10, "0")}${nossoNumero.padEnd(30, "0").slice(0, 30)}`,
    url: `mock://boleto/${note.id}/${nossoNumero}`,
    status: "EMITIDO",
  };
}

function buildMockNfeXml(note, accessKey, protocol, authorizedAt, emitter) {
  return `<nfeProc versao="4.00"><NFe><infNFe Id="NFe${accessKey}"><ide><cNF>${String(note.numero || 0).padStart(8, "0")}</cNF><natOp>${note.naturezaOperacao || ""}</natOp><mod>55</mod><serie>${note.serie || 1}</serie><nNF>${note.numero || 0}</nNF></ide><emit><CNPJ>${digits(emitter?.cnpj)}</CNPJ><xNome>${emitter?.legalName || ""}</xNome></emit><dest><xNome>${note.destinatarioNome || ""}</xNome></dest><total><vNF>${Number(note.totals?.valorTotal || 0).toFixed(2)}</vNF></total></infNFe></NFe><protNFe versao="4.00"><infProt><chNFe>${accessKey}</chNFe><dhRecbto>${authorizedAt.toISOString()}</dhRecbto><nProt>${protocol}</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
}

function buildEmitterAddressXml(emitter) {
  const address = emitter?.address || {};
  return `<enderEmit><xLgr>${escapeHtml(address.street || "")}</xLgr><nro>${escapeHtml(address.number || "S/N")}</nro>${address.complement ? `<xCpl>${escapeHtml(address.complement)}</xCpl>` : ""}<xBairro>${escapeHtml(address.district || "")}</xBairro><cMun>${escapeHtml(emitter?.codigoIbge || "")}</cMun><xMun>${escapeHtml(address.city || emitter?.city || "")}</xMun><UF>${escapeHtml(address.uf || emitter?.uf || "")}</UF>${address.cep ? `<CEP>${digits(address.cep)}</CEP>` : ""}<cPais>1058</cPais><xPais>BRASIL</xPais>${address.phone ? `<fone>${digits(address.phone).slice(0, 14)}</fone>` : ""}</enderEmit>`;
}

function buildRecipientXml(note, recipient) {
  const document = note.destinatarioCnpj ? `<CNPJ>${digits(note.destinatarioCnpj)}</CNPJ>` : note.destinatarioCpf ? `<CPF>${digits(note.destinatarioCpf)}</CPF>` : "";
  const address = recipient ? `<enderDest><xLgr>${escapeHtml(recipient.logradouro || "")}</xLgr><nro>${escapeHtml(recipient.numero || "S/N")}</nro>${recipient.complemento ? `<xCpl>${escapeHtml(recipient.complemento)}</xCpl>` : ""}<xBairro>${escapeHtml(recipient.bairro || "")}</xBairro><cMun>${escapeHtml(recipient.codigoIbge || "")}</cMun><xMun>${escapeHtml(recipient.municipio || "")}</xMun><UF>${escapeHtml(recipient.uf || "")}</UF>${recipient.cep ? `<CEP>${digits(recipient.cep)}</CEP>` : ""}<cPais>1058</cPais><xPais>BRASIL</xPais>${recipient.telefone ? `<fone>${digits(recipient.telefone).slice(0, 14)}</fone>` : ""}</enderDest>` : "";
  const indIe = recipient?.indicadorIe || (recipient?.inscricaoEstadual ? "1" : "9");
  const recipientName = String(note.ambiente) === "2"
    ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
    : note.destinatarioNome || recipient?.razaoSocial || recipient?.nome || "";
  return `<dest>${document}<xNome>${escapeHtml(recipientName)}</xNome>${address}<indIEDest>${indIe}</indIEDest>${indIe === "1" && recipient?.inscricaoEstadual ? `<IE>${digits(recipient.inscricaoEstadual)}</IE>` : ""}${recipient?.email ? `<email>${escapeHtml(recipient.email)}</email>` : ""}</dest>`;
}

function buildNfePreviewXml(note, emitter, recipient, accessKey) {
  const itemXml = (note.items || []).map((item) => {
    const totalTax = Number(item.icmsAmount || 0) + Number(item.ipiAmount || 0) + Number(item.pisAmount || 0) + Number(item.cofinsAmount || 0);
    const icms = `<ICMS><ICMS00><orig>${item.origem ?? 0}</orig><CST>${escapeHtml(item.cst || "00")}</CST><modBC>3</modBC><vBC>${Number(item.icmsBase || 0).toFixed(2)}</vBC><pICMS>${Number(item.icmsRate || 0).toFixed(4)}</pICMS><vICMS>${Number(item.icmsAmount || 0).toFixed(2)}</vICMS></ICMS00></ICMS>`;
    const pis = `<PIS><PISAliq><CST>01</CST><vBC>${Number(item.pisBase || 0).toFixed(2)}</vBC><pPIS>${Number(item.pisRate || 0).toFixed(4)}</pPIS><vPIS>${Number(item.pisAmount || 0).toFixed(2)}</vPIS></PISAliq></PIS>`;
    const cofins = `<COFINS><COFINSAliq><CST>01</CST><vBC>${Number(item.cofinsBase || 0).toFixed(2)}</vBC><pCOFINS>${Number(item.cofinsRate || 0).toFixed(4)}</pCOFINS><vCOFINS>${Number(item.cofinsAmount || 0).toFixed(2)}</vCOFINS></COFINSAliq></COFINS>`;
    return `<det nItem="${item.itemNumber}"><prod><cProd>${escapeHtml(item.productCode || item.productId || item.itemNumber)}</cProd><cEAN>${escapeHtml(item.ean || "SEM GTIN")}</cEAN><xProd>${escapeHtml(item.description)}</xProd><NCM>${escapeHtml(item.ncm || "")}</NCM>${item.cest ? `<CEST>${escapeHtml(item.cest)}</CEST>` : ""}<CFOP>${escapeHtml(item.cfop || note.cfop || "")}</CFOP><uCom>${escapeHtml(item.unidade || "UN")}</uCom><qCom>${Number(item.quantidade || 0).toFixed(4)}</qCom><vUnCom>${Number(item.valorUnitario || 0).toFixed(10)}</vUnCom><vProd>${Number(item.valorTotal || 0).toFixed(2)}</vProd><cEANTrib>${escapeHtml(item.ean || "SEM GTIN")}</cEANTrib><uTrib>${escapeHtml(item.unidade || "UN")}</uTrib><qTrib>${Number(item.quantidade || 0).toFixed(4)}</qTrib><vUnTrib>${Number(item.valorUnitario || 0).toFixed(10)}</vUnTrib><indTot>1</indTot></prod><imposto><vTotTrib>${totalTax.toFixed(2)}</vTotTrib>${icms}${pis}${cofins}</imposto></det>`;
  }).join("");
  const totals = note.totals || {};
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- XML DE CONFERENCIA: rascunho sem assinatura digital e sem protocolo de autorizacao -->\n<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe${accessKey}"><ide><cUF>${accessKey.slice(0, 2)}</cUF><cNF>${accessKey.slice(35, 43)}</cNF><natOp>${escapeHtml(note.naturezaOperacao || "")}</natOp><mod>55</mod><serie>${note.serie || 1}</serie><nNF>${note.numero || 0}</nNF><dhEmi>${formatNfeDateTime(note.dataEmissao)}</dhEmi><tpNF>${escapeHtml(note.tipoOperacao || "1")}</tpNF><idDest>${escapeHtml(note.indicadorDestino || "1")}</idDest><cMunFG>${escapeHtml(emitter?.codigoIbge || "")}</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${accessKey.slice(43)}</cDV><tpAmb>${escapeHtml(note.ambiente || "2")}</tpAmb><finNFe>${escapeHtml(note.finalidade || "1")}</finNFe><indFinal>${note.consumoFinal ? "1" : "0"}</indFinal><indPres>${escapeHtml(note.indicadorPresenca || "0")}</indPres><procEmi>0</procEmi><verProc>Doxnira Fiscal</verProc></ide><emit><CNPJ>${digits(emitter?.cnpj)}</CNPJ><xNome>${escapeHtml(emitter?.legalName || "")}</xNome>${emitter?.tradeName ? `<xFant>${escapeHtml(emitter.tradeName)}</xFant>` : ""}${buildEmitterAddressXml(emitter)}<IE>${digits(emitter?.stateRegistration)}</IE><CRT>${escapeHtml(emitter?.crt || "3")}</CRT></emit>${buildRecipientXml(note, recipient)}${itemXml}<total><ICMSTot><vBC>${Number(totals.totalIcmsBase || 0).toFixed(2)}</vBC><vICMS>${Number(totals.totalIcms || 0).toFixed(2)}</vICMS><vProd>${Number(totals.valorProdutos || 0).toFixed(2)}</vProd><vFrete>${Number(totals.frete || 0).toFixed(2)}</vFrete><vSeg>${Number(totals.seguro || 0).toFixed(2)}</vSeg><vDesc>${Number(totals.desconto || 0).toFixed(2)}</vDesc><vIPI>${Number(totals.totalIpi || 0).toFixed(2)}</vIPI><vPIS>${Number(totals.totalPis || 0).toFixed(2)}</vPIS><vCOFINS>${Number(totals.totalCofins || 0).toFixed(2)}</vCOFINS><vOutro>${Number(totals.outrasDespesas || 0).toFixed(2)}</vOutro><vNF>${Number(totals.valorTotal || 0).toFixed(2)}</vNF></ICMSTot></total><transp><modFrete>${escapeHtml(note.transport?.modalidadeFrete || "9")}</modFrete></transp></infNFe></NFe>`;
}

function completeNfePreviewTotals(xml, totals) {
  const requiredBeforeProducts = `<vICMSDeson>${Number(totals?.icmsDesonerado || 0).toFixed(2)}</vICMSDeson><vFCPUFDest>0.00</vFCPUFDest><vICMSUFDest>0.00</vICMSUFDest><vICMSUFRemet>0.00</vICMSUFRemet><vFCP>${Number(totals?.totalFcp || 0).toFixed(2)}</vFCP><vBCST>${Number(totals?.totalIcmsStBase || 0).toFixed(2)}</vBCST><vST>${Number(totals?.totalIcmsSt || 0).toFixed(2)}</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>`;
  const requiredAfterDiscount = `<vII>0.00</vII>`;
  const requiredAfterIpi = `<vIPIDevol>0.00</vIPIDevol>`;
  return xml
    .replace("</vICMS><vProd>", `</vICMS>${requiredBeforeProducts}<vProd>`)
    .replace("</vDesc><vIPI>", `</vDesc>${requiredAfterDiscount}<vIPI>`)
    .replace("</vIPI><vPIS>", `</vIPI>${requiredAfterIpi}<vPIS>`)
    .replace("</vNF></ICMSTot>", `</vNF><vTotTrib>${Number(totals?.totalTributos || 0).toFixed(2)}</vTotTrib></ICMSTot>`);
}

function appendNfePaymentXml(xml, note) {
  const billing = note.billing;
  const tPag = String(billing?.meioPagamento || (Number(note.totals?.valorTotal || 0) > 0 ? "15" : "90")).padStart(2, "0");
  const indPag = String(billing?.formaPagamento || (billing?.installments?.length > 1 ? "1" : "0"));
  const vPag = tPag === "90" ? 0 : Number(billing?.valorPagamento ?? note.totals?.valorTotal ?? 0);
  const paymentXml = `<pag><detPag><indPag>${indPag}</indPag><tPag>${tPag}</tPag><vPag>${vPag.toFixed(2)}</vPag></detPag></pag>`;
  return xml.replace("</transp></infNFe>", `</transp>${paymentXml}</infNFe>`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDanfeHtml(note, company) {
  const accessKey = note.chaveAcesso || note.xmlDanfe || note.id;
  const issuerName = company.tradeName || company.legalName || "Emitente";
  const issuerDocument = company.cnpj || "-";
  const issuerLocation = [company.city, company.uf].filter(Boolean).join(" - ") || "-";
  const recipientName = note.destinatarioNome || "-";
  const recipientDocument = note.destinatarioCnpj || note.destinatarioCpf || "-";
  const emissionDate = note.dataEmissao ? new Date(note.dataEmissao).toLocaleString("pt-BR") : "-";
  const totalAmount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(note.totals?.valorTotal || 0));
  const statusText = note.status === "AUTORIZADA" || Boolean(note.xmlDanfe) ? "DANFE disponível para visualização." : "DANFE aguardando autorização.";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DANFE ${escapeHtml(accessKey)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #f4f7fb; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
      .sheet { max-width: 960px; margin: 24px auto; background: #fff; border: 1px solid #d6dee9; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }
      .hero { padding: 24px; background: linear-gradient(135deg, #0f172a, #1d4ed8); color: #fff; }
      .hero h1 { margin: 0; font-size: 30px; line-height: 1.1; }
      .hero p { margin: 8px 0 0; color: rgba(255, 255, 255, 0.88); font-size: 14px; }
      .status { display: inline-flex; margin-top: 14px; padding: 8px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.14); font-size: 12px; font-weight: 700; }
      .content { padding: 24px; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .field { min-height: 82px; padding: 14px; border: 1px solid #e5eaf1; border-radius: 14px; background: #f8fafc; }
      .label { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
      .value { margin-top: 8px; font-size: 14px; font-weight: 700; line-height: 1.5; word-break: break-word; }
      .full { grid-column: 1 / -1; }
      .footer { padding: 0 24px 24px; color: #64748b; font-size: 12px; }
      @media (max-width: 768px) {
        .sheet { margin: 0; border-radius: 0; min-height: 100vh; }
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="hero">
        <h1>DANFE - Documento Auxiliar da NF-e</h1>
        <p>NF-e ${escapeHtml(note.numero || "-")} · Série ${escapeHtml(note.serie || "-")} · Chave ${escapeHtml(accessKey)}</p>
        <div class="status">${escapeHtml(statusText)}</div>
      </section>
      <section class="content">
        <div class="grid">
          <div class="field">
            <div class="label">Emitente</div>
            <div class="value">${escapeHtml(issuerName)}</div>
          </div>
          <div class="field">
            <div class="label">Documento / Local</div>
            <div class="value">${escapeHtml(issuerDocument)} · ${escapeHtml(issuerLocation)}</div>
          </div>
          <div class="field">
            <div class="label">Destinatário</div>
            <div class="value">${escapeHtml(recipientName)}</div>
          </div>
          <div class="field">
            <div class="label">Documento do destinatário</div>
            <div class="value">${escapeHtml(recipientDocument)}</div>
          </div>
          <div class="field">
            <div class="label">Data de emissão</div>
            <div class="value">${escapeHtml(emissionDate)}</div>
          </div>
          <div class="field">
            <div class="label">Total da NF-e</div>
            <div class="value">${escapeHtml(totalAmount)}</div>
          </div>
          <div class="field">
            <div class="label">Protocolo</div>
            <div class="value">${escapeHtml(note.protocolo || "-")}</div>
          </div>
          <div class="field">
            <div class="label">cStat / Recibo</div>
            <div class="value">${escapeHtml(note.cStat || "-")} · ${escapeHtml(note.nRec || "-")}</div>
          </div>
          <div class="field full">
            <div class="label">Chave de acesso</div>
            <div class="value">${escapeHtml(accessKey)}</div>
          </div>
          <div class="field full">
            <div class="label">Mensagem</div>
            <div class="value">${escapeHtml(note.xMotivo || statusText)}</div>
          </div>
        </div>
      </section>
      <div class="footer">DANFE gerado pela API de NF-e em formato HTML para visualização, download e impressão.</div>
    </main>
  </body>
</html>`;
}

async function upsertNfeFile(tx, { note, companyId, tipo, storageKey, mimeType, content }) {
  const existing = await tx.nfeFile.findFirst({ where: { nfeDocumentId: note.id, companyId, tipo } });
  const data = {
    storageKey,
    mimeType,
    fileSize: content ? Buffer.byteLength(String(content), "utf8") : 0,
  };
  if (existing) {
    return tx.nfeFile.update({ where: { id: existing.id }, data });
  }
  return tx.nfeFile.create({
    data: {
      nfeDocumentId: note.id,
      companyId,
      tipo,
      ...data,
    },
  });
}

const MOCK_SEFAZ_PROCESSING_DELAY_MS = 1_500;
const MOCK_SEFAZ_AUTHORIZATION_DELAY_MS = 3_500;

function buildMockSefazReturnXml({ cStat, xMotivo, nRec, protocolo = null }) {
  return `<retConsReciNFe versao="4.00"><cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo><nRec>${nRec}</nRec>${protocolo ? `<nProt>${protocolo}</nProt>` : ""}</retConsReciNFe>`;
}

function scheduleMockSefazProcessing({
  request,
  noteId,
  emitter,
  accessKey,
  protocol,
  receipt,
  xml,
  processingXml,
  authorizationReturnXml,
}) {
  const processingTimer = setTimeout(() => {
    void updateMockProcessingStage({
      request,
      noteId,
      receipt,
      processingXml,
    }).catch((error) => {
      console.error({ err: error, noteId }, "Mock SEFAZ processing stage failed");
    });
  }, MOCK_SEFAZ_PROCESSING_DELAY_MS);
  processingTimer.unref?.();

  const authorizationTimer = setTimeout(() => {
    void updateMockAuthorizationStage({
      request,
      noteId,
      emitter,
      accessKey,
      protocol,
      receipt,
      xml,
      authorizationReturnXml,
    }).catch((error) => {
      console.error({ err: error, noteId }, "Mock SEFAZ authorization stage failed");
    });
  }, MOCK_SEFAZ_AUTHORIZATION_DELAY_MS);
  authorizationTimer.unref?.();
}

async function updateMockProcessingStage({ request, noteId, receipt, processingXml }) {
  const note = await findNfeOrThrow(request.company.id, noteId, true);
  if (!["TRANSMITINDO", "PROCESSANDO_SEFAZ"].includes(note.status)) return null;

  await prisma.$transaction(async (tx) => {
    await tx.nfeSefazReturn.upsert({
      where: { nfeDocumentId: note.id },
      create: {
        nfeDocumentId: note.id,
        companyId: request.company.id,
        cStat: "105",
        xMotivo: "Lote em processamento",
        nRec: receipt,
        protocolo: null,
        ambiente: note.ambiente,
        uf: request.company.uf,
        xmlRetorno: processingXml,
        dhRecebto: new Date(),
        tempoMedio: 2,
      },
      update: {
        cStat: "105",
        xMotivo: "Lote em processamento",
        nRec: receipt,
        protocolo: null,
        ambiente: note.ambiente,
        uf: request.company.uf,
        xmlRetorno: processingXml,
        dhRecebto: new Date(),
        tempoMedio: 2,
      },
    });

    await tx.nfeDocument.update({
      where: { id: note.id },
      data: {
        status: "PROCESSANDO_SEFAZ",
        canTransmit: false,
        cStat: "105",
        xMotivo: "Lote em processamento",
        nRec: receipt,
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.sefaz.processing",
            details: {
              receipt,
            },
          },
        },
      },
    });
  });

  return findNfeOrThrow(request.company.id, noteId, true);
}

async function updateMockAuthorizationStage({ request, noteId, emitter, accessKey, protocol, receipt, xml, authorizationReturnXml }) {
  const note = await findNfeOrThrow(request.company.id, noteId, true);
  if (!["TRANSMITINDO", "PROCESSANDO_SEFAZ"].includes(note.status)) return null;

  const authorizedAt = new Date();
  const billing = await prisma.$transaction(async (tx) => {
    const nextBilling = await ensureBillingForNote(tx, {
      note,
      companyId: request.company.id,
      userId: request.user.id,
    });

    await tx.nfeSefazReturn.upsert({
      where: { nfeDocumentId: note.id },
      create: {
        nfeDocumentId: note.id,
        companyId: request.company.id,
        cStat: "104",
        xMotivo: "Lote processado",
        nRec: receipt,
        protocolo: protocol,
        ambiente: note.ambiente,
        uf: request.company.uf,
        xmlRetorno: authorizationReturnXml,
        dhRecebto: authorizedAt,
        tempoMedio: 2,
      },
      update: {
        cStat: "104",
        xMotivo: "Lote processado",
        nRec: receipt,
        protocolo: protocol,
        ambiente: note.ambiente,
        uf: request.company.uf,
        xmlRetorno: authorizationReturnXml,
        dhRecebto: authorizedAt,
        tempoMedio: 2,
      },
    });

    await tx.nfeAuthorization.upsert({
      where: { nfeDocumentId: note.id },
      create: {
        nfeDocumentId: note.id,
        companyId: request.company.id,
        cStat: "100",
        xMotivo: "Autorizado o uso da NF-e",
        protocolo,
        ambiente: note.ambiente,
        dataAutorizacao: authorizedAt,
        xmlProtocolo: xml,
      },
      update: {
        cStat: "100",
        xMotivo: "Autorizado o uso da NF-e",
        protocolo,
        ambiente: note.ambiente,
        dataAutorizacao: authorizedAt,
        xmlProtocolo: xml,
      },
    });

    await upsertNfeFile(tx, {
      note,
      companyId: request.company.id,
      tipo: "XML_AUTORIZADO",
      storageKey: `mock://nfe/${note.id}/xml-autorizado`,
      mimeType: "application/xml",
      content: xml,
    });
    await upsertNfeFile(tx, {
      note,
      companyId: request.company.id,
      tipo: "DANFE_MOCK",
      storageKey: `mock://nfe/${note.id}/danfe`,
      mimeType: "application/pdf",
      content: `DANFE MOCK ${accessKey}`,
    });

    await tx.nfeLog.create({
      data: {
        nfeDocumentId: note.id,
        companyId: request.company.id,
        userId: request.user.id,
        action: "nfe.danfe.mock.generated",
        details: {
          accessKey,
          protocol,
          storageKey: `mock://nfe/${note.id}/danfe`,
        },
      },
    });

    await tx.nfeDocument.update({
      where: { id: note.id },
      data: {
        status: "AUTORIZADA",
        canTransmit: false,
        chaveAcesso: accessKey,
        protocolo,
        xmlAssinado: xml,
        xmlTransmitido: xml,
        xmlRetorno: authorizationReturnXml,
        xmlProtocolo: xml,
        xmlDanfe: `mock://nfe/${note.id}/danfe`,
        cStat: "100",
        xMotivo: "Autorizado o uso da NF-e",
        nRec: receipt,
        logs: {
          create: {
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.mock.authorized",
            details: {
              protocol,
              accessKey,
              receivables: receivablesFromBilling(nextBilling),
            },
          },
        },
      },
    });

    return nextBilling;
  });

  return { note: await findNfeOrThrow(request.company.id, noteId, true), billing };
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

nfeRouter.get(
  "/:nfeId/events",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId);
    const logs = await prisma.nfeLog.findMany({
      where: { nfeDocumentId: note.id, companyId: request.company.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    sendSuccess(response, {
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
      })),
    });
  }),
);

nfeRouter.get(
  "/:nfeId/xml-preview",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const emitter = await loadCompanyEmitter(request.company.id);
    const recipient = note.destinatarioId
      ? await prisma.client.findFirst({ where: { id: note.destinatarioId, companyId: request.company.id } })
      : null;
    if (!/^\d{7}$/.test(String(emitter?.codigoIbge || ""))) {
      throw new AppError(
        "Código IBGE do município do emitente não encontrado. Revise cidade e UF no cadastro da empresa.",
        "NFE_EMITTER_IBGE_REQUIRED",
        422,
      );
    }
    if (!emitter?.address?.street || !emitter?.address?.district || !emitter?.address?.city || !emitter?.address?.uf) {
      throw new AppError(
        "Endereço fiscal do emitente incompleto. Revise logradouro, bairro, município e UF no cadastro da empresa.",
        "NFE_EMITTER_ADDRESS_REQUIRED",
        422,
      );
    }
    const accessKey = buildMockNfeAccessKey({
      uf: request.company.uf,
      issuerCnpj: request.company.cnpj,
      invoiceNumber: note.numero,
      series: note.serie,
      model: note.modelo,
      issuedAt: note.dataEmissao || new Date(),
      seed: `preview:${note.id}`,
    });
    const unsignedXml = appendNfePaymentXml(
      completeNfePreviewTotals(
        buildNfePreviewXml(note, emitter, recipient, accessKey),
        note.totals,
      ),
      note,
    );
    const signingMaterial = await loadCertificateSigningMaterial(request.company.id);
    const xml = signNfeXml(unsignedXml, signingMaterial.privateKeyPem, signingMaterial.certificatePem);
    sendSuccess(response, {
      data: {
        xml,
        authorized: false,
        fileName: `nfe-conferencia-${note.numero || note.id}.xml`,
        mimeType: "application/xml;charset=utf-8",
        message: "XML de conferência gerado sem assinatura e sem protocolo SEFAZ.",
      },
    });
  }),
);

nfeRouter.get(
  "/:nfeId/danfe",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const danfeFile = await prisma.nfeFile.findFirst({
      where: { nfeDocumentId: note.id, companyId: request.company.id, tipo: "DANFE_MOCK" },
      orderBy: { createdAt: "desc" },
    });
    const storageKey = danfeFile?.storageKey || note.xmlDanfe || null;
    const hasRealUrl = Boolean(storageKey && !String(storageKey).startsWith("mock://"));
    const isReady = note.status === "AUTORIZADA" || Boolean(danfeFile);
    const common = {
      title: "DANFE - Documento Auxiliar da NF-e",
      accessKey: note.chaveAcesso || null,
      number: note.numero ?? null,
      series: note.serie ?? null,
      issuerName: request.company.tradeName || request.company.legalName || null,
      recipientCnpj: note.destinatarioCnpj || note.destinatarioCpf || null,
      totalAmount: Number(note.totals?.valorTotal || 0),
      status: isReady ? "READY" : "PENDING",
      message: isReady ? "DANFE de saída disponível." : "DANFE aguardando autorização.",
    };

    sendSuccess(response, {
      data: hasRealUrl
        ? {
            kind: "link",
            ...common,
            url: storageKey,
            storageKey,
            fileName: `danfe-nfe-saida-${note.chaveAcesso || note.id}.pdf`,
            mimeType: danfeFile?.mimeType || "application/pdf",
          }
        : {
            kind: "html",
            ...common,
            html: buildDanfeHtml(note, request.company),
            fileName: `danfe-nfe-saida-${note.chaveAcesso || note.id}.html`,
            mimeType: "text/html;charset=utf-8",
          },
    });
  }),
);

nfeRouter.post(
  "/:nfeId/recalculate",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    assertEditable(note);

    const updated = await prisma.$transaction(async (tx) => {
      await recalculateTotals(tx, note.id, request.company.id);
      await tx.nfeLog.create({
        data: {
          nfeDocumentId: note.id,
          companyId: request.company.id,
          userId: request.user.id,
          action: "nfe.totals.recalculated",
          details: { source: "manual" },
        },
      });
      return tx.nfeDocument.findUnique({
        where: { id: note.id },
        include: {
          totals: true,
          items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
          transport: true,
          billing: { include: { installments: { orderBy: { dataVencimento: "asc" } } } },
          observations: true,
          references: true,
          files: true,
          logs: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
    });

    sendSuccess(response, {
      data: { ...updated, emitente: await loadCompanyEmitter(request.company.id) },
      message: "Totais recalculados.",
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

    const { updated } = await persistValidationSnapshot(prisma, {
      request,
      note,
      validationResult,
      message,
    });

    sendSuccess(response, { data: toListItem(updated), message, canTransmit, validation: validationResult });
  }),
);

nfeRouter.post(
  "/:nfeId/auto-fix",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    if (LOCKED_STATUSES.has(note.status)) {
      throw new AppError("Esta NF-e nao pode receber correcoes neste status.", "NFE_STATUS_LOCKED", 409);
    }

    const emitter = await loadCompanyEmitter(request.company.id);
    assertEmitterReady(request.company, emitter);

    const validationPayload = buildValidationPayload(note, request.company, emitter);
    const validationResult = await runNfeValidation(validationPayload, request.company);
    const issuesForFix = validationResult.issues.map((issue) => ({ ...issue }));
    const { corrected, corrections } = applyAutoCorrections(issuesForFix, validationPayload);
    const itemCorrections = corrections
      .map((correction) => ({ correction, itemRef: parseAutoFixItemField(correction.field) }))
      .filter((entry) => entry.itemRef);
    const transportCorrections = corrections.some((correction) => correction.field.startsWith("transporte."));
    const noteCorrections = corrections.some((correction) => [
      "finalidadeEmissao",
      "ambiente",
      "destinatario.cnpj",
      "destinatario.cpf",
      "destinatario.ie",
      "destinatario.uf",
      "destinatario.nome",
      "destinatario.razaoSocial",
      "pedidoRef",
      "justificativa",
      "additionalInfo",
      "fiscoInfo",
      "naturezaOperacao",
      "tipoOperacao",
      "tpNF",
      "indicadorPresenca",
      "indPres",
      "consumoFinal",
      "indFinal",
    ].includes(correction.field));

    const validationMessage = corrections.length > 0
      ? "Correcoes seguras aplicadas. Revalide a NF-e."
      : "Nenhuma correcao segura encontrada.";

    const updated = await prisma.$transaction(async (tx) => {
      const { validationRecord } = await persistValidationSnapshot(tx, {
        request,
        note,
        validationResult: {
          ...validationResult,
          autoCorrections: corrections.length,
        },
        message: validationMessage,
      });

      if (corrections.length === 0) {
        await tx.nfeLog.create({
          data: {
            nfeDocumentId: note.id,
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.auto_fix.none",
            details: {
              score: validationResult.score,
              canTransmit: validationResult.canTransmit,
            },
          },
        });
      } else {
        const notePatch = {};
        if (noteCorrections) {
          if (corrections.some((correction) => correction.field === "finalidadeEmissao")) {
            notePatch.finalidade = String(corrected.finalidadeEmissao || note.finalidade || "1");
          }
          if (corrections.some((correction) => correction.field === "ambiente")) {
            notePatch.ambiente = environmentFromCompany(request.company);
          }
          if (corrections.some((correction) => correction.field === "destinatario.cnpj")) {
            notePatch.destinatarioCnpj = digits(corrected.destinatario?.cnpj) || null;
          }
          if (corrections.some((correction) => correction.field === "destinatario.cpf")) {
            notePatch.destinatarioCpf = digits(corrected.destinatario?.cpf) || null;
          }
          if (corrections.some((correction) => correction.field === "destinatario.ie")) {
            notePatch.destinatarioIe = cleanString(corrected.destinatario?.ie);
          }
          if (corrections.some((correction) => correction.field === "destinatario.uf")) {
            notePatch.destinatarioUf = cleanString(corrected.destinatario?.uf)?.toUpperCase() || null;
          }
          if (corrections.some((correction) => correction.field === "destinatario.nome" || correction.field === "destinatario.razaoSocial")) {
            notePatch.destinatarioNome = cleanString(corrected.destinatario?.razaoSocial || corrected.destinatario?.nome);
          }
          if (corrections.some((correction) => correction.field === "pedidoRef")) {
            notePatch.pedidoRef = cleanString(corrected.pedidoRef);
          }
          if (corrections.some((correction) => correction.field === "justificativa")) {
            notePatch.justificativa = cleanString(corrected.justificativa);
          }
          if (corrections.some((correction) => correction.field === "additionalInfo")) {
            notePatch.additionalInfo = cleanString(corrected.additionalInfo);
          }
          if (corrections.some((correction) => correction.field === "fiscoInfo")) {
            notePatch.fiscoInfo = cleanString(corrected.fiscoInfo);
          }
          if (corrections.some((correction) => correction.field === "naturezaOperacao")) {
            notePatch.naturezaOperacao = cleanString(corrected.naturezaOperacao);
          }
          if (corrections.some((correction) => correction.field === "tipoOperacao" || correction.field === "tpNF")) {
            notePatch.tipoOperacao = cleanString(corrected.tipoOperacao);
          }
          if (corrections.some((correction) => correction.field === "indicadorPresenca" || correction.field === "indPres")) {
            notePatch.indicadorPresenca = cleanString(corrected.indicadorPresenca);
          }
          if (corrections.some((correction) => correction.field === "consumoFinal" || correction.field === "indFinal")) {
            notePatch.consumoFinal = Boolean(corrected.consumoFinal === true || String(corrected.consumoFinal) === "1");
          }
        }

        await tx.nfeDocument.update({
          where: { id: note.id },
          data: {
            ...notePatch,
            status: "RASCUNHO",
            canTransmit: false,
            validationScore: null,
            xMotivo: "Correcoes seguras aplicadas. Revalide a NF-e.",
            logs: {
              create: {
                companyId: request.company.id,
                userId: request.user.id,
                action: "nfe.auto_fix.applied",
                details: {
                  corrections: corrections.length,
                  fields: corrections.map((correction) => correction.field).slice(0, 20),
                  validationResultId: validationRecord.id,
                },
              },
            },
          },
        });

        const itemIndexes = [...new Set(itemCorrections.map((entry) => entry.itemRef.index))];
        for (const index of itemIndexes) {
          const originalItem = note.items[index];
          const correctedItem = corrected.itens?.[index];
          if (!originalItem || !correctedItem) continue;

          await tx.nfeItem.update({
            where: { id: originalItem.id },
            data: {
              cfop: correctedItem.cfop ? String(correctedItem.cfop) : originalItem.cfop,
              unidade: cleanString(correctedItem.unidade) || originalItem.unidade,
              quantidade:
                correctedItem.quantidade === undefined || correctedItem.quantidade === null || correctedItem.quantidade === ""
                  ? originalItem.quantidade
                  : parseMoney(correctedItem.quantidade, Number(originalItem.quantidade || 0)),
              valorUnitario:
                correctedItem.valorUnitario === undefined || correctedItem.valorUnitario === null || correctedItem.valorUnitario === ""
                  ? originalItem.valorUnitario
                  : parseMoney(correctedItem.valorUnitario, Number(originalItem.valorUnitario || 0)),
              valorTotal:
                correctedItem.valorTotal === undefined || correctedItem.valorTotal === null || correctedItem.valorTotal === ""
                  ? originalItem.valorTotal
                  : parseMoney(correctedItem.valorTotal, Number(originalItem.valorTotal || 0)),
              descontoValor:
                correctedItem.desconto === undefined || correctedItem.desconto === null || correctedItem.desconto === ""
                  ? originalItem.descontoValor
                  : parseMoney(correctedItem.desconto, Number(originalItem.descontoValor || 0)),
              cst: correctedItem.cst ? String(correctedItem.cst) : originalItem.cst,
              csosn: correctedItem.csosn ? String(correctedItem.csosn) : originalItem.csosn,
              origem:
                correctedItem.origem === undefined || correctedItem.origem === null || correctedItem.origem === ""
                  ? originalItem.origem
                  : parseSmallInt(correctedItem.origem, originalItem.origem ?? null),
              ncm: correctedItem.ncm ? String(correctedItem.ncm) : originalItem.ncm,
              cest: correctedItem.cest ? String(correctedItem.cest) : originalItem.cest,
            },
          });
        }

        if (itemIndexes.length > 0) {
          await recalculateTotals(tx, note.id, request.company.id);
        }

        if (transportCorrections) {
          await syncTransport(tx, {
            note,
            companyId: request.company.id,
            userId: request.user.id,
            payload: corrected.transporte || {},
          });
        }

        await tx.nfeAutoFix.createMany({
          data: corrections.map((correction) => ({
            validationResultId: validationRecord.id,
            companyId: request.company.id,
            userId: request.user.id,
            issueCode: String(correction.code || "NFE").slice(0, 20),
            field: String(correction.field || "").slice(0, 120),
            oldValue:
              correction.oldValue === undefined || correction.oldValue === null
                ? null
                : String(correction.oldValue).slice(0, 500),
            newValue:
              correction.newValue === undefined || correction.newValue === null
                ? null
                : String(correction.newValue).slice(0, 500),
            reason: String(correction.description || "Correção segura aplicada.").slice(0, 500),
            ruleApplied: `AUTO_FIX_${String(correction.code || "NFE").slice(0, 100)}`,
          })),
        });

        await tx.nfeLog.create({
          data: {
            nfeDocumentId: note.id,
            companyId: request.company.id,
            userId: request.user.id,
            action: "nfe.auto_fix.applied",
            details: {
              corrections: corrections.length,
              fields: corrections.map((correction) => correction.field).slice(0, 20),
              validationResultId: validationRecord.id,
            },
          },
        });
      }

      return tx.nfeDocument.findFirst({
        where: { id: note.id, companyId: request.company.id, deletedAt: null, modelo: "55" },
        include: {
          totals: true,
          items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
          transport: true,
          billing: { include: { installments: { orderBy: { dataVencimento: "asc" } } } },
          observations: true,
          references: true,
          validations: {
            orderBy: { validatedAt: "desc" },
            take: 1,
            include: { issues: { orderBy: { createdAt: "desc" } } },
          },
          sefazReturn: true,
          authorization: true,
          files: true,
          logs: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
    });

    sendSuccess(response, {
      data: { ...updated, emitente: await loadCompanyEmitter(request.company.id) },
      message: corrections.length > 0 ? `Aplicadas ${corrections.length} correções seguras.` : "Nenhuma correção segura disponível.",
      corrections,
      validation: validationResult,
      canTransmit: corrections.length === 0 ? validationResult.canTransmit : false,
    });
  }),
);

nfeRouter.post(
  "/:nfeId/transmit",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const emitter = await loadCompanyEmitter(request.company.id);
    assertEmitterReady(request.company, emitter);

    if (!note.canTransmit || note.status !== "PRONTA_TRANSMISSAO") {
      await prisma.nfeLog.create({
        data: {
          nfeDocumentId: note.id,
          companyId: request.company.id,
          userId: request.user.id,
          action: "nfe.transmission.blocked",
          details: {
            status: note.status,
            canTransmit: note.canTransmit,
            validationScore: note.validationScore,
            issues: note.validations?.[0]?.issues?.length || 0,
          },
        },
      });
      throw new AppError(
        "Nao e possivel transmitir rascunho incompleto. Valide e corrija a NF-e antes.",
        "NFE_NOT_READY",
        409,
      );
    }

    await claimTransmission(note);
    let result;
    try {
      result = await performMockTransmission({ request, note, emitter });
    } catch (error) {
      await releaseTransmissionClaim(note);
      throw error;
    }

    sendSuccess(response, {
      data: toListItem(result.updated),
      message: "Lote recebido pela SEFAZ. Processamento assíncrono iniciado.",
      protocol: result.protocol || undefined,
      accessKey: result.accessKey,
      financial: {
        receivables: receivablesFromBilling(result.billing),
      },
    });
  }),
);

nfeRouter.post(
  "/:nfeId/transmit-mock",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const emitter = await loadCompanyEmitter(request.company.id);
    assertEmitterReady(request.company, emitter);

    if (!note.canTransmit || note.status !== "PRONTA_TRANSMISSAO") {
      await prisma.nfeLog.create({
        data: {
          nfeDocumentId: note.id,
          companyId: request.company.id,
          userId: request.user.id,
          action: "nfe.transmission.blocked",
          details: {
            status: note.status,
            canTransmit: note.canTransmit,
            validationScore: note.validationScore,
            issues: note.validations?.[0]?.issues?.length || 0,
          },
        },
      });
      throw new AppError(
        "Nao e possivel transmitir rascunho incompleto. Valide e corrija a NF-e antes.",
        "NFE_NOT_READY",
        409,
      );
    }

    await claimTransmission(note);
    let result;
    try {
      result = await performMockTransmission({ request, note, emitter });
    } catch (error) {
      await releaseTransmissionClaim(note);
      throw error;
    }

    sendSuccess(response, {
      data: toListItem(result.updated),
      message: "Lote recebido pela SEFAZ. Processamento assíncrono iniciado.",
      protocol: result.protocol || undefined,
      accessKey: result.accessKey,
      financial: {
        receivables: receivablesFromBilling(result.billing),
      },
    });
  }),
);

nfeRouter.put(
  "/:nfeId/transport",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    assertEditable(note);

    const updated = await prisma.$transaction(async (tx) => syncTransport(tx, {
      note,
      companyId: request.company.id,
      userId: request.user.id,
      payload: request.body || {},
    }));

    sendSuccess(response, {
      data: { ...updated, emitente: await loadCompanyEmitter(request.company.id) },
      message: "Transporte atualizado.",
    });
  }),
);

nfeRouter.post(
  "/:nfeId/generate-financial",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const payload = request.body || {};

    const billing = await prisma.$transaction(async (tx) => {
      const nextBilling = Object.keys(payload).length
        ? await syncBilling(tx, {
            note,
            companyId: request.company.id,
            userId: request.user.id,
            payload,
          })
        : await ensureBillingForNote(tx, {
            note,
            companyId: request.company.id,
            userId: request.user.id,
          });

      await tx.nfeDocument.update({
        where: { id: note.id },
        data: {
          logs: {
            create: {
              companyId: request.company.id,
              userId: request.user.id,
              action: "nfe.financial.generated",
              details: {
                receivables: nextBilling.installments.length,
                value: Number(nextBilling.valorPagamento || note.totals?.valorTotal || 0),
              },
            },
          },
        },
      });

      return nextBilling;
    });

    sendSuccess(response, {
      financial: {
        receivables: receivablesFromBilling(billing),
      },
      message: "Financeiro gerado.",
    });
  }),
);

nfeRouter.put(
  "/:nfeId/billing",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    if (note.status === "CANCELADA" || note.status === "DENEGADA" || note.status === "INUTILIZADA") {
      throw new AppError("Esta NF-e nao permite alteracao de cobranca.", "NFE_BILLING_LOCKED", 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await syncBilling(tx, {
        note,
        companyId: request.company.id,
        userId: request.user.id,
        payload: request.body || {},
      });
      return tx.nfeDocument.findUnique({
        where: { id: note.id },
        include: {
          totals: true,
          items: { where: { deletedAt: null }, orderBy: { itemNumber: "asc" } },
          transport: true,
          billing: { include: { installments: { orderBy: { dataVencimento: "asc" } } } },
          observations: true,
          references: true,
          files: true,
          logs: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
    });

    sendSuccess(response, {
      data: { ...updated, emitente: await loadCompanyEmitter(request.company.id) },
      message: "Cobranca e contas a receber atualizadas.",
    });
  }),
);

nfeRouter.post(
  "/:nfeId/boleto",
  asyncHandler(async (request, response) => {
    const note = await findNfeOrThrow(request.company.id, request.params.nfeId, true);
    const result = await prisma.$transaction(async (tx) => {
      const billing = await ensureBillingForNote(tx, {
        note,
        companyId: request.company.id,
        userId: request.user.id,
      });
      const boleto = buildMockBoleto(note, billing);
      await upsertNfeFile(tx, {
        note,
        companyId: request.company.id,
        tipo: "BOLETO_MOCK",
        storageKey: boleto.url,
        mimeType: "application/pdf",
        content: JSON.stringify(boleto),
      });
      await tx.nfeLog.create({
        data: {
          nfeDocumentId: note.id,
          companyId: request.company.id,
          userId: request.user.id,
          action: "nfe.boleto.mock.generated",
          details: boleto,
        },
      });
      return { boleto, billing };
    });

    sendSuccess(response, {
      boleto: result.boleto,
      financial: { receivables: receivablesFromBilling(result.billing) },
      message: "Boleto mock gerado.",
    });
  }),
);

nfeRouter.post(
  "/webhooks/mock",
  asyncHandler(async (request, response) => {
    const payload = request.body || {};
    const nfeId = cleanString(payload.nfeId ?? payload.nfeDocumentId ?? payload.documentId);
    if (!nfeId) throw new AppError("Informe nfeId para processar o webhook mock.", "NFE_WEBHOOK_ID_REQUIRED", 400);

    const note = await findNfeOrThrow(request.company.id, nfeId, true);
    const idempotencyKey =
      cleanString(request.headers["idempotency-key"]) ||
      cleanString(payload.eventId ?? payload.idempotencyKey) ||
      `${note.id}:${payload.status || payload.event || "mock"}`;
    const action = `nfe.webhook.mock.${String(idempotencyKey).replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 80)}`;
    const existing = await prisma.nfeLog.findFirst({
      where: {
        companyId: request.company.id,
        nfeDocumentId: note.id,
        action,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      sendSuccess(response, {
        processed: true,
        idempotent: true,
        eventId: idempotencyKey,
        status: note.status,
        message: "Webhook mock ja processado anteriormente.",
      });
      return;
    }

    const status = String(payload.status || payload.event || "paid").toUpperCase();
    await prisma.nfeLog.create({
      data: {
        nfeDocumentId: note.id,
        companyId: request.company.id,
        userId: request.user?.id || null,
        action,
        details: {
          status,
          idempotencyKey,
          receivedAt: new Date().toISOString(),
          payload,
        },
      },
    });

    sendSuccess(response, {
      processed: true,
      idempotent: false,
      eventId: idempotencyKey,
      status,
      message: "Webhook mock processado com idempotencia.",
    });
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
        logs: { orderBy: { createdAt: "desc" }, take: 100 },
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
      await tx.nfeLog.create({
        data: {
          nfeDocumentId: note.id,
          companyId: request.company.id,
          userId: request.user.id,
          action: "nfe.totals.recalculated",
          details: { source: "item", reason: "created", productId: itemData.productId },
        },
      });
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
      await tx.nfeLog.create({
        data: {
          nfeDocumentId: note.id,
          companyId: request.company.id,
          userId: request.user.id,
          action: "nfe.totals.recalculated",
          details: { source: "item", reason: "updated", itemId: item.id },
        },
      });
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
      await tx.nfeLog.create({
        data: {
          nfeDocumentId: note.id,
          companyId: request.company.id,
          userId: request.user.id,
          action: "nfe.totals.recalculated",
          details: { source: "item", reason: "deleted", itemId: item.id },
        },
      });
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
        validations: {
          orderBy: { validatedAt: "desc" },
          take: 1,
          include: { issues: { orderBy: { createdAt: "desc" } } },
        },
        sefazReturn: true,
        authorization: true,
        files: true,
        logs: { orderBy: { createdAt: "desc" }, take: 100 },
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
