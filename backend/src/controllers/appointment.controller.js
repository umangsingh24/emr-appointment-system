import * as appointmentService from '../services/appointment.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function createAppointment(req, res) {
  const appointment = await appointmentService.createAppointment(req.validated.body, req.user, requestContext(req));
  return sendSuccess(res, { statusCode: 201, message: 'Appointment created successfully', data: appointment });
}

export async function listAppointments(req, res) {
  const { items, meta } = await appointmentService.listAppointments(req.validated.query, req.user);
  return sendSuccess(res, { data: items, meta });
}

export async function getAppointment(req, res) {
  const appointment = await appointmentService.getAppointment(req.validated.params.id, req.user);
  return sendSuccess(res, { data: appointment });
}

export async function updateAppointment(req, res) {
  const appointment = await appointmentService.updateAppointment(
    req.validated.params.id,
    req.validated.body,
    req.user,
    requestContext(req),
  );
  return sendSuccess(res, { message: 'Appointment updated successfully', data: appointment });
}

export async function cancelAppointment(req, res) {
  const appointment = await appointmentService.cancelAppointment(
    req.validated.params.id,
    req.validated.body,
    req.user,
    requestContext(req),
  );
  return sendSuccess(res, { message: 'Appointment cancelled successfully', data: appointment });
}

export async function markArrived(req, res) {
  const appointment = await appointmentService.markArrived(req.validated.params.id, req.user, requestContext(req));
  return sendSuccess(res, { message: 'Patient marked as arrived', data: appointment });
}

export async function markCompleted(req, res) {
  const appointment = await appointmentService.markCompleted(req.validated.params.id, req.user, requestContext(req));
  return sendSuccess(res, { message: 'Appointment marked as completed', data: appointment });
}
