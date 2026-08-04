import { AppError } from "../../utils/app-error.js";
export const financialNotFound=(kind)=>new AppError(`${kind} não encontrado neste contexto.`,"FINANCIAL_NOT_FOUND",404);
export const viewerForbidden=()=>new AppError("Usuário VIEWER possui acesso somente para consulta.","FORBIDDEN",403);
export const invalidSettlement=(message="Valor da baixa excede o saldo restante.")=>new AppError(message,"SETTLEMENT_EXCEEDS_BALANCE",422);
