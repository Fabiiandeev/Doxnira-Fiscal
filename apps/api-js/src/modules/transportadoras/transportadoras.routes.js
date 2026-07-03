import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { isValidCnpj, normalizeCnpj } from "../../utils/cnpj.js";
import { normalizeCpf, isValidCpf } from "../../utils/cpf.js";

const TRANSPORTADORA_PRISMA_FIELDS = new Set([
  "tipoPessoa", "nome", "razaoSocial", "nomeFantasia",
  "cpf", "cnpj", "inscricaoEstadual", "inscricaoMunicipal",
  "regimeTributario", "crt", "indicadorIe", "tipoContribuinte", "contribuinteIcms",
  "antt", "rntrc", "tipoTransportadora",
  "placaVeiculo", "ufPlaca", "tipoVeiculo", "modalidadeFrete",
  "permiteColeta", "permiteEntrega", "cargaPerigosa",
  "temSeguro", "apoliceSeguro",
  "cep", "logradouro", "numero", "complemento", "bairro",
  "municipio", "uf", "codigoIbge", "codigoUfIbge",
  "pais", "email", "telefone", "whatsapp",
  "observacoes", "fonteDados", "ativo",
  "dadosOriginaisJson",
]);

const BLOCKED_FIELDS_UPDATE = new Set([
  "id", "companyId", "createdAt", "updatedAt", "company",
]);

function stripUnknownFields(data) {
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (TRANSPORTADORA_PRISMA_FIELDS.has(key) && !BLOCKED_FIELDS_UPDATE.has(key)) {
      clean[key] = value;
    } else {
      console.warn("TRANSPORTADORA_STRIP_FIELD", key, typeof value);
    }
  }
  return clean;
}

const nullIfEmpty = (v) => (v === "" || v === undefined || v === null) ? null : v;
const parseBool = (v) => {
  if (v === true || v === "true" || v === 1) return true;
  if (v === false || v === "false" || v === 0) return false;
  return null;
};
const parseJson = (v) => {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
};

export const transportadorasRouter = Router();
transportadorasRouter.use(requireAuth);

transportadorasRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const body = request.body || {};
    const tipo = String(body.tipoPessoa || "").toUpperCase();
    if (!["PJ", "PF"].includes(tipo)) {
      throw new AppError("Tipo de pessoa inválido.", "INVALID_TIPO", 400);
    }
    if (tipo === "PJ") {
      if (!body.cnpj || !isValidCnpj(normalizeCnpj(body.cnpj))) {
        throw new AppError("CNPJ inválido.", "INVALID_CNPJ", 400);
      }
      if (!body.razaoSocial) {
        throw new AppError("Razão Social é obrigatória.", "RAZAO_SOCIAL_REQUIRED", 400);
      }
    }
    if (tipo === "PF") {
      if (!body.cpf || !isValidCpf(normalizeCpf(body.cpf))) {
        throw new AppError("CPF inválido.", "INVALID_CPF", 400);
      }
      if (!body.nome) {
        throw new AppError("Nome completo é obrigatório.", "NOME_REQUIRED", 400);
      }
    }

    const data = {
      companyId,
      tipoPessoa: tipo,
      cnpj: tipo === "PJ" ? String(body.cnpj).replace(/\D/g, "") : null,
      cpf: tipo === "PF" ? String(body.cpf).replace(/\D/g, "") : null,
      razaoSocial: nullIfEmpty(body.razaoSocial),
      nomeFantasia: nullIfEmpty(body.nomeFantasia),
      nome: nullIfEmpty(body.nome),
      inscricaoEstadual: nullIfEmpty(body.inscricaoEstadual),
      inscricaoMunicipal: nullIfEmpty(body.inscricaoMunicipal),
      regimeTributario: nullIfEmpty(body.regimeTributario),
      crt: nullIfEmpty(body.crt),
      indicadorIe: nullIfEmpty(body.indicadorIe),
      tipoContribuinte: nullIfEmpty(body.tipoContribuinte),
      contribuinteIcms: parseBool(body.contribuinteIcms),
      antt: nullIfEmpty(body.antt),
      rntrc: nullIfEmpty(body.rntrc),
      tipoTransportadora: nullIfEmpty(body.tipoTransportadora),
      placaVeiculo: nullIfEmpty(body.placaVeiculo),
      ufPlaca: nullIfEmpty(body.ufPlaca),
      tipoVeiculo: nullIfEmpty(body.tipoVeiculo),
      modalidadeFrete: nullIfEmpty(body.modalidadeFrete),
      permiteColeta: parseBool(body.permiteColeta) ?? true,
      permiteEntrega: parseBool(body.permiteEntrega) ?? true,
      cargaPerigosa: parseBool(body.cargaPerigosa) ?? false,
      temSeguro: parseBool(body.temSeguro) ?? false,
      apoliceSeguro: nullIfEmpty(body.apoliceSeguro),
      cep: nullIfEmpty(body.cep) ? String(body.cep).replace(/\D/g, "") : null,
      logradouro: nullIfEmpty(body.logradouro),
      numero: nullIfEmpty(body.numero),
      complemento: nullIfEmpty(body.complemento),
      bairro: nullIfEmpty(body.bairro),
      municipio: nullIfEmpty(body.municipio || body.cidade),
      uf: nullIfEmpty(body.uf),
      codigoIbge: nullIfEmpty(body.codigoIbge),
      codigoUfIbge: nullIfEmpty(body.codigoUfIbge),
      pais: nullIfEmpty(body.pais),
      email: nullIfEmpty(body.email),
      telefone: nullIfEmpty(body.telefone) ? String(body.telefone).replace(/\D/g, "") : null,
      whatsapp: nullIfEmpty(body.whatsapp),
      observacoes: nullIfEmpty(body.observacoes),
      fonteDados: nullIfEmpty(body.fonteDados),
      ativo: parseBool(body.ativo) ?? true,
      dadosOriginaisJson: parseJson(body.dadosOriginaisJson),
    };

    const cleanData = stripUnknownFields(data);
    cleanData.companyId = companyId;

    try {
      const record = await prisma.transportadora.create({ data: cleanData });
      sendSuccess(response, record, 201);
    } catch (error) {
      console.error("CREATE_TRANSPORTADORA_ERROR", error.code, error.message, JSON.stringify(error.meta || {}));
      if (error.code === "P2002") {
        throw new AppError("Dados duplicados para esta empresa.", "DUPLICATE", 409);
      }
      throw new AppError("Erro ao salvar transportadora.", "CREATE_FAILED", 400);
    }
  }),
);

transportadorasRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const query = String(request.query.q ?? "").trim();
    const queryDigits = query.replace(/\D/g, "");

    let where = { companyId };

    if (query) {
      const orConditions = [
        { razaoSocial: { contains: query, mode: "insensitive" } },
        { nomeFantasia: { contains: query, mode: "insensitive" } },
        { nome: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
      if (queryDigits) {
        orConditions.push(
          { cnpj: { contains: queryDigits } },
          { cpf: { contains: queryDigits } },
          { telefone: { contains: queryDigits } },
        );
      }
      where = { ...where, OR: orConditions };
    }

    const items = await prisma.transportadora.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    sendSuccess(response, { data: items });
  }),
);

transportadorasRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const record = await prisma.transportadora.findFirst({
      where: { id: request.params.id, companyId: request.company.id },
    });
    if (!record) throw new AppError("Transportadora não encontrada.", "NOT_FOUND", 404);
    sendSuccess(response, record);
  }),
);

transportadorasRouter.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = request.params;
    const companyId = request.company.id;
    const existing = await prisma.transportadora.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError("Transportadora não encontrada.", "NOT_FOUND", 404);

    const body = request.body || {};
    if (body.cnpj && !isValidCnpj(normalizeCnpj(body.cnpj))) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ", 400);
    }
    if (body.cpf && !isValidCpf(normalizeCpf(body.cpf))) {
      throw new AppError("CPF inválido.", "INVALID_CPF", 400);
    }

    const setIfProvided = (obj, key, value) => {
      if (value !== undefined) obj[key] = value;
    };
    const nullIfEmpty = (v) => {
      if (v === undefined) return undefined;
      return (v === "" || v === null) ? null : v;
    };

    const data = {};
    setIfProvided(data, "tipoPessoa", nullIfEmpty(body.tipoPessoa));
    setIfProvided(data, "cnpj", body.cnpj ? String(body.cnpj).replace(/\D/g, "") : undefined);
    setIfProvided(data, "cpf", body.cpf ? String(body.cpf).replace(/\D/g, "") : undefined);
    setIfProvided(data, "razaoSocial", nullIfEmpty(body.razaoSocial));
    setIfProvided(data, "nomeFantasia", nullIfEmpty(body.nomeFantasia));
    setIfProvided(data, "nome", nullIfEmpty(body.nome));
    setIfProvided(data, "inscricaoEstadual", nullIfEmpty(body.inscricaoEstadual));
    setIfProvided(data, "inscricaoMunicipal", nullIfEmpty(body.inscricaoMunicipal));
    setIfProvided(data, "regimeTributario", nullIfEmpty(body.regimeTributario));
    setIfProvided(data, "crt", nullIfEmpty(body.crt));
    setIfProvided(data, "indicadorIe", nullIfEmpty(body.indicadorIe));
    setIfProvided(data, "tipoContribuinte", nullIfEmpty(body.tipoContribuinte));
    if (body.contribuinteIcms != null) setIfProvided(data, "contribuinteIcms", parseBool(body.contribuinteIcms));
    setIfProvided(data, "antt", nullIfEmpty(body.antt));
    setIfProvided(data, "rntrc", nullIfEmpty(body.rntrc));
    setIfProvided(data, "tipoTransportadora", nullIfEmpty(body.tipoTransportadora));
    setIfProvided(data, "placaVeiculo", nullIfEmpty(body.placaVeiculo));
    setIfProvided(data, "ufPlaca", nullIfEmpty(body.ufPlaca));
    setIfProvided(data, "tipoVeiculo", nullIfEmpty(body.tipoVeiculo));
    setIfProvided(data, "modalidadeFrete", nullIfEmpty(body.modalidadeFrete));
    if (body.permiteColeta != null) setIfProvided(data, "permiteColeta", parseBool(body.permiteColeta));
    if (body.permiteEntrega != null) setIfProvided(data, "permiteEntrega", parseBool(body.permiteEntrega));
    if (body.cargaPerigosa != null) setIfProvided(data, "cargaPerigosa", parseBool(body.cargaPerigosa));
    if (body.temSeguro != null) setIfProvided(data, "temSeguro", parseBool(body.temSeguro));
    setIfProvided(data, "apoliceSeguro", nullIfEmpty(body.apoliceSeguro));
    setIfProvided(data, "cep", nullIfEmpty(body.cep) ? String(body.cep).replace(/\D/g, "") : undefined);
    setIfProvided(data, "logradouro", nullIfEmpty(body.logradouro));
    setIfProvided(data, "numero", nullIfEmpty(body.numero));
    setIfProvided(data, "complemento", nullIfEmpty(body.complemento));
    setIfProvided(data, "bairro", nullIfEmpty(body.bairro));
    setIfProvided(data, "municipio", nullIfEmpty(body.municipio || body.cidade));
    setIfProvided(data, "uf", nullIfEmpty(body.uf));
    setIfProvided(data, "codigoIbge", nullIfEmpty(body.codigoIbge));
    setIfProvided(data, "codigoUfIbge", nullIfEmpty(body.codigoUfIbge));
    setIfProvided(data, "pais", nullIfEmpty(body.pais));
    setIfProvided(data, "email", nullIfEmpty(body.email));
    setIfProvided(data, "telefone", nullIfEmpty(body.telefone) ? String(body.telefone).replace(/\D/g, "") : undefined);
    setIfProvided(data, "whatsapp", nullIfEmpty(body.whatsapp));
    setIfProvided(data, "observacoes", nullIfEmpty(body.observacoes));
    setIfProvided(data, "fonteDados", nullIfEmpty(body.fonteDados));
    if (body.ativo != null) setIfProvided(data, "ativo", parseBool(body.ativo));
    setIfProvided(data, "dadosOriginaisJson", body.dadosOriginaisJson != null ? parseJson(body.dadosOriginaisJson) : undefined);

    try {
      const cleanData = stripUnknownFields(data);
      const updated = await prisma.transportadora.update({ where: { id: existing.id }, data: cleanData });
      sendSuccess(response, updated);
    } catch (error) {
      console.error("UPDATE_TRANSPORTADORA_ERROR", error.message || error);
      if (error.code === "P2002") {
        throw new AppError("Dados duplicados para esta empresa.", "DUPLICATE", 409);
      }
      throw new AppError("Erro ao atualizar transportadora.", "UPDATE_FAILED", 400);
    }
  }),
);

transportadorasRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = request.params;
    const companyId = request.company.id;
    const existing = await prisma.transportadora.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError("Transportadora não encontrada.", "NOT_FOUND", 404);
    await prisma.transportadora.delete({ where: { id: existing.id } });
    sendSuccess(response, { message: "Transportadora removida com sucesso." });
  }),
);
