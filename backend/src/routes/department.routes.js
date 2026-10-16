import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as departmentController from '../controllers/department.controller.js';
import { authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createDepartmentSchema } from '../validators/department.validator.js';

const router = Router();

router.get('/', departmentController.listDepartments);
router.post('/', authorize(ROLES.SUPER_ADMIN), validate(createDepartmentSchema), departmentController.createDepartment);

export default router;
