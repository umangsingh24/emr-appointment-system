import * as departmentService from '../services/department.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function listDepartments(_req, res) {
  const departments = await departmentService.listDepartments();
  return sendSuccess(res, { data: departments });
}

export async function createDepartment(req, res) {
  const department = await departmentService.createDepartment(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: 'Department created successfully', data: department });
}
