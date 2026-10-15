import mongoose from 'mongoose';
import { WEEKDAYS } from '../config/constants.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeRangeSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 50 },
    start: { type: String, required: true, match: TIME_PATTERN },
    end: { type: String, required: true, match: TIME_PATTERN },
  },
  { _id: false },
);

const dayScheduleSchema = new mongoose.Schema(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    sessions: { type: [timeRangeSchema], default: [] },
    breaks: { type: [timeRangeSchema], default: [] },
  },
  { _id: false },
);

/**
 * One document per doctor describing a repeating weekly template.
 * Slots are NOT persisted; they are derived from this template on demand,
 * so changing a schedule never requires rewriting thousands of slot documents.
 */
const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slotDurationMinutes: { type: Number, required: true, min: 5, max: 240 },
    weeklySchedule: { type: [dayScheduleSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

doctorScheduleSchema.index({ doctor: 1 }, { unique: true });

export const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);
