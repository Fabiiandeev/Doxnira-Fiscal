import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { isValidCnpj, normalizeCnpj } from "../../utils/cnpj.js";
import { normalizeCpf, isValidCpf } from "../../utils/cpf.js";
import {
  lookupCompanyFiscalData,
  searchStateRegistration,
} from "../../services/cnpj-lookup.service.js";
import { validarClienteParaEmissao } from "../../lib/fiscal/validar-cliente-para-emissao.js";

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

export const clientesPublicRouter = Router();

// Public lookup for CNPJ
clientesPublicRouter.get(
  "/buscar-cnpj",
  asyncHandler(async (request, response) => {
    const raw = String(request.query.cnpj || "");
    const digits = normalizeCnpj(raw);
    if (!isValidCnpj(digits)) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ_FORMAT", 400);
    }

    try {
      const data = await lookupCompanyFiscalData(digits);

      // Map response to expected shape
      const mapped = {
        success: true,
        tipoPessoa: "PJ",
        cnpj: data.empresa?.cnpj || digits,
        razaoSocial: data.empresa?.razaoSocial || null,
        nomeFantasia: data.empresa?.nomeFantasia || null,
        inscricaoEstadual: data.inscricaoEstadual?.numero || null,
        inscricaoMunicipal: null,
        regimeTributario: data.fiscal?.regimeTributario || null,
        cnae: data.empresa?.cnaePrincipal?.codigo || null,
        atividadeEconomica: data.empresa?.cnaePrincipal?.descricao || null,
        situacaoCadastral: data.empresa?.situacao || null,
        telefone: null,
        email: null,
        cep: null,
        logradouro: data.empresa?.endereco || null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: data.empresa?.cidade || null,
        uf: data.empresa?.uf || null,
        codigoIbge: data.empresa?.cidade ? null : null,
        observacoes: null,
        dataAbertura: data.empresa?.dataAbertura || null,
        naturezaJuridica: data.empresa?.naturezaJuridica || null,
        fonte: data.inscricaoEstadual?.fonte || "PROVEDOR_CNPJ",
        dadosOriginais: data,
        alertas: [],
      };

      if (!mapped.inscricaoEstadual) {
        mapped.alertas.push({ code: "IE_NOT_FOUND", message: "IE não encontrada automaticamente. Confirme manualmente antes de emitir NF-e." });
      }

      sendSuccess(response, mapped);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Não foi possível consultar o CNPJ agora.", "CNPJ_LOOKUP_FAILED", 503);
    }
  }),
);

// Public lookup for CPF (no provider configured by default)
clientesPublicRouter.get(
  "/buscar-cpf",
  asyncHandler(async (request, response) => {
    const raw = String(request.query.cpf || "");
    const cpf = normalizeCpf(raw);
    if (!isValidCpf(cpf)) {
      throw new AppError("CPF inválido.", "INVALID_CPF_FORMAT", 400);
    }

    // No provider configured -> return informational response
    const mapped = {
      success: true,
      tipoPessoa: "PF",
      cpf,
      nome: null,
      telefone: null,
      email: null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      codigoIbge: null,
      fonte: null,
      dadosOriginais: null,
      alertas: [{ code: "CPF_PROVIDER_NOT_CONFIGURED", message: "Provider de CPF não configurado." }],
    };
    sendSuccess(response, mapped);
  }),
);

// Create client
clientesRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const payload = request.body || {};

    // Basic validation
    const tipo = String(payload.tipoPessoa || "").toUpperCase();
    if (!["PJ", "PF"].includes(tipo)) {
      throw new AppError("Tipo de pessoa inválido.", "INVALID_TIPO", 400);
    }

    if (tipo === "PJ") {
      if (!payload.cnpj || !isValidCnpj(normalizeCnpj(payload.cnpj))) {
        throw new AppError("CNPJ inválido.", "INVALID_CNPJ", 400);
      }
      if (!payload.razaoSocial) {
        throw new AppError("Razão Social é obrigatória.", "RAZAO_SOCIAL_REQUIRED", 400);
      }
      if (!payload.uf || !payload.cidade || !payload.logradouro) {
        throw new AppError("Dados de endereço incompletos.", "ENDERECO_INCOMPLETO", 400);
      }
    }

    if (tipo === "PF") {
      if (!payload.cpf || !isValidCpf(normalizeCpf(payload.cpf))) {
        throw new AppError("CPF inválido.", "INVALID_CPF", 400);
      }
      if (!payload.nome) {
        throw new AppError("Nome completo é obrigatório.", "NOME_REQUIRED", 400);
      }
    }

    const data = {
      ...payload,
      cpf: payload.cpf ? String(payload.cpf).replace(/\D/g, "") : null,
      cnpj: payload.cnpj ? String(payload.cnpj).replace(/\D/g, "") : null,
      ownerId: request.user.id,
      dadosOriginaisJson: payload.dadosOriginais || null,
      alertasJson: payload.alertas || null,
    };

    const client = await prisma.client.create({ data });
    sendSuccess(response, client, 201);
  }),
);

// List clients
clientesRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const items = await prisma.client.findMany({ where: { ownerId: request.user.id } });
    sendSuccess(response, { data: items });
  }),
);

// Get by id
clientesRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const client = await prisma.client.findUnique({ where: { id: request.params.id } });
    if (!client) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);
    sendSuccess(response, client);
  }),
);

// Update
clientesRouter.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const existing = await prisma.client.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);

    const payload = request.body || {};
    if (payload.cpf && !isValidCpf(normalizeCpf(payload.cpf))) {
      throw new AppError("CPF inválido.", "INVALID_CPF", 400);
    }
    if (payload.cnpj && !isValidCnpj(normalizeCnpj(payload.cnpj))) {
      throw new AppError("CNPJ inválido.", "INVALID_CNPJ", 400);
    }

    const data = {
      ...payload,
      cpf: payload.cpf ? String(payload.cpf).replace(/\D/g, "") : existing.cpf,
      cnpj: payload.cnpj ? String(payload.cnpj).replace(/\D/g, "") : existing.cnpj,
    };

    const updated = await prisma.client.update({ where: { id: existing.id }, data });
    sendSuccess(response, updated);
  }),
);

// Delete
clientesRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const existing = await prisma.client.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new AppError("Cliente não encontrado.", "NOT_FOUND", 404);
    await prisma.client.delete({ where: { id: existing.id } });
    sendSuccess(response, { message: "Cliente removido com sucesso." });
  }),
);

// IA validation endpoint
clientesRouter.post(
  "/validar-ia",
  asyncHandler(async (request, response) => {
    const cliente = request.body || {};
    // Here we don't have AI configured: run local validation
    const validation = validarClienteParaEmissao(cliente);
    const result = {
      success: true,
      normalizacoes: {},
      alertas: validation.alertas || [],
      pendencias: validation.erros || [],
      sugestoesCorrecao: validation.sugestoesCorrecao || [],
      validadoPorIa: false,
      mensagem: "IA não configurada. Validação local executada.",
    };
    sendSuccess(response, result);
  }),
);
