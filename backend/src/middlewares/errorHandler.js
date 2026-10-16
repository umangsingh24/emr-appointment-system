import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/apiResponse.js';

/** Translates known library errors into ApiErrors so clients get a meaningful status. */
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', details);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }
  if (err?.code === 11000) {
    return ApiError.conflict('A record with the same unique value already exists', 'DUPLICATE');
  }
  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON body');
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body too large', { code: 'PAYLOAD_TOO_LARGE' });
  }
  return null;
}

// The 4-argument signature is how Express recognises an error handler.
export function errorHandler(err, req, res, _next) {
  const apiError = normalize(err);

  if (!apiError) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled error');
    return sendError(res, {
      statusCode: 500,
      message: 'Something went wrong. Please try again later.',
      code: 'INTERNAL_ERROR',
      // Never leak internals in production.
      ...(env.isProduction ? {} : { details: { message: err?.message } }),
    });
  }

  if (apiError.statusCode >= 500) logger.error({ err }, apiError.message);
  return sendError(res, {
    statusCode: apiError.statusCode,
    message: apiError.message,
    code: apiError.code,
    details: apiError.details,
  });
}

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`, { code: 'ROUTE_NOT_FOUND' }));
}
