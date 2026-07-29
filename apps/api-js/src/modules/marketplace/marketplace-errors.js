import { AppError } from "../../utils/app-error.js";

export const marketplaceErrorCodes = Object.freeze({
  TOKEN_EXPIRED: "MARKETPLACE_TOKEN_EXPIRED",
  PERMISSION_DENIED: "MARKETPLACE_PERMISSION_DENIED",
  RESOURCE_NOT_FOUND: "MARKETPLACE_RESOURCE_NOT_FOUND",
  RATE_LIMITED: "MARKETPLACE_RATE_LIMITED",
  PROVIDER_UNAVAILABLE: "MARKETPLACE_PROVIDER_UNAVAILABLE",
  CONNECTION_NOT_FOUND: "MARKETPLACE_CONNECTION_NOT_FOUND",
  SYNC_ALREADY_RUNNING: "MARKETPLACE_SYNC_ALREADY_RUNNING",
  OAUTH_STATE_INVALID: "MARKETPLACE_OAUTH_STATE_INVALID",
  OAUTH_STATE_EXPIRED: "MARKETPLACE_OAUTH_STATE_EXPIRED",
});

export class MarketplaceError extends AppError {
  constructor(message, code, statusCode = 502, details = []) {
    super(message, code, statusCode, details);
    this.name = "MarketplaceError";
  }
}
