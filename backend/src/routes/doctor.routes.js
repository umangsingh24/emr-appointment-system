import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as doctorController from '../controllers/doctor.controller.js';
import { authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { doctorIdSchema, listDoctorsSchema } from '../validators/doctor.validator.js';
import { upsertScheduleSchema } from '../validators/schedule.validator.js';

const router = Router();

router.get('/', validate(listDoctorsSchema), doctorController.listDoctors);
router.get(
  '/:id/schedule',
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST),
  validate(doctorIdSchema),
  doctorController.getSchedule,
);
router.put(
  '/:id/schedule',
  authorize(ROLES.SUPER_ADMIN),
  validate(upsertScheduleSchema),
  doctorController.upsertSchedule,
);

export default router;
