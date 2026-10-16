import * as doctorService from '../services/doctor.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function listDoctors(req, res) {
  const doctors = await doctorService.findActiveDoctors(req.validated.query);
  return sendSuccess(res, { data: doctors, meta: { total: doctors.length } });
}

export async function getSchedule(req, res) {
  const schedule = await doctorService.getSchedule(req.validated.params.id);
  return sendSuccess(res, { data: schedule });
}

export async function upsertSchedule(req, res) {
  const schedule = await doctorService.upsertSchedule(
    req.validated.params.id,
    req.validated.body,
    req.user,
    requestContext(req),
  );
  return sendSuccess(res, { message: 'Schedule saved successfully', data: schedule });
}
