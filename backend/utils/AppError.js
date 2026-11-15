/**
 * Operational error with an HTTP status and a stable `code` (translated by
 * the clients). Thrown from services, rendered by the error handler.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(message, code = "BAD_REQUEST") {
    return new AppError(message, 400, code);
  }

  static notFound(message = "Tapılmadı", code = "NOT_FOUND") {
    return new AppError(message, 404, code);
  }

  static conflict(message, code = "CONFLICT") {
    return new AppError(message, 409, code);
  }

  static unauthorized(message = "Avtorizasiya tələb olunur", code = "AUTH_REQUIRED") {
    return new AppError(message, 401, code);
  }

  static forbidden(message = "Bu əməliyyat üçün icazəniz yoxdur", code = "FORBIDDEN") {
    return new AppError(message, 403, code);
  }
}

export { AppError };
