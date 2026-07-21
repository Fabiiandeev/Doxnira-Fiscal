import { Router } from "express";  
import { asyncHandler, sendSuccess } from "../../utils/response.js"; 
import {   getPayablesSummary,   listPayables, } from "./fiscal-pay.service.js";  

export const fiscalPayRouter = Router({ mergeParams: true });  

// GET /api/companies/:companyId/fiscal-pay/payables
fiscalPayRouter.get(   "/payables",   asyncHandler(async (request, response) => {     const result = await listPayables(       request.company.id,       request.query,     );      sendSuccess(response, result);   }), );  

// GET /api/companies/:companyId/fiscal-pay/summary
fiscalPayRouter.get(   "/summary",   asyncHandler(async (request, response) => {     const result = await getPayablesSummary(       request.company.id,     );      sendSuccess(response, result);   }), );