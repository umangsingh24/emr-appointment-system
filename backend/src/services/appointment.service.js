import {
  APPOINTMENT_STATUS,
  AUDIT_ACTIONS,
  ROLES,
  SOCKET_EVENTS,
  STATUS_TRANSITIONS,
} from '../config/constants.js';
import { Appointment, Patient } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { domainEvents } from '../utils/events.js';
import { buildPagination, buildSort, escapeRegex, paginationMeta } from '../utils/pagination.js';
import { clinicNow, minutesToTime, timeToMinutes } from '../utils/time.js';
import { withTransaction } from '../utils/transaction.js';
import { recordAudit } from './audit.service.js';
import { getActiveDoctor } from './doctor.service.js';
import { auditPatientCreated, getPatientById, insertPatient } from './patient.service.js';
import { assertBookableSlot } from './slot.service.js';

const { SCHEDULED, ARRIVED, COMPLETED, CANCELLED } = APPOINTMENT_STATUS;

const LIST_PROJECTION =
  'patient doctor department date slotStart slotEnd status purpose patientSnapshot.patientCode ' +
  'patientSnapshot.name patientSnapshot.mobile doctorSnapshot.name createdAt updatedAt';

const SORTABLE_FIELDS = {
  date: 'date',
  slotStart: 'slotStart',
  status: 'status',
  createdAt: 'createdAt',
  patientName: 'patientSnapshot.searchName',
  doctorName: 'doctorSnapshot.searchName',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Doctors can only ever see their own appointments; enforced in every query. */
function ownershipFilter(actor) {
  return actor.role === ROLES.DOCTOR ? { doctor: actor.id } : {};
}

function present(appointment) {
  if (!appointment) return appointment;
  const { patientSnapshot, doctorSnapshot, ...rest } = appointment;
  return {
    ...rest,
    slotStartTime: minutesToTime(appointment.slotStart),
    slotEndTime: minutesToTime(appointment.slotEnd),
    patientSnapshot: patientSnapshot && {
      patientCode: patientSnapshot.patientCode,
      name: patientSnapshot.name,
      mobile: patientSnapshot.mobile,
    },
    doctorSnapshot: doctorSnapshot && { name: doctorSnapshot.name },
  };
}

function isSlotConflict(err) {
  return err?.code === 11000 && (err.keyPattern?.slotStart || String(err.message).includes('uniq_active_slot'));
}

/** Publishes a minimal, PHI-free event; clients refetch what they are allowed to see. */
function publish(event, appointment) {
  domainEvents.emit('appointment', {
    event,
    payload: {
      appointmentId: String(appointment._id),
      doctorId: String(appointment.doctor?._id ?? appointment.doctor),
      departmentId: String(appointment.department?._id ?? appointment.department),
      date: appointment.date,
      slotStart: minutesToTime(appointment.slotStart),
      status: appointment.status,
    },
  });
}

async function findScoped(id, actor) {
  const appointment = await Appointment.findOne({ _id: id, ...ownershipFilter(actor) }).lean();
  // 404 (not 403) for other doctors' appointments, so existence is not leaked.
  if (!appointment) throw ApiError.notFound('Appointment');
  return appointment;
}

/**
 * Applies an update only if the document is still in the status we validated against
 * (optimistic concurrency). Prevents e.g. "arrive" and "cancel" racing each other.
 */
async function applyGuardedUpdate(current, update) {
  const updated = await Appointment.findOneAndUpdate({ _id: current._id, status: current.status }, update, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('department', 'name code')
    .lean();
  if (!updated) {
    throw ApiError.conflict('Appointment was modified by another user. Please refresh and try again.', 'STALE_APPOINTMENT');
  }
  return updated;
}

function assertTransition(from, to) {
  if (!STATUS_TRANSITIONS[from]?.includes(to)) {
    throw ApiError.unprocessable(`Cannot change appointment status from ${from} to ${to}`, 'INVALID_STATUS_TRANSITION');
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function createAppointment(input, actor, context = {}) {
  const doctor = await getActiveDoctor(input.doctorId);
  if (!doctor.department) throw ApiError.unprocessable('Doctor is not assigned to a department', 'DOCTOR_NO_DEPARTMENT');

  const slot = await assertBookableSlot(doctor._id, input.date, timeToMinutes(input.slotStart));
  const existingPatient = input.patientId ? await getPatientById(input.patientId) : null;

  let newPatient = null;
  let appointment;

  try {
    appointment = await withTransaction(async (session) => {
      newPatient = existingPatient ? null : await insertPatient(input.newPatient, actor, session);
      const patient = existingPatient ?? newPatient;

      try {
        const [created] = await Appointment.create(
          [
            {
              patient: patient._id,
              doctor: doctor._id,
              department: doctor.department._id,
              date: input.date,
              slotStart: slot.start,
              slotEnd: slot.end,
              purpose: input.purpose,
              notes: input.notes,
              patientSnapshot: {
                patientCode: patient.patientCode,
                name: patient.name,
                searchName: patient.name.toLowerCase(),
                mobile: patient.mobile,
              },
              doctorSnapshot: { name: doctor.name, searchName: doctor.name.toLowerCase() },
              createdBy: actor.id,
            },
          ],
          { session },
        );
        return created;
      } catch (err) {
        // Without a transaction (standalone MongoDB) compensate manually so no orphan patient is left behind.
        if (!session && newPatient) await Patient.deleteOne({ _id: newPatient._id });
        throw err;
      }
    });
  } catch (err) {
    if (isSlotConflict(err)) {
      throw ApiError.conflict('This slot has just been booked by someone else. Please choose another slot.', 'SLOT_ALREADY_BOOKED');
    }
    throw err;
  }

  // Side effects only after the write is durable.
  if (newPatient) auditPatientCreated(newPatient, actor, context);
  recordAudit({
    actor,
    action: AUDIT_ACTIONS.APPOINTMENT_CREATED,
    entity: 'Appointment',
    entityId: appointment._id,
    metadata: { doctorId: String(doctor._id), date: input.date, slotStart: input.slotStart },
    ip: context.ip,
  });
  publish(SOCKET_EVENTS.APPOINTMENT_CREATED, appointment);

  return getAppointment(appointment._id, actor);
}

export async function updateAppointment(id, changes, actor, context = {}) {
  const current = await findScoped(id, actor);
  const isDoctor = actor.role === ROLES.DOCTOR;

  // Front desk edits logistics; only the treating doctor writes clinical notes.
  const allowedFields = isDoctor ? ['consultationNotes'] : ['purpose', 'notes'];
  const forbidden = Object.keys(changes).filter((field) => changes[field] !== undefined && !allowedFields.includes(field));
  if (forbidden.length) throw ApiError.forbidden(`You cannot update: ${forbidden.join(', ')}`);

  const editableStatuses = isDoctor ? [ARRIVED, COMPLETED] : [SCHEDULED, ARRIVED];
  if (!editableStatuses.includes(current.status)) {
    throw ApiError.unprocessable(`A ${current.status.toLowerCase()} appointment cannot be edited`, 'APPOINTMENT_LOCKED');
  }

  const set = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
  const updated = await applyGuardedUpdate(current, { $set: { ...set, updatedBy: actor.id } });

  recordAudit({
    actor,
    action: AUDIT_ACTIONS.APPOINTMENT_UPDATED,
    entity: 'Appointment',
    entityId: updated._id,
    metadata: { fields: Object.keys(set) },
    ip: context.ip,
  });
  publish(SOCKET_EVENTS.APPOINTMENT_UPDATED, updated);
  return present(updated);
}

const TRANSITIONS = {
  [ARRIVED]: { action: AUDIT_ACTIONS.APPOINTMENT_ARRIVED, event: SOCKET_EVENTS.APPOINTMENT_UPDATED, timestamp: 'arrivedAt' },
  [COMPLETED]: { action: AUDIT_ACTIONS.APPOINTMENT_COMPLETED, event: SOCKET_EVENTS.APPOINTMENT_UPDATED, timestamp: 'completedAt' },
  [CANCELLED]: { action: AUDIT_ACTIONS.APPOINTMENT_CANCELLED, event: SOCKET_EVENTS.APPOINTMENT_CANCELLED, timestamp: 'cancelledAt' },
};

async function changeStatus(id, to, actor, context = {}, { extraSet = {}, validate } = {}) {
  const current = await findScoped(id, actor);
  assertTransition(current.status, to);
  validate?.(current);

  const { action, event, timestamp } = TRANSITIONS[to];
  const updated = await applyGuardedUpdate(current, {
    $set: { status: to, [timestamp]: new Date(), updatedBy: actor.id, ...extraSet },
  });

  recordAudit({
    actor,
    action,
    entity: 'Appointment',
    entityId: updated._id,
    metadata: { from: current.status, to },
    ip: context.ip,
  });
  publish(event, updated);
  return present(updated);
}

export function markArrived(id, actor, context) {
  return changeStatus(id, ARRIVED, actor, context, {
    validate: (appointment) => {
      if (appointment.date > clinicNow().date) {
        throw ApiError.unprocessable('A patient cannot be marked as arrived for a future appointment', 'APPOINTMENT_IN_FUTURE');
      }
    },
  });
}

export function markCompleted(id, actor, context) {
  return changeStatus(id, COMPLETED, actor, context);
}

/** Soft cancel: the record is kept for history, and `holdsSlot: false` frees the slot for re-booking. */
export function cancelAppointment(id, { reason } = {}, actor, context) {
  return changeStatus(id, CANCELLED, actor, context, {
    extraSet: { holdsSlot: false, ...(reason ? { cancellationReason: reason } : {}) },
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAppointment(id, actor) {
  const appointment = await Appointment.findOne({ _id: id, ...ownershipFilter(actor) })
    .populate('patient', 'patientCode name mobile email gender dateOfBirth address')
    .populate('department', 'name code')
    .populate('doctor', 'name specialization')
    .lean();
  if (!appointment) throw ApiError.notFound('Appointment');
  return present(appointment);
}

function prefix(value) {
  return new RegExp(`^${escapeRegex(value.toLowerCase())}`);
}

function buildListFilter(query, actor) {
  const filter = {};

  if (query.doctorId) filter.doctor = query.doctorId;
  if (query.departmentId) filter.department = query.departmentId;
  if (query.patientId) filter.patient = query.patientId;
  if (query.status?.length) filter.status = { $in: query.status };

  if (query.dateFrom || query.dateTo) {
    filter.date = {};
    if (query.dateFrom) filter.date.$gte = query.dateFrom;
    if (query.dateTo) filter.date.$lte = query.dateTo;
  }

  if (query.mobile) filter['patientSnapshot.mobile'] = prefix(query.mobile);
  if (query.patientName) filter['patientSnapshot.searchName'] = prefix(query.patientName);
  if (query.doctorName) filter['doctorSnapshot.searchName'] = prefix(query.doctorName);

  // Generic search box: interpret the term by its shape so a single index serves it.
  if (query.search) {
    const term = query.search.trim();
    if (/^PT-\d+$/i.test(term)) filter['patientSnapshot.patientCode'] = term.toUpperCase();
    else if (/^\+?\d{3,}$/.test(term)) filter['patientSnapshot.mobile'] = prefix(term);
    else filter['patientSnapshot.searchName'] = prefix(term);
  }

  // Applied last so it always wins over any client-supplied doctorId.
  return { ...filter, ...ownershipFilter(actor) };
}

export async function listAppointments(query, actor) {
  const filter = buildListFilter(query, actor);
  const pagination = buildPagination(query);

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .select(LIST_PROJECTION)
      .sort(buildSort(query.sort, SORTABLE_FIELDS, { date: -1, slotStart: 1 }))
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('department', 'name code')
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return { items: items.map(present), meta: paginationMeta(pagination, total) };
}
