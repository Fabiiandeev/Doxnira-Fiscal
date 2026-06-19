import { randomUUID } from "node:crypto";

export function requestIdMiddleware(request, response, next) {
  const requestId = request.get("x-request-id") || randomUUID();

  request.id = requestId;
  response.setHeader("x-request-id", requestId);

  next();
}
