export function notFoundMiddleware(request, response) {
  response.status(404).json({
    error: true,
    message: "Route not found.",
    code: "ROUTE_NOT_FOUND",
    details: [],
    requestId: request.id,
  });
}
