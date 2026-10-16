import mongoose from 'mongoose';
import { AUDIT_ACTIONS, ROLES } from '../config/constants.js';

/** Append-only record of security- and business-relevant actions. */
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: [...Object.values(ROLES), 'ANONYMOUS'], required: true },
    action: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
