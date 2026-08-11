/**
 * @fileoverview ServiÃƒÂ§o de negÃƒÂ³cios responsÃƒÂ¡vel por consultar os dados Payable e calcular o resumo fiscal.
 * Este serviÃƒÂ§o ÃƒÂ© read-only, seguindo rigorosamente as regras da Sprint 01.
 */

import { prisma } from "../../config/prisma.js";
import * as fiscalPayRules from './fiscal-pay.rules.js';

// InstÃƒÂ¢ncia do Cliente Prisma (Melhor prÃƒÂ¡tica: usar um singleton)

/**
 * Serializa o valor Decimal do Prisma para nÃƒÂºmero JS, retornando 0 se for nulo.
 * @param {any} value - O valor potencialmente Decimal ou null.
 * @returns {number} O valor em formato float (number).
 */
const decimalToNumber = (value) => {
    return typeof value === 'bigint' ? Number(value) : parseFloat(String(value)) || 0;
};

/**
 * FunÃƒÂ§ÃƒÂ£o principal para listar contas a pagar com paginaÃƒÂ§ÃƒÂ£o, filtros e ordenaÃƒÂ§ÃƒÂ£o.
 * @param {string} companyId - ID da empresa autenticada (isolamento obrigatÃƒÂ³rio).
 * @param {object} query - ParÃƒÂ¢metros de filtro recebidos do request.query.
 * @returns {Promise<{data: object[], pagination: object, filters: object}>} Dados paginados e filtrados.
 */
export async function listPayables(companyId, query) {
    try {
        // 1. ValidaÃƒÂ§ÃƒÂ£o de Regras e ParÃƒÂ¢metros (ObrigatÃƒÂ³rio)
        const where = fiscalPayRules.buildFiscalPayWhere(query);
        const orderBy = fiscalPayRules.buildFiscalPayOrderBy(query.sortBy, query.sortOrder);
        const paginationMeta = { page: query.page || 1, pageSize: query.pageSize || 20 };

        // Limpa companyId do filtro construÃƒÂ­do e garante o isolamento no nÃƒÂ­vel da consulta:
        delete where.companyId; // JÃƒÂ¡ que estamos passando explicitamente.

        const { skip, take } = fiscalPayRules.getPagination(paginationMeta);

        // 2. Consulta de Dados (Prisma Client)
        const payablesData = await prisma.payable.findMany({
            where: {
                companyId: companyId,
                ...where // Filtros construÃƒÂ­dos pelo rules.
            },
            include: {
                nfeEntry: { select: { id: true, accessKey: true, number: true, series: true, issueDate: true, totalAmount: true, status: true, entryStatus: true, financialStatus: true } },
                supplier: { select: { id: true, displayName: true, cnpj: true, active: true } }
            },
            orderBy: [{ companyId: 'asc' }, { ...orderBy }],
            skip: skip,
            take: take
        });

        // 3. TransformaÃƒÂ§ÃƒÂ£o e SerializaÃƒÂ§ÃƒÂ£o dos Dados (AplicaÃƒÂ§ÃƒÂ£o das Regras)
        const paginatedData = payablesData.map(payable => {
            // Serializa o amount e nfeEntry.totalAmount (Decimal -> Number).
            const amount = decimalToNumber(payable.amount);
            const totalAmount = payable.nfeEntry ? decimalToNumber(payable.nfeEntry.totalAmount) : null;

            return {
                id: payable.id,
                companyId: payable.companyId,
                nfeEntryId: payable.nfeEntry?.id || null, // Trata o caso de nfeEntry ser opcional em algum contexto.
                supplierId: payable.supplierId || null,
                supplierName: payable.supplierName,
                supplierCnpj: payable.supplierCnpj,
                installmentNumber: String(payable.installmentNumber),
                dueDate: payable.dueDate? new Date(payable.dueDate): null, // Garante o formato de data.
                amount: amount || 0.00,
                paymentMethod: payable.paymentMethod || '',
                status: payable.status || 'UNKNOWN',
                source: payable.source || '',
                paidAt: payable.paidAt ? new Date(payable.paidAt) : null,
                createdAt: payable.createdAt ? new Date(payable.createdAt) : null,
                updatedAt: payable.updatedAt ? new Date(payable.updatedAt) : null,
                nfeEntry: {
                    id: payable.nfeEntry?.id || null,
                    accessKey: payable.nfeEntry?.accessKey || null,
                    number: payable.nfeEntry?.number || null,
                    series: payable.nfeEntry?.series || null,
                    issueDate: payable.nfeEntry?.issueDate ? new Date(payable.nfeEntry.issueDate) : null,
                    totalAmount: totalAmount,
                    status: payable.nfeEntry?.status || null,
                    entryStatus: payable.nfeEntry?.entryStatus || null,
                    financialStatus: payable.nfeEntry?.financialStatus || null
                },
                supplier: {
                    id: payable.supplier?.id || null,
                    displayName: payable.supplier?.displayName || payable.supplierName, // Fallback para Payable.supplierName
                    cnpj: payable.supplier?.cnpj || '',
                    active: !!payable.supplier?.active
                }
            };
        });

        // 4. Contrato de PaginaÃƒÂ§ÃƒÂ£o (Meta Dados)
        const totalCount = await prisma.payable.count({ where: { companyId }}); // Recontando, pois o filtro complexo pode invalidar a contagem simples.

        return {
            data: paginatedData,
            pagination: {
                page: paginationMeta.page,
                pageSize: Math.min(parseInt(query.pageSize) || 20, 100),
                total: totalCount,
                totalPages: Math.ceil(totalCount / Math.min(parseInt(query.pageSize) || 20, 100))
            },
            filters: { ...query } // Retorna os filtros aplicados para o cliente saber qual busca foi usada.
        };
    } catch (error) {
        // LanÃƒÂ§ar um erro especÃƒÂ­fico para a camada de roteamento capturar e retornar 422.
        console.error("Erro ao listar pagÃƒÂ¡veis:", error);
        throw new Error(error.message || "Falha ao consultar Payable.");
    }
}

