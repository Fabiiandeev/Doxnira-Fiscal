import { Router } from "express";

import { asyncHandler, sendSuccess } from "../../utils/response.js";
import {
  getLatestDocuments,
  getFiscalMonthlyFlow,
  getFiscalSummary,
  getMonthlyFlow,
  getSummary,
  getTopSuppliers,
  getTaxSummary,
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
dashboardRouter.get("/fiscal-summary", asyncHandler(async (request, response) => {
  sendSuccess(response, await getFiscalSummary(request.company.id, request.query));
}));
dashboardRouter.get("/inbound-summary", asyncHandler(async (request, response) => {
  const summary = await getFiscalSummary(request.company.id, request.query);
  sendSuccess(response, { ...summary.inbound, periodYear: summary.periodYear, periodMonth: summary.periodMonth });
}));
dashboardRouter.get("/outbound-summary", asyncHandler(async (request, response) => {
  const summary = await getFiscalSummary(request.company.id, request.query);
  sendSuccess(response, { ...summary.outbound, periodYear: summary.periodYear, periodMonth: summary.periodMonth });
}));
dashboardRouter.get("/cte-summary", asyncHandler(async (request, response) => {
  const summary = await getFiscalSummary(request.company.id, request.query);
  sendSuccess(response, {
    inbound: summary.cteInbound,
    outbound: summary.cteOutbound,
    periodYear: summary.periodYear,
    periodMonth: summary.periodMonth,
  });
}));
dashboardRouter.get("/tax-summary", asyncHandler(async (request, response) => {
  sendSuccess(response, await getTaxSummary(request.company.id, request.query));
}));
dashboardRouter.get("/monthly-tax-flow", asyncHandler(async (request, response) => {
  sendSuccess(response, await getFiscalMonthlyFlow(request.company.id));
}));
