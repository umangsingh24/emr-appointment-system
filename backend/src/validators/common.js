import mongoose from 'mongoose';
import { z } from 'zod';
import { isValidDate, isValidTime } from '../utils/time.js';

export const objectId = z
  .string()
  .trim()
  .refine((value) => mongoose.isValidObjectId(value), { message: 'Invalid id' });

export const dateString = z
  .string()
  .trim()
  .refine(isValidDate, { message: 'Must be a valid date in YYYY-MM-DD format' });

export const timeString = z
  .string()
  .trim()
  .refine(isValidTime, { message: 'Must be a valid time in HH:mm (24h) format' });

export const mobile = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Mobile number must contain 10-15 digits');

// Normalise first, then validate (Zod runs checks in declaration order).
export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email').max(254));

export const personName = z.string().trim().min(2, 'Name is too short').max(100);

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt truncates beyond 72 bytes
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().max(100).optional(),
};

export const idParams = z.object({ id: objectId });
