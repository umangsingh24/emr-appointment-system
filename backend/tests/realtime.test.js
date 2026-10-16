import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLES, SOCKET_EVENTS } from '../src/config/constants.js';
import { initSocket } from '../src/sockets/index.js';
import { app, bearer, api, createDoctorWithSchedule, createUser, loginAs, tomorrow, useDatabase } from './helpers.js';

useDatabase();

let server;
let io;
let url;

beforeAll(async () => {
  server = http.createServer(app);
  io = initSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  io.close();
  await new Promise((resolve) => server.close(resolve));
});

function client(token) {
  return connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
}

describe('Real-time appointment updates', () => {
  it('rejects connections without a valid access token', async () => {
    const socket = client('invalid');
    const error = await new Promise((resolve) => socket.on('connect_error', resolve));
    expect(error.message).toBe('Unauthorized');
    socket.close();
  });

  it('pushes a PHI-free event to clients viewing the affected doctor and day', async () => {
    const { doctor } = await createDoctorWithSchedule();
    const { token } = await loginAs(await createUser(ROLES.RECEPTIONIST));

    const socket = client(token);
    await new Promise((resolve) => socket.on('connect', resolve));
    const ack = await socket.emitWithAck(SOCKET_EVENTS.JOIN_SCHEDULE, { doctorId: String(doctor._id), date: tomorrow() });
    expect(ack.ok).toBe(true);

    const received = new Promise((resolve) => socket.on(SOCKET_EVENTS.APPOINTMENT_CREATED, resolve));
    await api()
      .post('/api/v1/appointments')
      .set(bearer(token))
      .send({
        doctorId: String(doctor._id),
        date: tomorrow(),
        slotStart: '09:00',
        purpose: 'Checkup',
        newPatient: { name: 'Live Update', mobile: '9000000000' },
      })
      .expect(201);

    const event = await received;
    expect(event).toMatchObject({ doctorId: String(doctor._id), date: tomorrow(), slotStart: '09:00', status: 'SCHEDULED' });
    expect(JSON.stringify(event)).not.toContain('Live Update'); // no patient data on the wire
    socket.close();
  });

  it('does not let a doctor subscribe to another doctor\'s schedule', async () => {
    const { doctor } = await createDoctorWithSchedule();
    const { doctor: other } = await createDoctorWithSchedule({ name: 'Dr. Other' });
    const { token } = await loginAs(doctor);

    const socket = client(token);
    await new Promise((resolve) => socket.on('connect', resolve));
    const ack = await socket.emitWithAck(SOCKET_EVENTS.JOIN_SCHEDULE, { doctorId: String(other._id), date: tomorrow() });
    expect(ack.ok).toBe(false);
    socket.close();
  });
});
