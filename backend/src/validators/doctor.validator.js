import { z } from 'zod';
import { dateString, idParams, objectId } from './common.js';

export const listDoctorsSchema = {
  query: z.object({
    department: objectId.optional(),
    search: z.string().trim().max(100).optional(),
  }),
};

export const doctorIdSchema = { params: idParams };

export const getSlotsSchema = {
  query: z
    .object({
      doctorId: objectId.optional(),
      departmentId: objectId.optional(),
      date: dateString,
    })
    .refine((q) => q.doctorId || q.departmentId, {
      message: 'Either doctorId or departmentId is required',
      path: ['doctorId'],
    }),
};
