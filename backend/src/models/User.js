import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // Never returned by default; auth code opts in explicitly with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    // Only meaningful for doctors.
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    specialization: { type: String, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.index({ email: 1 }, { unique: true });
// Doctor listing: GET /doctors?department=...
userSchema.index({ role: 1, department: 1, isActive: 1 });

export const User = mongoose.model('User', userSchema);
