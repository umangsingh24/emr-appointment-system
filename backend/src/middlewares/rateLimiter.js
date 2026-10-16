import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (_req, res) => sendError(res, { statusCode: 429, message, code: 'RATE_LIMITED' }),
  });
}

export const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: 'Too many requests. Please slow down.',
});

/** Strict limit on credential endpoints to slow down brute-force attempts. */
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many login attempts. Please try again later.',
});
