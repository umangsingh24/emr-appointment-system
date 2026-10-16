import { Router } from 'express';
import * as slotController from '../controllers/slot.controller.js';
import { validate } from '../middlewares/validate.js';
import { getSlotsSchema } from '../validators/doctor.validator.js';

const router = Router();

router.get('/', validate(getSlotsSchema), slotController.getSlots);

export default router;
