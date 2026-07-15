import { Router } from "express";

import { prisma } from "../../config/prisma.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";

export const accountantRouter = Router({ mergeParams: true });

accountantRouter.get(
  "/companies",
  asyncHandler(async (request, response) => {
    const memberships = await prisma.accountantMembership.findMany({
      where: { userId: request.user.id, status: "ACTIVE" },
      select: {
        officeId: true,
        office: { select: { id: true, name: true } },
        companyAccesses: {
          where: { revokedAt: null, company: { status: { not: "deleted" } } },
          select: {
            accessLevel: true,
            company: { select: { id: true, legalName: true, tradeName: true, cnpj: true } },
          },
        },
      },
    });
    const data = [];
    for (const membership of memberships) {
      const activeLinks = await prisma.accountantCompanyLink.findMany({
        where: { officeId: membership.officeId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { companyId: true },
      });
      const linkedIds = new Set(activeLinks.map((link) => link.companyId));
      membership.companyAccesses.forEach((access) => {
        if (linkedIds.has(access.company.id)) data.push({ office: membership.office, accessLevel: access.accessLevel, company: access.company });
      });
    }
    sendSuccess(response, { data });
  }),
);

accountantRouter.get(
  "/risk-ranking",
  asyncHandler(async (request, response) => {
    const ownerId = request.user.id;
    const companies = await prisma.company.findMany({
      where: { ownerId, status: { not: "deleted" } },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        cnpj: true,
        uf: true,
        createdAt: true,
        alerts: {
          where: { status: "open" },
          select: { id: true, type: true, severity: true, title: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        taxSettings: {
          select: { taxRegime: true, uf: true },
        },
        fiscalDocuments: {
          _count: { where: { isCancelled: true } },
        },
      },
    });

    const result = companies.map((company) => {
      const openAlerts = company.alerts.length;
      const criticalAlerts = company.alerts.filter((a) => a.severity === "critical").length;
      const hasCritical = criticalAlerts > 0;
      const hasHigh = company.alerts.some((a) => a.severity === "high");

      let score = 100;
      score -= criticalAlerts * 25;
      score -= (openAlerts - criticalAlerts) * 10;
      score -= (company.fiscalDocuments._count || 0) * 5;
      score = Math.max(0, Math.min(100, score));

      let riskLevel = "VERY_LOW";
      if (score < 30) riskLevel = "CRITICAL";
      else if (score < 50) riskLevel = "HIGH";
      else if (score < 70) riskLevel = "MEDIUM";
      else if (score < 90) riskLevel = "LOW";

      const mainIssue = company.alerts[0]?.title ?? "Nenhuma pendencia critica";
      const financialImpact = hasCritical ? 125000 : hasHigh ? 42000 : openAlerts > 0 ? 18700 : 0;

      let trend = "STABLE";
      const recentAlerts = company.alerts.filter((a) => {
        const d = new Date(a.createdAt);
        const diff = Date.now() - d.getTime();
        return diff < 7 * 86400000;
      });
      if (recentAlerts.length > 2) trend = "WORSENING";
      else if (openAlerts === 0) trend = "IMPROVING";

      const actionPlan = company.alerts.slice(0, 5).map((alert, idx) => ({
        id: `ap-${company.id}-${idx}`,
        description: alert.title,
        priority: alert.severity === "critical" ? "CRITICAL" : alert.severity === "high" ? "HIGH" : alert.severity === "medium" ? "MEDIUM" : "LOW",
        responsible: alert.type?.includes("CERTIFICATE") ? "ACCOUNTANT" : "SYSTEM",
        deadline: new Date(Date.now() + (idx + 1) * 7 * 86400000).toISOString().split("T")[0],
        completed: false,
      }));

      return {
        id: company.id,
        name: company.tradeName || company.legalName,
        score,
        riskLevel,
        mainIssue,
        financialImpact,
        action: hasCritical ? "Acao imediata" : hasHigh ? "Atencao necessaria" : "Monitorar",
        trend,
        actionPlan,
        lastEventDate: company.alerts[0]?.createdAt ?? company.createdAt.toISOString(),
      };
    });

    const summary = {
      critical: result.filter((c) => c.riskLevel === "CRITICAL").length,
      high: result.filter((c) => c.riskLevel === "HIGH").length,
      medium: result.filter((c) => c.riskLevel === "MEDIUM").length,
      low: result.filter((c) => c.riskLevel === "LOW").length,
      veryLow: result.filter((c) => c.riskLevel === "VERY_LOW").length,
    };

    sendSuccess(response, { companies: result, summary });
  }),
);

accountantRouter.get(
  "/work-queue",
  asyncHandler(async (request, response) => {
    const ownerId = request.user.id;
    const { column } = request.query;

    const alerts = await prisma.alert.findMany({
      where: {
        company: { ownerId, status: { not: "deleted" } },
        status: "open",
        ...(column ? { severity: column.toLowerCase() } : {}),
      },
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        createdAt: true,
        company: { select: { id: true, legalName: true, tradeName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = alerts.map((alert) => {
      let col = "MEDIUM";
      if (alert.severity === "critical") col = "CRITICAL";
      else if (alert.severity === "high") col = "HIGH";
      else if (alert.severity === "low" || alert.severity === "info") col = "RESOLVED";

      const actions = [];
      if (alert.type?.includes("CERTIFICATE")) actions.push("ASSIGN_ACCOUNTANT", "REQUEST_CLIENT");
      else if (alert.type?.includes("NCM") || alert.type?.includes("PRODUCT")) actions.push("AUTO_FIX", "IGNORE", "MARK_RESOLVED");
      else actions.push("ASSIGN_ACCOUNTANT", "REQUEST_CLIENT", "MARK_RESOLVED");

      return {
        id: alert.id,
        companyId: alert.company.id,
        companyName: alert.company.tradeName || alert.company.legalName,
        problem: alert.title,
        responsible: actions.includes("ASSIGN_ACCOUNTANT") ? "ACCOUNTANT" : "SYSTEM",
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        financialImpact: alert.severity === "critical" ? 125000 : alert.severity === "high" ? 42000 : 18700,
        status: "OPEN",
        column: col,
        actions,
      };
    });

    sendSuccess(response, items);
  }),
);

accountantRouter.patch(
  "/work-queue/:id",
  asyncHandler(async (request, response) => {
    const alertId = request.params.id;
    const updates = request.body || {};

    if (updates.status === "RESOLVED" || updates.column === "RESOLVED") {
      const updated = await prisma.alert.update({
        where: { id: alertId },
        data: { status: "resolved", resolvedAt: new Date() },
      });
      sendSuccess(response, updated);
    } else if (updates.status === "IGNORED") {
      const updated = await prisma.alert.update({
        where: { id: alertId },
        data: { status: "resolved", resolvedAt: new Date() },
      });
      sendSuccess(response, updated);
    } else {
      sendSuccess(response, { id: alertId, ...updates });
    }
  }),
);

accountantRouter.get(
  "/client-requests",
  asyncHandler(async (request, response) => {
    sendSuccess(response, []);
  }),
);

accountantRouter.post(
  "/client-requests",
  asyncHandler(async (request, response) => {
    const payload = request.body || {};
    const newRequest = {
      id: `req-${Date.now()}`,
      companyId: payload.companyId || "",
      companyName: payload.companyName || "",
      message: payload.message || "",
      channels: payload.channels || [],
      status: "SENT",
      sentAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
    sendSuccess(response, newRequest, 201);
  }),
);

accountantRouter.patch(
  "/client-requests/:id/status",
  asyncHandler(async (request, response) => {
    const { status } = request.body || {};
    sendSuccess(response, { id: request.params.id, status, updatedAt: new Date().toISOString() });
  }),
);

accountantRouter.post(
  "/client-requests/:id/resend",
  asyncHandler(async (request, response) => {
    const { channels } = request.body || {};
    sendSuccess(response, {
      id: request.params.id,
      channels: channels || [],
      status: "SENT",
      sentAt: new Date().toISOString(),
    });
  }),
);

accountantRouter.patch(
  "/action-plan/:planItemId/complete",
  asyncHandler(async (request, response) => {
    const ownerId = request.user.id;
    const companies = await prisma.company.findMany({
      where: { ownerId, status: { not: "deleted" } },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        alerts: {
          where: { status: "open" },
          select: { id: true, type: true, severity: true, title: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    const result = companies.map((company) => {
      const actionPlan = company.alerts.slice(0, 5).map((alert, idx) => {
        const planId = `ap-${company.id}-${idx}`;
        return {
          id: planId,
          description: alert.title,
          priority: alert.severity === "critical" ? "CRITICAL" : "HIGH",
          responsible: "ACCOUNTANT",
          deadline: new Date(Date.now() + (idx + 1) * 7 * 86400000).toISOString().split("T")[0],
          completed: planId === request.params.planItemId,
        };
      });

      return {
        id: company.id,
        name: company.tradeName || company.legalName,
        score: 50,
        riskLevel: "MEDIUM",
        mainIssue: company.alerts[0]?.title ?? "Nenhuma pendencia",
        financialImpact: 0,
        action: "Monitorar",
        trend: "STABLE",
        actionPlan,
        lastEventDate: new Date().toISOString(),
      };
    });

    const summary = {
      critical: result.filter((c) => c.riskLevel === "CRITICAL").length,
      high: result.filter((c) => c.riskLevel === "HIGH").length,
      medium: result.filter((c) => c.riskLevel === "MEDIUM").length,
      low: result.filter((c) => c.riskLevel === "LOW").length,
      veryLow: result.filter((c) => c.riskLevel === "VERY_LOW").length,
    };

    sendSuccess(response, { companies: result, summary });
  }),
);
