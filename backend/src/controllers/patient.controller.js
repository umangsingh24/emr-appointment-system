import * as patientService from '../services/patient.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function searchPatients(req, res) {
  const patients = await patientService.searchPatients(req.validated.query);
  return sendSuccess(res, { data: patients, meta: { total: patients.length } });
}

export async function getPatient(req, res) {
  const patient = await patientService.getPatientById(req.validated.params.id);
  return sendSuccess(res, { data: patient });
}

export async function createPatient(req, res) {
  const patient = await patientService.registerPatient(req.validated.body, req.user, requestContext(req));
  return sendSuccess(res, { statusCode: 201, message: 'Patient registered successfully', data: patient });
}
