import pino from "pino";

import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "ns-fiscal-cloud-api",
    environment: env.NODE_ENV,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "request.headers.authorization",
      "request.headers.cookie",
      "response.headers.set-cookie",
      "*.password",
      "*.certificate",
      "*.pfx",
      "*.buffer",
      "*.encryptedFile",
      "*.encryptedPassword",
      "*.xml",
    ],
    censor: "[REDACTED]",
  },
});
