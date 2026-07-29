import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { checkPaymentSchema, companyIdSchema, createInvoiceSchema, invoiceIdSchema, parse, webhookSchema } from "./subscriptions.schemas.js";
import { subscriptionService } from "./subscriptions.service.js";

export const subscriptionInvoicesRouter = Router();
export const infinitePayWebhookRouter = Router();

function companyId(request) {
  const value = request.get("x-company-id");
  if (!value) throw new AppError("Empresa selecionada necessária.", "COMPANY_REQUIRED", 422);
  return parse(companyIdSchema, value);
}

function blockViewer(request, _response, next) {
  if (request.user?.role === "VIEWER") {
    return next(new AppError("Perfil somente leitura.", "READ_ONLY_ROLE", 403));
  }
  return next();
}

subscriptionInvoicesRouter.use(requireAuth);

subscriptionInvoicesRouter.post("/", rateLimit({ policy: "SENSITIVE_WRITE" }), blockViewer, asyncHandler(async (request, response) => {
  const input = parse(createInvoiceSchema, request.body);
  const selectedCompanyId = companyId(request);
  const invoice = await subscriptionService.createInvoice({
    companyId: selectedCompanyId,
    userId: request.user.id,
    ...input,
  });
  await writeAudit({
    request,
    action: "SUBSCRIPTION_INVOICE_CREATED",
    companyId: selectedCompanyId,
    entityType: "SubscriptionInvoice",
    entityId: invoice.id,
    metadata: { planId: invoice.planId, planPriceId: invoice.planPriceId, amountCents: invoice.amountCents },
  });
  sendSuccess(response, invoice, 201);
}));

subscriptionInvoicesRouter.get("/:invoiceId", asyncHandler(async (request, response) => {
  sendSuccess(response, await subscriptionService.getInvoice(
    parse(invoiceIdSchema, request.params).invoiceId,
    companyId(request),
  ));
}));

subscriptionInvoicesRouter.post("/:invoiceId/checkout", rateLimit({ policy: "SENSITIVE_WRITE" }), blockViewer, asyncHandler(async (request, response) => {
  const selectedCompanyId = companyId(request);
  const invoice = await subscriptionService.createCheckout(
    parse(invoiceIdSchema, request.params).invoiceId,
    selectedCompanyId,
  );
  await writeAudit({
    request,
    action: "CHECKOUT_CREATED",
    companyId: selectedCompanyId,
    entityType: "SubscriptionInvoice",
    entityId: invoice.id,
    metadata: { orderNsu: invoice.orderNsu, amountCents: invoice.amountCents },
  });
  sendSuccess(response, invoice);
}));

subscriptionInvoicesRouter.post("/:invoiceId/check", rateLimit({ policy: "SENSITIVE_WRITE" }), blockViewer, asyncHandler(async (request, response) => {
  const selectedCompanyId = companyId(request);
  const invoiceId = parse(invoiceIdSchema, request.params).invoiceId;
  try {
    const invoice = await subscriptionService.check(invoiceId, selectedCompanyId, parse(checkPaymentSchema, request.body));
    await writeAudit({ request, action: "PAYMENT_CONFIRMED", companyId: selectedCompanyId, entityType: "SubscriptionInvoice", entityId: invoice.id });
    await writeAudit({ request, action: "INVOICE_PAID", companyId: selectedCompanyId, entityType: "SubscriptionInvoice", entityId: invoice.id });
    sendSuccess(response, invoice);
  } catch (error) {
    await writeAudit({
      request,
      action: "PAYMENT_VALIDATION_FAILED",
      companyId: selectedCompanyId,
      entityType: "SubscriptionInvoice",
      entityId: invoiceId,
      metadata: { code: error.code || "PAYMENT_VALIDATION_FAILED" },
    });
    throw error;
  }
}));

infinitePayWebhookRouter.post("/", rateLimit({ policy: "WEBHOOK" }), asyncHandler(async (request, response) => {
  const payload = parse(webhookSchema, request.body);
  const received = await subscriptionService.receiveWebhook(payload);
  if (!received.duplicate) {
    await writeAudit({
      action: "PAYMENT_WEBHOOK_RECEIVED",
      companyId: received.invoice?.subscription?.companyId || null,
      entityType: "SubscriptionInvoice",
      entityId: received.invoice?.id || null,
      metadata: { orderNsu: payload.order_nsu, transactionNsu: payload.transaction_nsu },
    });
    setImmediate(() => {
      subscriptionService.processWebhook(received.event, received.invoice, payload)
        .then(async (invoice) => {
          if (!invoice) return;
          await writeAudit({
            action: "PAYMENT_CONFIRMED",
            companyId: received.invoice.subscription.companyId,
            entityType: "SubscriptionInvoice",
            entityId: invoice.id,
          });
          await writeAudit({
            action: "INVOICE_PAID",
            companyId: received.invoice.subscription.companyId,
            entityType: "SubscriptionInvoice",
            entityId: invoice.id,
          });
        })
        .catch(async (error) => {
          logger.warn({ error, orderNsu: payload.order_nsu }, "InfinitePay webhook validation failed");
          await writeAudit({
            action: "PAYMENT_VALIDATION_FAILED",
            companyId: received.invoice?.subscription?.companyId || null,
            entityType: "SubscriptionInvoice",
            entityId: received.invoice?.id || null,
            metadata: { code: error.code || "PAYMENT_VALIDATION_FAILED" },
          }).catch(() => {});
        });
    });
  }
  response.status(200).json({ success: true, message: null });
}));
