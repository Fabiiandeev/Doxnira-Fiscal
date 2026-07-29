import cors from "cors";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import { requireCompanyAccess } from "./middlewares/company-access.middleware.js";
import { requireAccountantCompanyAccess } from "./middlewares/accountant-company-access.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { rateLimit } from "./middlewares/rate-limit.middleware.js";
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
import { clientesRouter, clientesPublicRouter, customersRouter } from "./modules/clients/clients.routes.js";
import { productsRouter, productsStandaloneRouter } from "./modules/products/products.routes.js";
import { operationRouter } from "./modules/operation/operation.routes.js";
import { cfopsRouter } from "./modules/cfops/cfops.routes.js";
import { accountantRouter } from "./modules/accountant/accountant.routes.js";
import { accountantOfficeRouter } from "./modules/accountant/accountant-office.routes.js";
import { accountantDocumentsRouter } from "./modules/accountant/accountant-documents.routes.js";
import { accountantMonthlyClosingRouter } from "./modules/accountant/accountant-monthly-closing.routes.js";
import { fiscalBookPreparationRouter } from "./modules/accountant/fiscal-book-preparation.routes.js";
import { fiscalExportRouter } from "./modules/accountant/fiscal-export.routes.js";
import { companyDocumentRequestsRouter } from "./modules/accountant/company-document-requests.routes.js";
import { transportadorasRouter } from "./modules/transportadoras/transportadoras.routes.js";
import { nfeValidationRouter } from "./modules/nfe-validation/nfe-validation.routes.js";
import { fornecedoresRouter } from "./modules/fornecedores/fornecedores.routes.js";
import { nfeRouter } from "./modules/nfe/nfe.routes.js";
import { cteEntryRouter, nfeEntryRouter } from "./modules/nfe-entry/nfe-entry.routes.js";
import {
  companyMarketplaceRouter,
  marketplaceOAuthRouter,
  marketplaceWebhookRouter,
} from "./modules/marketplace/marketplace.routes.js";
import { marketingRouter } from "./modules/marketing/marketing.routes.js";
import { intelligenceRouter } from "./modules/intelligence/intelligence.routes.js";
import { fiscalAiRouter } from "./modules/fiscal-ai/fiscal-ai.routes.js";
import { servicesRouter } from "./modules/services/services.routes.js";
import { fiscalEmissionRouter } from "./modules/fiscal-emission/fiscal-emission.routes.js";
import { fiscalOpsRouter } from "./modules/fiscal-ops/fiscal-ops.routes.js";
import { mdfeRouter } from "./modules/mdfe/mdfe.routes.js";
import { fiscalComplianceRouter } from "./modules/fiscal-compliance/fiscal-compliance.routes.js";
import { financialRouter } from "./modules/financial/financial.routes.js";
import { commerceRouter } from "./modules/commerce/commerce.routes.js";
import { marketplaceOperationsRouter } from "./modules/marketplace/marketplace-operations.routes.js";
import { shopeeCallbackRouter, shopeeCompanyRouter } from "./modules/marketplace/shopee.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { platformPlansRouter, publicPlansRouter, subscriptionPlansRouter } from "./modules/plans/plans.routes.js";
import { infinitePayWebhookRouter, subscriptionInvoicesRouter } from "./modules/subscriptions/subscriptions.routes.js";

export const app = express();
const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.includes(origin)) return true;
  return false;
}

app.disable("x-powered-by");
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

