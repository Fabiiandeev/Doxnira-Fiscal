// apps/api-js/src/types/enums.ts

/**
 * Tipo de identificador da Empresa (UUID).
 */
export type CompanyId = string;

/**
 * Status do Provider no catálogo principal.
 */
export enum ProviderStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  DEGRADED = 'DEGRADED',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED',
  COMING_SOON = 'COMING_SOON',
  SANDBOX = 'SANDBOX', // Estado determinístico de teste
}

/**
 * Tipo de provedor de Marketplace.
 */
export enum MarketplaceProvider {
  MERCADO_LIVRE = 'Mercado Livre',
  SHOPEE = 'Shopee',
  AMAZON = 'Amazon',
  MAGALUIZA = 'Magazine Luiza',
  // ... outros providers
}

/**
 * Status de um Job de Sincronização.
 */
export enum SyncJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED'
}