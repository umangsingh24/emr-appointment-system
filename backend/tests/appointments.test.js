import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES } from '../src/config/constants.js';
import { Appointment, Patient } from '../src/models/index.js';
import { api, bearer, createDoctorWithSchedule, createUser, loginAs, tomorrow, useDatabase, yesterday } from './helpers.js';

useDatabase();

let doctor;
let receptionToken;

const newPatient = (name = 'Anil Kumar', mobile = '9876543210') => ({ name, mobile });

function book(body, token = receptionToken) {
  return api()
    .post('/api/v1/appointments')
    .set(bearer(token))
    .send({ doctorId: String(doctor._id), date: tomorrow(), slotStart: '09:00', purpose: 'Fever', ...body });
}

beforeEach(async () => {
  ({ doctor } = await createDoctorWithSchedule());
  receptionToken = (await loginAs(await createUser(ROLES.RECEPTIONIST))).token;
});

describe('Slots', () => {
  it('generates slots around breaks and marks booked ones', async () => {
    await book({ newPatient: newPatient(), slotStart: '09:15' });

    const res = await api()
      .get('/api/v1/slots')
      .query({ doctorId: String(doctor._id), date: tomorrow() })
      .set(bearer(receptionToken));

    expect(res.status).toBe(200);
    const { slots } = res.body.data[0];
    const starts = slots.map((s) => s.start);
    expect(starts).not.toContain('10:30'); // break
    expect(starts).not.toContain('12:00'); // lunch gap between sessions
    expect(starts.slice(0, 3)).toEqual(['09:00', '09:15', '09:30']);
    expect(slots.find((s) => s.start === '09:15').status).toBe('BOOKED');
    expect(slots.find((s) => s.start === '09:00').status).toBe('AVAILABLE');
  });
});

describe('Booking', () => {
  it('books for a new patient, creating the patient record', async () => {
    const res = await book({ newPatient: newPatient() });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'SCHEDULED', slotStartTime: '09:00', slotEndTime: '09:15' });
    expect(res.body.data.patient.patientCode).toMatch(/^PT-\d{6}$/);
    expect(await Patient.countDocuments()).toBe(1);
  });

  it('books for an existing patient', async () => {
    const first = await book({ newPatient: newPatient() });
    const res = await book({ patientId: first.body.data.patient._id, slotStart: '09:30' });
    expect(res.status).toBe(201);
    expect(await Patient.countDocuments()).toBe(1);
  });

  it('rejects past dates, break periods and misaligned times', async () => {
    expect((await book({ newPatient: newPatient(), date: yesterday() })).body.meta.code).toBe('SLOT_IN_PAST');
    expect((await book({ newPatient: newPatient(), slotStart: '10:30' })).body.meta.code).toBe('INVALID_SLOT');
    expect((await book({ newPatient: newPatient(), slotStart: '09:07' })).body.meta.code).toBe('INVALID_SLOT');
    expect(await Patient.countDocuments()).toBe(0);
  });

  it('allows exactly one of many simultaneous bookings for the same slot', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, i) => book({ newPatient: newPatient(`Patient ${i}`, `98765432${10 + i}`) })),
    );

    const statuses = attempts.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(attempts.find((r) => r.status === 409).body.meta.code).toBe('SLOT_ALREADY_BOOKED');

    expect(await Appointment.countDocuments()).toBe(1);
    // Losing bookings were rolled back, so no orphan patients were created.
    expect(await Patient.countDocuments()).toBe(1);
  });

  it('frees the slot when an appointment is cancelled', async () => {
    const first = await book({ newPatient: newPatient() });
    const cancel = await api()
      .delete(`/api/v1/appointments/${first.body.data._id}`)
      .set(bearer(receptionToken))
      .send({ reason: 'Patient request' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');

    expect((await book({ newPatient: newPatient('Someone Else', '9000000000') })).status).toBe(201);
  });
});

