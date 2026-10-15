import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as patientController from '../controllers/patient.controller.js';
import { authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { createPatientSchema, searchPatientsSchema } from '../validators/patient.validator.js';

const router = Router();
const frontDesk = authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST);

router.get('/search', frontDesk, validate(searchPatientsSchema), patientController.searchPatients);
router.post('/', frontDesk, validate(createPatientSchema), patientController.createPatient);
// Doctors read patient details through their appointments; direct lookup is front-desk only.
router.get('/:id', frontDesk, validate({ params: idParams }), patientController.getPatient);

export default router;
