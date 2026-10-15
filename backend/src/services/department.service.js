import { Department } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

export function listDepartments() {
  return Department.find({ isActive: true }).sort({ name: 1 }).select('name code').lean();
}

export async function createDepartment({ name, code }) {
  try {
    const department = await Department.create({ name, code });
    return department.toJSON();
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('Department name or code already exists', 'DEPARTMENT_EXISTS');
    throw err;
  }
}
