export function sendSuccess(response, data, statusCode = 200) {
  return response.status(statusCode).json(data);
}

export function asyncHandler(handler) {
  return (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);
}
