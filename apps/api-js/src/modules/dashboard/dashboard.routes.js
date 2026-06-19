import { Router } from "express";

import { asyncHandler, sendSuccess } from "../../utils/response.js";
import {
  getLatestDocuments,
  getMonthlyFlow,
  getSummary,
  getTopSuppliers,
  getXmlDistribution,
} from "./dashboard.service.js";

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.get("/summary", asyncHandler(async (request, response) => {
  sendSuccess(response, await getSummary(request.company.id));
}));
dashboardRouter.get("/monthly-flow", asyncHandler(async (request, response) => {
  sendSuccess(response, await getMonthlyFlow(request.company.id));
}));
dashboardRouter.get("/xml-distribution", asyncHandler(async (request, response) => {
  sendSuccess(response, await getXmlDistribution(request.company.id));
}));
dashboardRouter.get("/top-suppliers", asyncHandler(async (request, response) => {
  sendSuccess(response, await getTopSuppliers(request.company.id));
}));
dashboardRouter.get("/latest-documents", asyncHandler(async (request, response) => {
  sendSuccess(response, await getLatestDocuments(request.company.id));
}));
