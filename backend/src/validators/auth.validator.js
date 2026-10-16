import { z } from 'zod';
import { email } from './common.js';

export const loginSchema = {
  body: z.object({
    email,
    // Do not enforce password complexity at login; only at creation.
    password: z.string().min(1, 'Password is required').max(72),
  }),
};
