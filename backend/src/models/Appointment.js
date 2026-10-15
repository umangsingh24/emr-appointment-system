import mongoose from 'mongoose';
import { APPOINTMENT_STATUS } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: ObjectId, ref: 'Patient', required: true },
    doctor: { type: ObjectId, ref: 'User', required: true },
    department: { type: ObjectId, ref: 'Department', required: true },

    // Calendar day in clinic timezone ("YYYY-MM-DD") + minutes since midnight.
    // Strings sort lexicographically in date order, so range queries work on the index.
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    slotStart: { type: Number, required: true, min: 0, max: 1439 },
    slotEnd: { type: Number, required: true, min: 1, max: 1440 },

    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.SCHEDULED,
    },
    /**
     * True while the appointment occupies its slot (i.e. not cancelled).
     * The partial unique index below only covers documents where this is true,
     * which is what lets a cancelled slot be re-booked.
     */
    holdsSlot: { type: Boolean, default: true },

    purpose: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    consultationNotes: { type: String, trim: true, maxlength: 5000 },
    cancellationReason: { type: String, trim: true, maxlength: 500 },

    // Denormalised for list/search screens so they never need a $lookup.
    // Patient name/mobile are effectively immutable for scheduling purposes.
    patientSnapshot: {
      patientCode: { type: String, required: true },
      name: { type: String, required: true },
      searchName: { type: String, required: true },
      mobile: { type: String, required: true },
    },
    doctorSnapshot: {
      name: { type: String, required: true },
      searchName: { type: String, required: true },
    },

    arrivedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    createdBy: { type: ObjectId, ref: 'User', required: true },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// --- Double-booking guard -------------------------------------------------
// MongoDB rejects a second active appointment for the same doctor/day/slot with E11000,
// atomically, regardless of how many API instances race. See ENGINEERING_DECISIONS.md.
appointmentSchema.index(
  { doctor: 1, date: 1, slotStart: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true }, name: 'uniq_active_slot' },
);

// --- Query indexes (ESR: Equality, Sort, Range) ------------------------------
appointmentSchema.index({ doctor: 1, date: 1 }); // slot grid, doctor's day view
appointmentSchema.index({ date: -1, slotStart: 1 }); // default list ordering + date range
appointmentSchema.index({ status: 1, date: -1 });
appointmentSchema.index({ department: 1, date: -1 });
appointmentSchema.index({ patient: 1, date: -1 }); // patient history
appointmentSchema.index({ 'patientSnapshot.mobile': 1 });
appointmentSchema.index({ 'patientSnapshot.searchName': 1 });
appointmentSchema.index({ 'patientSnapshot.patientCode': 1 });
appointmentSchema.index({ 'doctorSnapshot.searchName': 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
