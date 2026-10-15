/**
 * Operational error with an HTTP status. Anything thrown that is NOT an ApiError
 * is treated as a programmer error and surfaced to clients as a generic 500.
 */
export class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, `${resource} not found`, { code: 'NOT_FOUND' });
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, message, { code });
  }

  static unprocessable(message, code = 'UNPROCESSABLE') {
    return new ApiError(422, message, { code });
  }
}
