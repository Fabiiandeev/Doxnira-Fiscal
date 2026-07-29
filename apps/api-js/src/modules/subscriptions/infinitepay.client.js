import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";

export function createInfinitePayClient({ fetchImpl = fetch, config = env } = {}) {
  async function post(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImpl(`${config.INFINITEPAY_API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new AppError("O provedor de pagamento recusou a operação.", "PAYMENT_PROVIDER_ERROR", 502, {
          providerStatus: response.status,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("O provedor de pagamento está indisponível.", "PAYMENT_PROVIDER_UNAVAILABLE", 503);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    createCheckout({ orderNsu, amountCents, description }) {
      if (!config.INFINITEPAY_REDIRECT_URL || !config.INFINITEPAY_WEBHOOK_URL) {
        throw new AppError("Configuração da InfinitePay necessária.", "PAYMENT_CONFIGURATION_REQUIRED", 503);
      }
      return post("/links", {
        handle: config.INFINITEPAY_HANDLE,
        redirect_url: config.INFINITEPAY_REDIRECT_URL,
        webhook_url: config.INFINITEPAY_WEBHOOK_URL,
        order_nsu: orderNsu,
        items: [{ quantity: 1, price: amountCents, description }],
      });
    },
    checkPayment({ orderNsu, transactionNsu, invoiceSlug }) {
      return post("/payment_check", {
        handle: config.INFINITEPAY_HANDLE,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu,
        slug: invoiceSlug,
      });
    },
  };
}

export const infinitePayClient = createInfinitePayClient();
