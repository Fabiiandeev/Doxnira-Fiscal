import { Router } from "express";

import { asyncHandler, sendSuccess } from "../../utils/response.js";
import {
  companyParamsSchema,
  connectionParamsSchema,
  oauthCallbackSchema,
  validate,
  webhookSchema,
} from "./marketplace.schemas.js";
import { marketplaceService } from "./marketplace.service.js";

export const companyMarketplaceRouter = Router({ mergeParams: true });
export const marketplaceOAuthRouter = Router();
export const marketplaceWebhookRouter = Router();

companyMarketplaceRouter.get(
  "/",
  validate(companyParamsSchema),
  asyncHandler(async (request, response) =>
    sendSuccess(response, await marketplaceService.listConnections(request.params.companyId))),
);

companyMarketplaceRouter.get(
  "/mercado-livre/connect",
  validate(companyParamsSchema),
  asyncHandler(async (request, response) =>
    sendSuccess(response, {
      authorizationUrl: marketplaceService.beginMercadoLivreConnection(
        request.params.companyId,
        request.user.id,
      ),
    })),
);

companyMarketplaceRouter.get(
  "/:connectionId",
  validate(connectionParamsSchema),
  asyncHandler(async (request, response) =>
    sendSuccess(response, await marketplaceService.getConnection(
      request.params.companyId,
      request.params.connectionId,
    ))),
);

companyMarketplaceRouter.post(
  "/:connectionId/test",
  validate(connectionParamsSchema),
  asyncHandler(async (request, response) =>
    sendSuccess(response, await marketplaceService.testConnection(
      request.params.companyId,
      request.params.connectionId,
    ))),
);

companyMarketplaceRouter.post(
  "/:connectionId/sync",
  validate(connectionParamsSchema),
  asyncHandler(async (request, response) =>
    sendSuccess(response, await marketplaceService.startSync(
      request.params.companyId,
      request.params.connectionId,
      request.get("idempotency-key") || undefined,
    ), 202)),
);

companyMarketplaceRouter.post(
  "/:connectionId/disconnect",
  validate(connectionParamsSchema),
  asyncHandler(async (request, response) => {
    await marketplaceService.disconnect(request.params.companyId, request.params.connectionId);
    return response.status(204).end();
  }),
);

marketplaceOAuthRouter.get(
  "/callback",
  validate(oauthCallbackSchema, "query"),
  asyncHandler(async (request, response) => {
    const result = await marketplaceService.completeMercadoLivreConnection(
      request.query.code,
      request.query.state,
    );
    return response.redirect(303, result.redirectUrl);
  }),
);

marketplaceWebhookRouter.post(
  "/",
  validate(webhookSchema, "body"),
  asyncHandler(async (request, response) => {
    void marketplaceService.processWebhook(request.body).catch(() => {});
    return response.status(202).json({ accepted: true });
  }),
);
