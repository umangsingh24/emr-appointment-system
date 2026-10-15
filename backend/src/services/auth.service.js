import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { RefreshToken, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './audit.service.js';
import {
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './token.service.js';

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation', 10);
const INVALID_CREDENTIALS = 'Invalid email or password';

export function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

async function issueRefreshToken(userId, family, context) {
  const token = signRefreshToken(userId, family);
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    family,
    expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
    userAgent: context.userAgent?.slice(0, 300),
    ip: context.ip,
  });
  return token;
}

/**
 * @param {{ email: string, password: string }} credentials
 * @param {{ ip?: string, userAgent?: string }} context
 */
export async function login({ email, password }, context = {}) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches || !user.isActive) {
    recordAudit({
      actor: user ? { id: user._id, role: user.role } : undefined,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entity: 'User',
      entityId: user?._id,
      metadata: { email },
      ip: context.ip,
    });
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user._id, crypto.randomUUID(), context);

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  recordAudit({
    actor: { id: user._id, role: user.role },
    action: AUDIT_ACTIONS.LOGIN,
    entity: 'User',
    entityId: user._id,
    ip: context.ip,
  });

  return { user: user.toJSON(), accessToken, refreshToken };
}

/**
 * Rotates a refresh token. The old token is revoked atomically, so two concurrent
 * refreshes with the same token cannot both succeed.
 */
export async function refresh(rawToken, context = {}) {
  if (!rawToken) throw ApiError.unauthorized('Refresh token missing');

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(rawToken);
  const consumed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  if (!consumed) {
    const known = await RefreshToken.exists({ tokenHash });
    if (known) {
      // A rotated token was replayed: assume theft and kill every session in this login family.
      await RefreshToken.updateMany({ family: payload.family, revokedAt: null }, { $set: { revokedAt: new Date() } });
      logger.warn({ userId: payload.userId, family: payload.family }, 'Refresh token reuse detected');
      const owner = await User.findById(payload.userId).select('role').lean();
      recordAudit({
        actor: { id: payload.userId, role: owner?.role ?? 'ANONYMOUS' },
        action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
        entity: 'User',
        entityId: payload.userId,
        ip: context.ip,
      });
    }
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(consumed.user);
  if (!user?.isActive) throw ApiError.unauthorized('Account is disabled');

  const refreshToken = await issueRefreshToken(user._id, consumed.family, context);
  await RefreshToken.updateOne({ _id: consumed._id }, { $set: { replacedByHash: hashToken(refreshToken) } });

  return { user: user.toJSON(), accessToken: signAccessToken(user), refreshToken };
}

/**
 * Revokes the session identified by the refresh token. Does not require a valid access
 * token, so a user whose access token already expired can still log out cleanly.
 * Idempotent: unknown or already-revoked tokens still succeed.
 */
export async function logout(rawToken, context = {}) {
  if (!rawToken) return;

  const revoked = await RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).populate('user', 'role');

  if (revoked?.user) {
    recordAudit({
      actor: { id: revoked.user._id, role: revoked.user.role },
      action: AUDIT_ACTIONS.LOGOUT,
      entity: 'User',
      entityId: revoked.user._id,
      ip: context.ip,
    });
  }
}

export async function getProfile(userId) {
  const user = await User.findById(userId).populate('department', 'name code');
  if (!user?.isActive) throw ApiError.unauthorized('Account is disabled');
  return user.toJSON();
}
