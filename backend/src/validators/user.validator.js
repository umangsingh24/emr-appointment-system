import { z } from 'zod';
import { ROLES } from '../config/constants.js';
import { email, objectId, paginationQuery, password, personName } from './common.js';

// Super admins are provisioned by the seed script only, never through the API.
const creatableRoles = [ROLES.DOCTOR, ROLES.RECEPTIONIST];

export const createUserSchema = {
  body: z
    .object({
      name: personName,
      email,
      password,
      role: z.enum(creatableRoles),
      department: objectId.optional(),
      specialization: z.string().trim().max(100).optional(),
    })
    .refine((data) => data.role !== ROLES.DOCTOR || data.department, {
      message: 'Department is required for doctors',
      path: ['department'],
    }),
};

export const listUsersSchema = {
  query: z.object({
    ...paginationQuery,
    role: z.enum(Object.values(ROLES)).optional(),
    search: z.string().trim().max(100).optional(),
  }),
};
