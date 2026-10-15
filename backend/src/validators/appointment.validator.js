import { z } from 'zod';
import { APPOINTMENT_STATUS } from '../config/constants.js';
import { dateString, idParams, objectId, paginationQuery, timeString } from './common.js';
import { patientInput } from './patient.validator.js';

export const createAppointmentSchema = {
  body: z
    .object({
      doctorId: objectId,
      date: dateString,
      slotStart: timeString,
      purpose: z.string().trim().min(2).max(500),
      notes: z.string().trim().max(2000).optional(),
      // Exactly one of these: book for an existing patient, or register a new one inline.
      patientId: objectId.optional(),
      newPatient: patientInput.optional(),
    })
    .refine((b) => Boolean(b.patientId) !== Boolean(b.newPatient), {
      message: 'Provide either patientId or newPatient (not both)',
      path: ['patientId'],
    }),
};

export const listAppointmentsSchema = {
  query: z
    .object({
      ...paginationQuery,
      search: z.string().trim().min(1).max(100).optional(), // patient name / mobile / patient code
      patientName: z.string().trim().min(1).max(100).optional(),
      doctorName: z.string().trim().min(1).max(100).optional(),
      mobile: z.string().trim().regex(/^\+?\d{3,15}$/, 'Invalid mobile').optional(),
      doctorId: objectId.optional(),
      departmentId: objectId.optional(),
      patientId: objectId.optional(),
      status: z
        .string()
        .transform((value) => value.split(',').map((s) => s.trim().toUpperCase()))
        .pipe(z.array(z.enum(Object.values(APPOINTMENT_STATUS))))
        .optional(),
      dateFrom: dateString.optional(),
      dateTo: dateString.optional(),
    })
    .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
      message: 'dateFrom must be on or before dateTo',
      path: ['dateTo'],
    }),
};

export const updateAppointmentSchema = {
  params: idParams,
  body: z
    .object({
      purpose: z.string().trim().min(2).max(500).optional(),
      notes: z.string().trim().max(2000).optional(),
      consultationNotes: z.string().trim().max(5000).optional(),
    })
    .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'Nothing to update' }),
};

export const cancelAppointmentSchema = {
  params: idParams,
  body: z.object({ reason: z.string().trim().max(500).optional() }).default({}),
};

export const appointmentIdSchema = { params: idParams };

export const statsSchema = {
  query: z.object({ date: dateString.optional() }),
};
