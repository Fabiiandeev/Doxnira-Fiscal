import { AppError } from "../utils/app-error.js";

export function validate(schema, source = "body") {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      return next(
        new AppError(
          "Dados inválidos.",
          "VALIDATION_ERROR",
          422,
          result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
    }
    request[source] = result.data;
    next();
  };
}
