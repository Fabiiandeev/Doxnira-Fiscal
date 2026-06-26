import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";

export const productsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  code: z.string().min(1, "Código é obrigatório."),
  ncm: z.string().optional(),
  cest: z.string().optional(),
  unit: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").optional(),
  code: z.string().min(1, "Código é obrigatório.").optional(),
  ncm: z.string().nullable().optional(),
  cest: z.string().nullable().optional(),
  unit: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

productsRouter.post(
  "/",
  validate(createSchema),
  asyncHandler(async (request, response) => {
    const companyId = request.company.id;
    const payload = request.body;

    const existing = await prisma.product.findUnique({
      where: { companyId_code: { companyId, code: payload.code } },
    });
    if (existing) {
      throw new AppError("Já existe um produto com esse código.", "DUPLICATE_CODE", 409);
    }

    const product = await prisma.product.create({
      data: { ...payload, companyId },
    });
    sendSuccess(response, product, 201);
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
    const existing = await prisma.product.findUnique({
      where: { id: request.params.id },
    });
    if (!existing || existing.companyId !== request.company.id) {
      throw new AppError("Produto não encontrado.", "NOT_FOUND", 404);
    }

    if (request.body.code && request.body.code !== existing.code) {
      const dup = await prisma.product.findUnique({
        where: { companyId_code: { companyId: existing.companyId, code: request.body.code } },
      });
      if (dup) {
        throw new AppError("Já existe um produto com esse código.", "DUPLICATE_CODE", 409);
      }
    }

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: request.body,
    });
    sendSuccess(response, updated);
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
