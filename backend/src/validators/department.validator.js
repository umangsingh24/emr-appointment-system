import { z } from 'zod';

export const createDepartmentSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,20}$/, 'Code must be 2-20 letters, digits, "_" or "-"'),
  }),
};
