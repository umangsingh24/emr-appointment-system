import { AUDIT_ACTIONS } from '../config/constants.js';
import { nextSequence, Patient } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/pagination.js';
import { recordAudit } from './audit.service.js';

const SEARCH_LIMIT = 20;

function formatPatientCode(sequence) {
  return `PT-${String(sequence).padStart(6, '0')}`;
}

/**
 * One search box for the front desk. The input shape decides which index is used:
 *   "PT-000123" -> patientCode (exact)
 *   digits      -> mobile (prefix)
 *   otherwise   -> name (case-insensitive prefix on the lower-cased copy)
 * Anchored prefix regexes are index-friendly; unanchored ones would scan the collection.
 */
export function searchPatients({ q }) {
  const term = q.trim();
  let filter;

  if (/^PT-\d+$/i.test(term)) {
    filter = { patientCode: term.toUpperCase() };
  } else if (/^\+?\d{3,}$/.test(term)) {
    filter = { mobile: new RegExp(`^${escapeRegex(term)}`) };
  } else {
    filter = { searchName: new RegExp(`^${escapeRegex(term.toLowerCase())}`) };
  }

  return Patient.find(filter)
    .select('patientCode name mobile gender dateOfBirth')
    .sort({ name: 1 })
    .limit(SEARCH_LIMIT)
    .lean();
}

export async function getPatientById(id, session) {
  const patient = await Patient.findById(id).session(session ?? null).lean();
  if (!patient) throw ApiError.notFound('Patient');
  return patient;
}

/** Raw write, safe to call inside a transaction. Callers audit after commit. */
export async function insertPatient(input, actor, session) {
  const patientCode = formatPatientCode(await nextSequence('patient', session));
  const [patient] = await Patient.create([{ ...input, patientCode, createdBy: actor.id }], { session });
  return patient.toJSON();
}

export function auditPatientCreated(patient, actor, context = {}) {
  recordAudit({ actor, action: AUDIT_ACTIONS.PATIENT_CREATED, entity: 'Patient', entityId: patient._id, ip: context.ip });
}

export async function registerPatient(input, actor, context = {}) {
  const patient = await insertPatient(input, actor);
  auditPatientCreated(patient, actor, context);
  return patient;
}