describe('Status workflow', () => {
  it('rejects transitions that are not allowed', async () => {
    const { body } = await book({ newPatient: newPatient() });
    const id = body.data._id;

    await api().delete(`/api/v1/appointments/${id}`).set(bearer(receptionToken)).send({});
    const arrive = await api().post(`/api/v1/appointments/${id}/arrive`).set(bearer(receptionToken));

    expect(arrive.status).toBe(422);
    expect(arrive.body.meta.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('does not allow marking a future appointment as arrived', async () => {
    const { body } = await book({ newPatient: newPatient() });
    const arrive = await api().post(`/api/v1/appointments/${body.data._id}/arrive`).set(bearer(receptionToken));
    expect(arrive.status).toBe(422);
    expect(arrive.body.meta.code).toBe('APPOINTMENT_IN_FUTURE');
  });
});

describe('Doctor access', () => {
  it('only shows a doctor their own appointments', async () => {
    const { doctor: otherDoctor } = await createDoctorWithSchedule({ name: 'Dr. Other' });
    const mine = await book({ newPatient: newPatient() });
    const theirs = await book({ newPatient: newPatient('Other Patient', '9111111111'), doctorId: String(otherDoctor._id) });

    const { token } = await loginAs(doctor);
    const list = await api().get('/api/v1/appointments').query({ doctorId: String(otherDoctor._id) }).set(bearer(token));

    expect(list.status).toBe(200);
    expect(list.body.data.map((a) => a._id)).toEqual([mine.body.data._id]);

    const peek = await api().get(`/api/v1/appointments/${theirs.body.data._id}`).set(bearer(token));
    expect(peek.status).toBe(404);
  });

  it('lets doctors write consultation notes but not front-desk fields', async () => {
    const { body } = await book({ newPatient: newPatient() });
    const { token } = await loginAs(doctor);

    const res = await api().put(`/api/v1/appointments/${body.data._id}`).set(bearer(token)).send({ purpose: 'Changed' });
    expect(res.status).toBe(403);
  });

  it('forbids doctors from booking', async () => {
    const { token } = await loginAs(doctor);
    expect((await book({ newPatient: newPatient() }, token)).status).toBe(403);
  });
});

describe('Listing', () => {
  it('paginates, filters and searches on the server', async () => {
    for (const [i, slot] of ['09:00', '09:15', '09:30'].entries()) {
      await book({ newPatient: newPatient(`Patient ${i}`, `900000000${i}`), slotStart: slot });
    }

    const page = await api().get('/api/v1/appointments').query({ limit: 2, sort: 'slotStart' }).set(bearer(receptionToken));
    expect(page.body.data).toHaveLength(2);
    expect(page.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(page.body.data.map((a) => a.slotStartTime)).toEqual(['09:00', '09:15']);

    const byMobile = await api().get('/api/v1/appointments').query({ search: '9000000002' }).set(bearer(receptionToken));
    expect(byMobile.body.data.map((a) => a.patientSnapshot.name)).toEqual(['Patient 2']);

    const cancelledOnly = await api().get('/api/v1/appointments').query({ status: 'CANCELLED' }).set(bearer(receptionToken));
    expect(cancelledOnly.body.meta.total).toBe(0);
  });
});

describe('Dashboard stats', () => {
  it('counts the day by status and department, scoped for doctors', async () => {
    const { doctor: otherDoctor } = await createDoctorWithSchedule({ name: 'Dr. Other' });
    const first = await book({ newPatient: newPatient() });
    await book({ newPatient: newPatient('Bina Rao', '9000000001'), slotStart: '09:15' });
    await book({ newPatient: newPatient('Chetan Das', '9000000002'), doctorId: String(otherDoctor._id) });
    await api().delete(`/api/v1/appointments/${first.body.data._id}`).set(bearer(receptionToken)).send({});

    const all = await api().get('/api/v1/appointments/stats').query({ date: tomorrow() }).set(bearer(receptionToken));
    expect(all.status).toBe(200);
    expect(all.body.data).toMatchObject({ total: 3, byStatus: { SCHEDULED: 2, CANCELLED: 1, ARRIVED: 0, COMPLETED: 0 } });
    expect(all.body.data.byDepartment).toEqual([expect.objectContaining({ name: 'General Medicine', count: 2 })]);

    const { token } = await loginAs(doctor);
    const mine = await api().get('/api/v1/appointments/stats').query({ date: tomorrow() }).set(bearer(token));
    expect(mine.body.data).toMatchObject({ total: 2, byStatus: { SCHEDULED: 1, CANCELLED: 1 } });
  });
});
