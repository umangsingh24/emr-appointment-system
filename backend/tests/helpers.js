import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { createApp } from '../src/app.js';
import { ROLES, WEEKDAYS } from '../src/config/constants.js';
import { Department, DoctorSchedule, User } from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';
import { clinicNow } from '../src/utils/time.js';

export const PASSWORD = 'Password123';
export const app = createApp();
export const api = () => request(app);

/** Connects to the shared in-memory replica set and wipes data between tests. */
export function useDatabase() {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `test_${process.pid}_${Date.now()}` });
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

export function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const today = () => clinicNow().date;
export const tomorrow = () => shiftDate(today(), 1);
export const yesterday = () => shiftDate(today(), -1);

export async function createUser(role, overrides = {}) {
  return User.create({
    name: `${role} User`,
    email: `${role.toLowerCase()}-${new mongoose.Types.ObjectId()}@test.local`,
    passwordHash: await hashPassword(PASSWORD),
    role,
    ...overrides,
  });
}

/** Doctor working every day 09:00-12:00 and 13:00-17:00 with a 10:30-10:45 break, 15-minute slots. */
export async function createDoctorWithSchedule(overrides = {}) {
  const department =
    (await Department.findOne({ code: 'GEN' })) ?? (await Department.create({ name: 'General Medicine', code: 'GEN' }));
  const doctor = await createUser(ROLES.DOCTOR, { name: 'Dr. Test', department: department._id, ...overrides });
  await DoctorSchedule.create({
    doctor: doctor._id,
    slotDurationMinutes: 15,
    weeklySchedule: WEEKDAYS.map((day) => ({
      day,
      sessions: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      breaks: [{ start: '10:30', end: '10:45' }],
    })),
  });
  return { doctor, department };
}

export async function loginAs(user) {
  const res = await api().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
  return { token: res.body.data.accessToken, cookies: res.headers['set-cookie'] };
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });
