import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../utils/app-error.js";
import { infinitePayClient } from "./infinitepay.client.js";
import { subscriptionRepository } from "./subscriptions.repository.js";

const allowedCaptureMethods = new Set(["pix", "credit_card"]);
const notFound = () => new AppError("Fatura não encontrada.", "INVOICE_NOT_FOUND", 404);

function period(interval, start = new Date()) {
  const end = new Date(start);
  if (interval === "YEARLY") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export function validatePayment(invoice, check, identity) {
  const failures = [];
  if (check.success !== true) failures.push("success");
  if (check.paid !== true) failures.push("paid");
  if (identity.orderNsu !== invoice.orderNsu) failures.push("order_nsu");
  if (!identity.transactionNsu) failures.push("transaction_nsu");
  if (Number(check.amount) !== invoice.amountCents) failures.push("amount");
  if (Number(check.paid_amount) < invoice.amountCents) failures.push("paid_amount");
  if (!allowedCaptureMethods.has(String(check.capture_method))) failures.push("capture_method");
  return failures;
}

export function createSubscriptionService(repository = subscriptionRepository, provider = infinitePayClient) {
  return {
    async createInvoice({ companyId, userId, planId, billingInterval }) {
      const company = await repository.companyForUser(companyId, userId);
      if (!company) throw new AppError("Empresa não encontrada.", "COMPANY_NOT_FOUND", 404);
      const now = new Date();
      const plan = await repository.planWithCurrentPrice(planId, billingInterval, now);
      const price = plan?.prices?.[0];
      if (!plan || !price) throw new AppError("Plano ou preço vigente indisponível.", "PLAN_PRICE_UNAVAILABLE", 409);
      const billingPeriod = period(billingInterval, now);
      return repository.transaction(async (transaction) => {
        let subscription = await transaction.subscriptionForCompany(companyId);
        if (!subscription) {
          subscription = await transaction.createSubscription({
            companyId,
            billingAccountId: companyId,
            planId: plan.id,
            planPriceId: price.id,
            status: "TRIAL",
          });
        }
        return transaction.createInvoice({
          subscriptionId: subscription.id,
          planId: plan.id,
          planPriceId: price.id,
          planCodeSnapshot: plan.code,
          planNameSnapshot: plan.name,
          descriptionSnapshot: plan.checkoutDescription || `Assinatura Doxnira Fiscal - ${plan.name}`,
          amountCents: price.amountCents,
          currency: price.currency,
          orderNsu: randomUUID(),
          status: "PENDING",
          periodStart: billingPeriod.start,
          periodEnd: billingPeriod.end,
          dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        });
      });
    },
    async getInvoice(invoiceId, companyId) {
      const invoice = await repository.invoiceForCompany(invoiceId, companyId);
      if (!invoice) throw notFound();
      return invoice;
    },
    async createCheckout(invoiceId, companyId) {
      const invoice = await repository.invoiceForCompany(invoiceId, companyId);
      if (!invoice) throw notFound();
      if (invoice.status === "PAID") throw new AppError("Fatura já paga.", "INVOICE_ALREADY_PAID", 409);
      if (invoice.checkoutUrl) return invoice;
      const checkout = await provider.createCheckout({
        orderNsu: invoice.orderNsu,
        amountCents: invoice.amountCents,
        description: invoice.descriptionSnapshot,
      });
      if (!checkout?.url) throw new AppError("Resposta inválida do provedor.", "PAYMENT_PROVIDER_INVALID_RESPONSE", 502);
      return repository.updateInvoice(invoice.id, { checkoutUrl: checkout.url, status: "OPEN" });
    },
    async confirm(invoice, identity) {
      if (invoice.status === "PAID") return invoice;
      const check = await provider.checkPayment({
        orderNsu: invoice.orderNsu,
        transactionNsu: identity.transactionNsu,
        invoiceSlug: identity.invoiceSlug,
      });
      const failures = validatePayment(invoice, check, identity);
      if (failures.length) {
        throw new AppError("Pagamento não confirmado pelo provedor.", "PAYMENT_VALIDATION_FAILED", 409, { failures });
      }
      return repository.transaction(async (transaction) => {
        const paidAt = new Date();
        const paid = await transaction.updateInvoice(invoice.id, {
          status: "PAID",
          transactionNsu: identity.transactionNsu,
          invoiceSlug: identity.invoiceSlug,
          receiptUrl: identity.receiptUrl || null,
          captureMethod: check.capture_method,
          paidAmountCents: Number(check.paid_amount),
          paidAt,
        });
        await transaction.activateSubscription(
          invoice.subscriptionId,
          invoice.planId,
          invoice.planPriceId,
          invoice.periodStart,
          invoice.periodEnd,
        );
        return paid;
      });
    },
    async check(invoiceId, companyId, input) {
      const invoice = await repository.invoiceForCompany(invoiceId, companyId);
      if (!invoice) throw notFound();
      const transactionNsu = input.transactionNsu || invoice.transactionNsu;
      const invoiceSlug = input.invoiceSlug || invoice.invoiceSlug;
      if (!transactionNsu || !invoiceSlug) {
        throw new AppError("Identificadores do pagamento necessários.", "PAYMENT_IDENTIFIERS_REQUIRED", 422);
      }
      return this.confirm(invoice, { transactionNsu, invoiceSlug, receiptUrl: input.receiptUrl, orderNsu: invoice.orderNsu });
    },
    fingerprint(payload) {
      return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    },
    async receiveWebhook(payload) {
      const fingerprint = this.fingerprint(payload);
      const previous = await repository.webhookByFingerprint(fingerprint);
      if (previous) return { event: previous, duplicate: true };
      const invoice = await repository.invoiceByOrder(payload.order_nsu);
      let event;
      try {
        event = await repository.registerWebhook({
          fingerprint,
          invoiceId: invoice?.id || null,
          orderNsu: payload.order_nsu,
          transactionNsu: payload.transaction_nsu,
          payload,
          status: invoice ? "RECEIVED" : "REJECTED",
          failureReason: invoice ? null : "INVOICE_NOT_FOUND",
        });
      } catch (error) {
        if (error?.code !== "P2002") throw error;
        return { event: await repository.webhookByFingerprint(fingerprint), duplicate: true };
      }
      return { event, invoice, duplicate: false };
    },
    async processWebhook(event, invoice, payload) {
      if (!invoice || event.status === "PROCESSED") return null;
      try {
        const paid = await this.confirm(invoice, {
          orderNsu: payload.order_nsu,
          transactionNsu: payload.transaction_nsu,
          invoiceSlug: payload.invoice_slug,
          receiptUrl: payload.receipt_url,
        });
        await repository.updateWebhook(event.id, { status: "PROCESSED", processedAt: new Date() });
        return paid;
      } catch (error) {
        await repository.updateWebhook(event.id, {
          status: "FAILED",
          failureReason: error.code || "PAYMENT_VALIDATION_FAILED",
          processedAt: new Date(),
        });
        throw error;
      }
    },
  };
}

export const subscriptionService = createSubscriptionService();
