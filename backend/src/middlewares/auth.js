import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/token.service.js';

/** Requires a valid `Authorization: Bearer <accessToken>` header and attaches `req.user`. */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    // Same message for expired and tampered tokens; the client simply refreshes.
    return next(ApiError.unauthorized('Invalid or expired access token'));
  }
}

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}
