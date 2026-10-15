import { logger } from '../config/logger.js';
import { AuditLog } from '../models/index.js';

/**
 * Records an audit entry without blocking or failing the business operation.
 * The write is awaited only by callers that care (tests); request handlers fire-and-forget.
 *
 * @param {object} entry
 * @param {{ id?: string, role?: string } | undefined} entry.actor
 * @param {string} entry.action
 * @param {string} entry.entity
 * @param {string} [entry.entityId]
 * @param {object} [entry.metadata]
 * @param {string} [entry.ip]
 */
export function recordAudit({ actor, action, entity, entityId, metadata, ip }) {
  return AuditLog.create({
    user: actor?.id,
    role: actor?.role ?? 'ANONYMOUS',
    action,
    entity,
    entityId,
    metadata,
    ip,
  }).catch((err) => {
    logger.error({ err, action, entity, entityId }, 'Failed to write audit log');
  });
}
