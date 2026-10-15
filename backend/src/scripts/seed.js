/**
 * Idempotent development seed: departments, staff accounts, doctor schedules, sample patients.
 * Usage: npm run seed
 * Re-running is safe: existing records (matched by email / code) are left untouched.
 */
import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Department, DoctorSchedule, Patient, User } from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';
import { insertPatient } from '../services/patient.service.js';

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? 'Password@123';

const departments = [
  { name: 'General Medicine', code: 'GEN' },
  { name: 'Cardiology', code: 'CARD' },
  { name: 'Pediatrics', code: 'PED' },
];

const standardWeek = (days) =>
  days.map((day) => ({
    day,
    sessions: [
      { label: 'Morning', start: '09:00', end: '12:00' },
      { label: 'Evening', start: '13:00', end: '17:00' },
    ],
    breaks: [{ label: 'Tea break', start: '10:30', end: '10:45' }],
  }));

const staff = [
  { name: 'System Administrator', email: process.env.SEED_ADMIN_EMAIL ?? 'admin@emr.local', role: ROLES.SUPER_ADMIN },
  { name: 'Riya Sharma', email: 'reception@emr.local', role: ROLES.RECEPTIONIST },
  {
    name: 'Dr. Arjun Mehta',
    email: 'arjun.mehta@emr.local',
    role: ROLES.DOCTOR,
    departmentCode: 'GEN',
    specialization: 'Internal Medicine',
    schedule: { slotDurationMinutes: 15, weeklySchedule: standardWeek(['MON', 'TUE', 'WED', 'THU', 'FRI']) },
  },
  {
    name: 'Dr. Kavya Iyer',
    email: 'kavya.iyer@emr.local',
    role: ROLES.DOCTOR,
    departmentCode: 'CARD',
    specialization: 'Cardiologist',
    schedule: { slotDurationMinutes: 20, weeklySchedule: standardWeek(['MON', 'WED', 'FRI', 'SAT']) },
  },
  {
    name: 'Dr. Rohan Das',
    email: 'rohan.das@emr.local',
    role: ROLES.DOCTOR,
    departmentCode: 'PED',
    specialization: 'Pediatrician',
    schedule: { slotDurationMinutes: 30, weeklySchedule: standardWeek(['TUE', 'THU', 'SAT']) },
  },
];

const patients = [
  { name: 'Anil Kumar', mobile: '9876543210', gender: 'MALE' },
  { name: 'Sunita Verma', mobile: '9876500011', gender: 'FEMALE' },
  { name: 'Mohammed Ali', mobile: '9123456780', gender: 'MALE' },
];

async function seed() {
  await connectDatabase();
  // Build every declared index (incl. the double-booking guard): autoIndex is off in production.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));

  const departmentIds = {};
  for (const dept of departments) {
    const doc = await Department.findOneAndUpdate({ code: dept.code }, { $setOnInsert: dept }, { upsert: true, returnDocument: 'after' });
    departmentIds[dept.code] = doc._id;
  }

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  let admin;
  for (const { schedule, departmentCode, ...member } of staff) {
    const user = await User.findOneAndUpdate(
      { email: member.email },
      { $setOnInsert: { ...member, department: departmentIds[departmentCode], passwordHash } },
      { upsert: true, returnDocument: 'after' },
    );
    if (member.role === ROLES.SUPER_ADMIN) admin = user;
    if (schedule) {
      await DoctorSchedule.findOneAndUpdate(
        { doctor: user._id },
        { $setOnInsert: { ...schedule, doctor: user._id } },
        { upsert: true },
      );
    }
  }

  for (const patient of patients) {
    if (!(await Patient.exists({ mobile: patient.mobile, name: patient.name }))) {
      await insertPatient(patient, { id: admin._id });
    }
  }

  logger.info(`Seed complete. Staff accounts use password "${env.isProduction ? '<hidden>' : DEFAULT_PASSWORD}".`);
}

seed()
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
