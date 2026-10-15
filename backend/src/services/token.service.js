import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ISSUER = 'emr-appointment-api';

export function signAccessToken(user) {
  return jwt.sign({ role: user.role, name: user.name }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: ISSUER,
    algorithm: 'HS256',
  });
}

/** @returns {{ id: string, role: string, name: string }} */
export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
  return { id: payload.sub, role: payload.role, name: payload.name };
}

export function refreshTokenTtlMs() {
  return env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Refresh tokens are JWTs (so they are self-describing and tamper-evident) but are ALSO
 * tracked server-side by hash, which is what makes revocation on logout possible.
 */
export function signRefreshToken(userId, family) {
  return jwt.sign({ family }, env.JWT_REFRESH_SECRET, {
    subject: String(userId),
    expiresIn: Math.floor(refreshTokenTtlMs() / 1000),
    issuer: ISSUER,
    algorithm: 'HS256',
    jwtid: crypto.randomUUID(), // guarantees uniqueness even when issued in the same second
  });
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
  return { userId: payload.sub, family: payload.family };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
