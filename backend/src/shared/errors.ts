/**
 * Application-level error carrying an HTTP status code.
 *
 * Handlers (or a shared wrapper) catch AppError and convert it to the
 * corresponding API Gateway response via {@link toResponse}.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** 400 */
export function badRequestError(message: string, details?: unknown): AppError {
  return new AppError(400, message, details);
}

/** 401 */
export function unauthorizedError(message = 'Unauthorized'): AppError {
  return new AppError(401, message);
}

/** 403 */
export function forbiddenError(message = 'Forbidden'): AppError {
  return new AppError(403, message);
}

/** 404 */
export function notFoundError(message = 'Not Found'): AppError {
  return new AppError(404, message);
}

/** 409 */
export function conflictError(message: string): AppError {
  return new AppError(409, message);
}

/** 422 */
export function validationError(message: string, details?: unknown): AppError {
  return new AppError(422, message, details);
}

/** 500 */
export function serverError(message = 'Internal Server Error'): AppError {
  return new AppError(500, message);
}
