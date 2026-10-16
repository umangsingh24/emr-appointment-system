import { z } from 'zod';
import { dateString, email, mobile, personName } from './common.js';

export const patientInput = z.object({
  name: personName,
  mobile,
  email: email.optional(),
  dateOfBirth: dateString
    .refine((value) => value <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future')
    .optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().trim().max(300).optional(),
});

export const searchPatientsSchema = {
  query: z.object({
    q: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  }),
};

export const createPatientSchema = { body: patientInput };