app.use(requestIdMiddleware);
app.use(rateLimit({ policy: "GENERAL_API" }));
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
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-csrf-token", "x-company-id", "x-accountant-office-id", "x-accountant-context", "x-request-id"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api/health", healthRouter);
app.use("/api/public/marketing", marketingRouter);
app.use("/api/public/subscription-plans", publicPlansRouter);
app.use("/api/auth", authRouter);
app.use("/api/subscription/plans", subscriptionPlansRouter);
app.use("/api/subscription/invoices", subscriptionInvoicesRouter);
app.use("/api/webhooks/infinitepay", infinitePayWebhookRouter);
app.use("/api/platform/plans", platformPlansRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/marketplaces/shopee", rateLimit({ policy: "EXTERNAL_CALLBACK" }), shopeeCallbackRouter);
app.use("/api/empresas", empresasRouter);
app.use("/api/companies", companiesRouter);

const companyApiRouter = express.Router({ mergeParams: true });
companyApiRouter.use(requireAuth);
companyApiRouter.use("/:companyId", requireCompanyAccess);
companyApiRouter.use("/:companyId/dashboard", dashboardRouter);
companyApiRouter.use("/:companyId/intelligence", intelligenceRouter);
companyApiRouter.use("/:companyId/fiscal-ai", rateLimit({ policy: "AI_PROVIDER" }), fiscalAiRouter);
companyApiRouter.use("/:companyId/services", servicesRouter);
companyApiRouter.use("/:companyId/fiscal-emission", fiscalEmissionRouter);
companyApiRouter.use("/:companyId/fiscal-ops", fiscalOpsRouter);
companyApiRouter.use("/:companyId/mdfe", mdfeRouter);
companyApiRouter.use("/:companyId/fiscal-compliance", fiscalComplianceRouter);
companyApiRouter.use("/:companyId/financial", rateLimit({ policy: "SENSITIVE_WRITE" }), financialRouter);
companyApiRouter.use("/:companyId/commerce", commerceRouter);
companyApiRouter.use("/:companyId/marketplaces", marketplaceOperationsRouter);
companyApiRouter.use("/:companyId/marketplaces", shopeeCompanyRouter);
companyApiRouter.use("/:companyId/operation", operationRouter);
companyApiRouter.use("/:companyId/settings", rateLimit({ policy: "SENSITIVE_WRITE" }), settingsRouter);
companyApiRouter.use("/:companyId/documents", documentsRouter);
companyApiRouter.use("/:companyId/sync", syncRouter);
// Company API Scope Router Mounts
companyApiRouter.use("/:companyId/commerce/marketplaces", companyMarketplaceRouter);
app.use("/api/commerce/marketplaces/mercado-livre", rateLimit({ policy: "EXTERNAL_CALLBACK" }), marketplaceOAuthRouter);
app.use("/api/webhooks/marketplaces/mercado-livre", rateLimit({ policy: "WEBHOOK" }), express.json({ limit: "256kb" }), marketplaceWebhookRouter);
companyApiRouter.use("/:companyId/certificate", rateLimit({ policy: "SENSITIVE_WRITE" }), certificatesRouter);
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
app.use("/api/customers", customersRouter);
app.use("/api/products", productsStandaloneRouter);
companyApiRouter.use("/:companyId/clientes", clientesRouter);
companyApiRouter.use("/:companyId/clients", clientesRouter);
companyApiRouter.use("/:companyId/cfops", cfopsRouter);
companyApiRouter.use("/:companyId/products", productsRouter);
companyApiRouter.use("/:companyId/transportadoras", transportadorasRouter);
companyApiRouter.use("/:companyId/fornecedores", fornecedoresRouter);
companyApiRouter.use("/:companyId/nfe-validation", nfeValidationRouter);
companyApiRouter.use("/:companyId/nfe", nfeRouter);
companyApiRouter.use("/:companyId/nfe-entry", nfeEntryRouter);
companyApiRouter.use("/:companyId/cte-entry", cteEntryRouter);
companyApiRouter.use("/:companyId", companyDocumentRequestsRouter);

app.use("/api/accountant/companies/:companyId", requireAuth, requireAccountantCompanyAccess, accountantDocumentsRouter);
app.use("/api/accountant/companies/:companyId", requireAuth, requireAccountantCompanyAccess, accountantMonthlyClosingRouter);
app.use("/api/accountant/companies/:companyId", requireAuth, requireAccountantCompanyAccess, fiscalBookPreparationRouter);
app.use("/api/accountant/companies/:companyId", requireAuth, requireAccountantCompanyAccess, fiscalExportRouter);
app.use("/api/accountant", requireAuth, accountantRouter);
app.use("/api/accountant/offices/:officeId", requireAuth, accountantOfficeRouter);

app.use("/api/cfops", requireAuth, cfopsRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
