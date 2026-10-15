import { AUDIT_ACTIONS, ROLES } from '../config/constants.js';
import { DoctorSchedule, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/pagination.js';
import { recordAudit } from './audit.service.js';

const DOCTOR_FIELDS = 'name email specialization department';

/** Loads an active doctor or throws 404. Used by every flow that targets a doctor. */
export async function getActiveDoctor(doctorId) {
  const doctor = await User.findOne({ _id: doctorId, role: ROLES.DOCTOR, isActive: true })
    .select(DOCTOR_FIELDS)
    .populate('department', 'name code')
    .lean();
  if (!doctor) throw ApiError.notFound('Doctor');
  return doctor;
}

export function findActiveDoctors({ department, search } = {}) {
  const filter = { role: ROLES.DOCTOR, isActive: true };
  if (department) filter.department = department;
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');

  return User.find(filter).select(DOCTOR_FIELDS).sort({ name: 1 }).populate('department', 'name code').lean();
}

export async function getSchedule(doctorId) {
  await getActiveDoctor(doctorId);
  return DoctorSchedule.findOne({ doctor: doctorId }).lean();
}

export async function upsertSchedule(doctorId, input, actor, context = {}) {
  await getActiveDoctor(doctorId);

  const schedule = await DoctorSchedule.findOneAndUpdate(
    { doctor: doctorId },
    { $set: { ...input, updatedBy: actor.id } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  ).lean();

  recordAudit({
    actor,
    action: AUDIT_ACTIONS.SCHEDULE_UPDATED,
    entity: 'DoctorSchedule',
    entityId: schedule._id,
    metadata: { doctorId },
    ip: context.ip,
  });

  return schedule;
}
