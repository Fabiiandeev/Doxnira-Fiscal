import { request as httpsRequest } from "node:https";

import { AppError } from "../utils/app-error.js";

export function postSoap({ url, action, body, pfx, passphrase, timeoutMs = 30_000 }) {
  const endpoint = new URL(url);
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port || 443,
        path: `${endpoint.pathname}${endpoint.search}`,
        method: "POST",
        pfx,
        passphrase,
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
        timeout: timeoutMs,
        headers: {
          accept: "application/soap+xml, text/xml",
          "content-type": `application/soap+xml; charset=utf-8; action="${action}"`,
          "content-length": Buffer.byteLength(body),
          "user-agent": "NS-Fiscal-Cloud/1.0",
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          if (!response.statusCode || response.statusCode >= 400) {
            reject(
              new AppError(
                "Falha HTTP no serviço fiscal.",
                "SEFAZ_HTTP_ERROR",
                502,
                [{ statusCode: response.statusCode }],
              ),
            );
            return;
          }
          resolve(responseBody);
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", () => {
      reject(
        new AppError(
          "Não foi possível estabelecer conexão segura com o serviço fiscal.",
          "SEFAZ_CONNECTION_ERROR",
          502,
        ),
      );
    });
    request.end(body);
  });
}
