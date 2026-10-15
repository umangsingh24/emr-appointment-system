import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { corsOptions } from '../app.js';
import { ROLES, SOCKET_EVENTS } from '../config/constants.js';
import { logger } from '../config/logger.js';
import { verifyAccessToken } from '../services/token.service.js';
import { domainEvents } from '../utils/events.js';
import { isValidDate } from '../utils/time.js';

/**
 * Room design: one room per (doctor, date) and one per (department, date).
 * A scheduler screen joins exactly the rooms it is displaying, so an update is pushed
 * only to clients that are looking at the affected day, never broadcast to everyone.
 */
export const rooms = {
  doctorDay: (doctorId, date) => `doctor:${doctorId}:${date}`,
  departmentDay: (departmentId, date) => `department:${departmentId}:${date}`,
  // Appointment list screens listen here; payloads carry no patient data.
  staff: 'appointments:staff',
  doctor: (doctorId) => `appointments:doctor:${doctorId}`,
};

function roomsFor(user, { doctorId, departmentId, date } = {}) {
  if (!isValidDate(date ?? '')) return [];
  if (user.role === ROLES.DOCTOR) {
    // Doctors may only subscribe to their own calendar.
    return doctorId === user.id ? [rooms.doctorDay(doctorId, date)] : [];
  }
  const result = [];
  if (doctorId && mongoose.isValidObjectId(doctorId)) result.push(rooms.doctorDay(doctorId, date));
  if (departmentId && mongoose.isValidObjectId(departmentId)) result.push(rooms.departmentDay(departmentId, date));
  return result;
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: corsOptions });

  // Authenticate the handshake with the same access token used for REST.
  io.use((socket, next) => {
    try {
      socket.data.user = verifyAccessToken(socket.handshake.auth?.token);
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(user.role === ROLES.DOCTOR ? rooms.doctor(user.id) : rooms.staff);

    socket.on(SOCKET_EVENTS.JOIN_SCHEDULE, (params, ack) => {
      const joined = roomsFor(user, params);
      joined.forEach((room) => socket.join(room));
      if (typeof ack === 'function') ack({ ok: joined.length > 0, rooms: joined.length });
    });

    socket.on(SOCKET_EVENTS.LEAVE_SCHEDULE, (params) => {
      roomsFor(user, params).forEach((room) => socket.leave(room));
    });
  });

  const onAppointment = ({ event, payload }) => {
    io.to([
      rooms.doctorDay(payload.doctorId, payload.date),
      rooms.departmentDay(payload.departmentId, payload.date),
      rooms.staff,
      rooms.doctor(payload.doctorId),
    ]).emit(event, payload);
  };
  domainEvents.on('appointment', onAppointment);

  logger.info('Socket.IO initialised');
  return io;
}
