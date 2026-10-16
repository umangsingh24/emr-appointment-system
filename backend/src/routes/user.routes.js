import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as userController from '../controllers/user.controller.js';
import { authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createUserSchema, listUsersSchema } from '../validators/user.validator.js';

const router = Router();

// Staff account management is restricted to Super Admin.
router.use(authorize(ROLES.SUPER_ADMIN));
router.get('/', validate(listUsersSchema), userController.listUsers);
router.post('/', validate(createUserSchema), userController.createUser);

export default router;
