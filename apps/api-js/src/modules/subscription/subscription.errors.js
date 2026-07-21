import { AppError } from "../../utils/app-error.js";
export class SubscriptionError extends AppError { constructor(message, code, statusCode = 409, details = {}) { super(message, code, statusCode, details); this.domain = "subscription"; } }
export class SubscriptionNotFoundError extends SubscriptionError { constructor(details={}) { super("Assinatura não encontrada.", "SUBSCRIPTION_NOT_FOUND", 404, details); } }
export class SubscriptionPlanNotFoundError extends SubscriptionError { constructor(details={}) { super("Plano de assinatura não encontrado.", "SUBSCRIPTION_PLAN_NOT_FOUND", 404, details); } }
export class SubscriptionPriceNotFoundError extends SubscriptionError { constructor(details={}) { super("Preço de assinatura não encontrado.", "SUBSCRIPTION_PRICE_NOT_FOUND", 409, details); } }
export class SubscriptionFeatureNotAvailableError extends SubscriptionError { constructor(details={}) { super("Este recurso não está disponível no plano atual.", "SUBSCRIPTION_FEATURE_NOT_AVAILABLE", 403, details); } }
export class SubscriptionLimitExceededError extends SubscriptionError { constructor(details={}) { super("O limite do plano foi atingido.", "SUBSCRIPTION_LIMIT_EXCEEDED", 409, details); } }
export class SubscriptionInvalidStateError extends SubscriptionError { constructor(details={}) { super("O estado da assinatura não permite esta operação.", "SUBSCRIPTION_INVALID_STATE", 409, details); } }
export class SubscriptionAlreadyActiveError extends SubscriptionError { constructor(details={}) { super("Já existe uma assinatura corrente para esta empresa.", "SUBSCRIPTION_ALREADY_ACTIVE", 409, details); } }
export class SubscriptionChangeNotAllowedError extends SubscriptionError { constructor(details={}) { super("A alteração de plano não é permitida.", "SUBSCRIPTION_CHANGE_NOT_ALLOWED", 409, details); } }
export class SubscriptionUsageConflictError extends SubscriptionError { constructor(details={}) { super("Conflito no registro de uso da assinatura.", "SUBSCRIPTION_USAGE_CONFLICT", 409, details); } }
export class SubscriptionConfigurationError extends SubscriptionError { constructor(details={}) { super("Configuração de assinatura inválida.", "SUBSCRIPTION_CONFIGURATION_ERROR", 500, details); } }
export class SubscriptionBillingProviderError extends SubscriptionError { constructor(details={}) { super("O provider de billing não concluiu a operação.", "BILLING_PROVIDER_ERROR", 502, details); } }
export class SubscriptionIdempotencyConflictError extends SubscriptionError { constructor(details={}) { super("A chave de idempotência foi reutilizada para outra operação.", "SUBSCRIPTION_IDEMPOTENCY_CONFLICT", 409, details); } }
export class SubscriptionConcurrentModificationError extends SubscriptionError { constructor(details={}) { super("A assinatura foi alterada por outra operação concorrente.", "SUBSCRIPTION_CONCURRENT_MODIFICATION", 409, details); } }
