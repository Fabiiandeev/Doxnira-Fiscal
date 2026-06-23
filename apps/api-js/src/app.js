import cors from "cors";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import { requireCompanyAccess } from "./middlewares/company-access.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { alertsRouter } from "./modules/alerts/alerts.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { certificatesRouter } from "./modules/certificates/certificates.routes.js";
import {
  companiesRouter,
  empresasRouter,
} from "./modules/companies/companies.routes.js";
import { cteRouter } from "./modules/cte/cte.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { manifestationsRouter } from "./modules/manifestations/manifestations.routes.js";
import { monthlyClosingRouter } from "./modules/monthly-closing/monthly-closing.routes.js";
import { preferencesRouter } from "./modules/preferences/preferences.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { syncRouter } from "./modules/sync/sync.routes.js";
import { taxSettingsRouter } from "./modules/tax-settings/tax-settings.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { clientesRouter, clientesPublicRouter } from "./modules/clients/clients.routes.js";

export const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

app.disable("x-powered-by");

app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    genReqId: (request) => request.id,
    customProps: (request) => ({ requestId: request.id }),
  }),
);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/empresas", empresasRouter);
app.use("/api/companies", companiesRouter);

const companyApiRouter = express.Router({ mergeParams: true });
companyApiRouter.use(requireAuth);
companyApiRouter.use("/:companyId", requireCompanyAccess);
companyApiRouter.use("/:companyId/dashboard", dashboardRouter);
companyApiRouter.use("/:companyId/documents", documentsRouter);
companyApiRouter.use("/:companyId/sync", syncRouter);
companyApiRouter.use("/:companyId/certificate", certificatesRouter);
companyApiRouter.use("/:companyId/cte", cteRouter);
companyApiRouter.use("/:companyId/alerts", alertsRouter);
companyApiRouter.use("/:companyId/tax-settings", taxSettingsRouter);
companyApiRouter.use("/:companyId/monthly-closing", monthlyClosingRouter);
companyApiRouter.use("/:companyId/reports", reportsRouter);
companyApiRouter.use(
  "/:companyId/documents/:documentId/manifest",
  manifestationsRouter,
);
app.use("/api/companies", companyApiRouter);

// Clientes public and company-scoped routes
app.use("/api/clientes", clientesPublicRouter);
companyApiRouter.use("/:companyId/clientes", clientesRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
