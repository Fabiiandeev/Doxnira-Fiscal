import { z } from "zod";

export const companyParamsSchema = z.object({
  companyId: z.string().uuid(),
});

export const connectionParamsSchema = z.object({
  companyId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(20),
});

export const webhookSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  resource: z.string().optional(),
  topic: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  sent: z.string().optional(),
}).passthrough();

export function validate(schema, source = "params") {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      const error = new Error("Parâmetros inválidos.");
      error.code = "VALIDATION_ERROR";
      error.statusCode = 400;
      error.details = result.error.issues;
      return next(error);
    }
    request[source] = result.data;
    return next();
  };
}
