import { REFRESH_COOKIE_NAME } from '../config/constants.js';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { refreshTokenTtlMs } from '../services/token.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

// The refresh token lives in an httpOnly cookie scoped to the auth routes:
// JavaScript cannot read it (XSS-safe) and it is not sent with ordinary API calls.
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProduction || env.COOKIE_SAME_SITE === 'none',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/v1/auth',
};

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...refreshCookieOptions, maxAge: refreshTokenTtlMs() });
}

export async function login(req, res) {
  const { user, accessToken, refreshToken } = await authService.login(req.validated.body, requestContext(req));
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { message: 'Logged in successfully', data: { user, accessToken } });
}

export async function refresh(req, res) {
  const { user, accessToken, refreshToken } = await authService.refresh(
    req.cookies?.[REFRESH_COOKIE_NAME],
    requestContext(req),
  );
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { message: 'Token refreshed', data: { user, accessToken } });
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE_NAME], requestContext(req));
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
  return sendSuccess(res, { message: 'Logged out successfully' });
}

export async function me(req, res) {
  const user = await authService.getProfile(req.user.id);
  return sendSuccess(res, { data: user });
}
