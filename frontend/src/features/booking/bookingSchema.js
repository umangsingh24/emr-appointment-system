import { z } from 'zod';
import { todayISO } from '../../lib/date.js';

/** Empty form inputs arrive as "" — treat them as "not provided". */
const optional = (schema) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

export const newPatientSchema = z.object({
  name: z.string().trim().min(2, 'Enter the patient’s full name').max(100),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Enter a 10–15 digit mobile number'),
  gender: optional(z.enum(['MALE', 'FEMALE', 'OTHER'])),
  dateOfBirth: optional(z.string().refine((value) => value <= todayISO(), 'Date of birth cannot be in the future')),
  email: optional(z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'))),
});

/**
 * Mirrors the API's createAppointment rules so most mistakes are caught before a request
 * is made. The server still validates everything independently.
 */
export const bookingSchema = z
  .object({
    doctorId: z.string().min(1, 'Select a doctor'),
    date: z.string().min(1, 'Select a date'),
    slotStart: z.string().min(1, 'Select a time slot'),
    purpose: z.string().trim().min(2, 'Describe the purpose of the visit').max(500),
    notes: z.string().trim().max(2000).optional(),
    patientMode: z.enum(['existing', 'new']),
    patientId: z.string().optional(),
    newPatient: z.any(),
  })
  .superRefine((values, ctx) => {
    if (values.patientMode === 'existing') {
      if (!values.patientId) ctx.addIssue({ code: 'custom', path: ['patientId'], message: 'Search for and select a patient' });
      return;
    }
    const result = newPatientSchema.safeParse(values.newPatient ?? {});
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: 'custom', path: ['newPatient', ...issue.path], message: issue.message });
      }
    }
  });

export function toCreatePayload(values) {
  const base = {
    doctorId: values.doctorId,
    date: values.date,
    slotStart: values.slotStart,
    purpose: values.purpose.trim(),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
  };
  if (values.patientMode === 'existing') return { ...base, patientId: values.patientId };
  return { ...base, newPatient: newPatientSchema.parse(values.newPatient) };
}
