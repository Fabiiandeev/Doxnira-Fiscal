export class AppError extends Error {
  constructor(message, code = "INTERNAL_ERROR", statusCode = 500, details = [], meta = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    // support legacy callers passing details array as fourth arg
    if (Array.isArray(details)) {
      this.details = details;
      this.cause = meta.cause || null;
      this.field = meta.field || null;
      this.suggestion = meta.suggestion || null;
      this.autoFix = meta.autoFix || { available: false, action: null, label: null };
    } else {
      this.details = details?.details || [];
      this.cause = details?.cause || null;
      this.field = details?.field || null;
      this.suggestion = details?.suggestion || null;
      this.autoFix = details?.autoFix || { available: false, action: null, label: null };
    }
  }
}