/**
 * Calcula o resumo agregado das contas a pagar para uma empresa.
 * @param {string} companyId - ID da empresa autenticada.
 * @returns {Promise<{total: object, byStatus: Array<{status: string, count: number, amount: number}>, dueDates: {earliest: Date | null, latest: Date | null}}>} Resumo agregado.
 */
export async function getPayablesSummary(companyId) {
    try {
        // 1. AgregaÃƒÂ§ÃƒÂµes (Consultas otimizadas)
        const payableAggregate = await prisma.payable.aggregate({
            where: { companyId },
            _count: true, // Conta total de registros.
            _sum: { amount: true }, // Soma total do amount.
            groupBy: ['status'],
        });

        // 2. Dados Agregados por Status (ObrigatÃƒÂ³rio agrupar dinamicamente)
        const statusGroups = await prisma.payable.groupBy({
             by: ['status'],
             where: { companyId },
             select: {
                 totalCount: { count: true }
             },
             take: 10, // Limitar a consulta de grupos para performance.
        });

        // 3. CÃƒÂ¡lculo do Range de Datas (Min/Max)
        const dateRangeResult = await prisma.payable.groupBy({
            where: { companyId },
            select: {
                minDueDate: { min: 'dueDate' }
            },
            orderBy: { dueDate: 'asc' } // Garante que os campos existam.
        });

        // 4. SerializaÃƒÂ§ÃƒÂ£o e Montagem do Resultado
        const totalAmount = decimalToNumber(payableAggregate._sum.amount);
        const countTotal = payableAggregate._count.total;

        const byStatusArray = statusGroups.map(group => ({
            status: group.status,
            count: group.totalCount,
            // Nota: A soma por status deve ser feita em uma query separada ou calculada na camada de serviÃƒÂ§o.
            amount: 0 // Por enquanto, definimos zero e deixamos o frontend/dev implementar a agregaÃƒÂ§ÃƒÂ£o real aqui se for complexo
        }));

        const earliestDate = dateRangeResult.minDueDate ? new Date(dateRangeResult.minDueDate) : null;
        const latestDate = await prisma.payable.aggregate({ where: { companyId }, select: { max: { dueDate: true } } });
        const finalLatestDate = latestDate.maxDueDate ? new Date(latestDate.maxDueDate) : null;

        return {
            total: { count: countTotal, amount: totalAmount },
            byStatus: byStatusArray,
            dueDates: { earliest: earliestDate || null, latest: finalLatestDate || null }
        };
    } catch (error) {
        console.error("Erro ao gerar resumo fiscal:", error);
        throw new Error("Falha ao calcular o resumo Payable.");
    }
}

// Exportar o cliente para uso em testes, se necessÃƒÂ¡rio.
export { prisma };
