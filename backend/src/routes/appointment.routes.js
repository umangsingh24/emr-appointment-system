import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as appointmentController from '../controllers/appointment.controller.js';
import { authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  appointmentIdSchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  statsSchema,
  updateAppointmentSchema,
} from '../validators/appointment.validator.js';

const { SUPER_ADMIN, RECEPTIONIST, DOCTOR } = ROLES;
const router = Router();

// Read access for all roles; doctors are restricted to their own records in the service layer.
router.get('/', validate(listAppointmentsSchema), appointmentController.listAppointments);
router.get('/stats', validate(statsSchema), appointmentController.getDayStats); // before /:id
router.get('/:id', validate(appointmentIdSchema), appointmentController.getAppointment);

router.post('/', authorize(SUPER_ADMIN, RECEPTIONIST), validate(createAppointmentSchema), appointmentController.createAppointment);
// Field-level permissions (front desk vs. clinical notes) are enforced in the service.
router.put('/:id', authorize(SUPER_ADMIN, RECEPTIONIST, DOCTOR), validate(updateAppointmentSchema), appointmentController.updateAppointment);
// DELETE is a soft cancel: the record is retained for audit and history.
router.delete('/:id', authorize(SUPER_ADMIN, RECEPTIONIST), validate(cancelAppointmentSchema), appointmentController.cancelAppointment);
router.post('/:id/arrive', authorize(SUPER_ADMIN, RECEPTIONIST), validate(appointmentIdSchema), appointmentController.markArrived);
router.post('/:id/complete', authorize(SUPER_ADMIN, DOCTOR), validate(appointmentIdSchema), appointmentController.markCompleted);

export default router;
