import { ROLES } from '../config/constants.js';
import { Appointment, DoctorSchedule } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { clinicNow, isPastSlot, minutesToTime, weekdayOf } from '../utils/time.js';
import { findActiveDoctors, getActiveDoctor } from './doctor.service.js';
import { generateDaySlots } from './slotGenerator.js';

export const SLOT_STATUS = Object.freeze({ AVAILABLE: 'AVAILABLE', BOOKED: 'BOOKED', PAST: 'PAST' });

function daySlotsFor(schedule, date) {
  if (!schedule) return [];
  const day = schedule.weeklySchedule.find((d) => d.day === weekdayOf(date));
  return generateDaySlots(day, schedule.slotDurationMinutes);
}

/**
 * Slot grid for one or more doctors on a date.
 * Uses exactly two queries regardless of how many doctors are returned:
 * one for schedules, one for that day's active appointments.
 */
export async function getSlots({ doctorId, departmentId, date }, actor) {
  // Doctors may only look at their own grid.
  if (actor.role === ROLES.DOCTOR) {
    if (doctorId && doctorId !== actor.id) throw ApiError.forbidden();
    doctorId = actor.id;
  }

  const doctors = doctorId ? [await getActiveDoctor(doctorId)] : await findActiveDoctors({ department: departmentId });
  if (!doctors.length) return [];

  const doctorIds = doctors.map((d) => d._id);
  const [schedules, appointments] = await Promise.all([
    DoctorSchedule.find({ doctor: { $in: doctorIds } }).lean(),
    Appointment.find({ doctor: { $in: doctorIds }, date, holdsSlot: true })
      .select('doctor slotStart status')
      .lean(),
  ]);

  const scheduleByDoctor = new Map(schedules.map((s) => [String(s.doctor), s]));
  const bookedByKey = new Map(appointments.map((a) => [`${a.doctor}:${a.slotStart}`, a]));
  const now = clinicNow();

  return doctors.map((doctor) => {
    const schedule = scheduleByDoctor.get(String(doctor._id));
    const slots = daySlotsFor(schedule, date).map(({ start, end }) => {
      const booking = bookedByKey.get(`${doctor._id}:${start}`);
      let status = SLOT_STATUS.AVAILABLE;
      if (booking) status = SLOT_STATUS.BOOKED;
      else if (isPastSlot(date, start, now)) status = SLOT_STATUS.PAST;

      return {
        start: minutesToTime(start),
        end: minutesToTime(end),
        status,
        ...(booking ? { appointmentId: booking._id, appointmentStatus: booking.status } : {}),
      };
    });

    return {
      doctor: { _id: doctor._id, name: doctor.name, specialization: doctor.specialization, department: doctor.department },
      slotDurationMinutes: schedule?.slotDurationMinutes ?? null,
      isWorkingDay: slots.length > 0,
      slots,
    };
  });
}

/**
 * Confirms that `startMinutes` is a real, bookable slot for the doctor on `date`:
 * a working day, aligned to the schedule, outside breaks, and not in the past.
 * (Whether it is already taken is enforced by the unique index at insert time.)
 */
export async function assertBookableSlot(doctorId, date, startMinutes) {
  const schedule = await DoctorSchedule.findOne({ doctor: doctorId }).lean();
  if (!schedule) throw ApiError.unprocessable('This doctor has no schedule configured', 'NO_SCHEDULE');

  const slot = daySlotsFor(schedule, date).find((s) => s.start === startMinutes);
  if (!slot) {
    throw ApiError.unprocessable(
      'Selected time is not an available slot for this doctor (outside working hours or during a break)',
      'INVALID_SLOT',
    );
  }
  if (isPastSlot(date, startMinutes)) {
    throw ApiError.unprocessable('Cannot book an appointment in the past', 'SLOT_IN_PAST');
  }
  return slot;
}
