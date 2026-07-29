import { AppError } from "../../utils/app-error.js";
export const financialNotFound=(kind)=>new AppError(`${kind} não encontrado neste contexto.`,"FINANCIAL_NOT_FOUND",404);
export const viewerForbidden=()=>new AppError("Usuário VIEWER possui acesso somente para consulta.","FORBIDDEN",403);
export const invalidSettlement=()=>new AppError("Valor da baixa excede o saldo restante.","SETTLEMENT_EXCEEDS_BALANCE",422);
