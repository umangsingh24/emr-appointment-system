import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import appointmentRoutes from './appointment.routes.js';
import authRoutes from './auth.routes.js';
import departmentRoutes from './department.routes.js';
import doctorRoutes from './doctor.routes.js';
import patientRoutes from './patient.routes.js';
import slotRoutes from './slot.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/auth', authRoutes);

// Everything below requires a valid access token.
router.use(authenticate);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/slots', slotRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
