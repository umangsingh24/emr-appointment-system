import { AUDIT_ACTIONS, ROLES } from '../config/constants.js';
import { Department, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPagination, buildSort, escapeRegex, paginationMeta } from '../utils/pagination.js';
import { recordAudit } from './audit.service.js';
import { hashPassword } from './auth.service.js';

export async function createUser(input, actor, context = {}) {
  const { password, ...profile } = input;

  if (profile.role === ROLES.DOCTOR) {
    const departmentExists = await Department.exists({ _id: profile.department, isActive: true });
    if (!departmentExists) throw ApiError.badRequest('Department does not exist');
  } else {
    delete profile.department;
    delete profile.specialization;
  }

  if (await User.exists({ email: profile.email })) {
    throw ApiError.conflict('A user with this email already exists', 'EMAIL_TAKEN');
  }

  const user = await User.create({ ...profile, passwordHash: await hashPassword(password) });

  recordAudit({
    actor,
    action: AUDIT_ACTIONS.USER_CREATED,
    entity: 'User',
    entityId: user._id,
    metadata: { role: user.role },
    ip: context.ip,
  });

  await user.populate('department', 'name code');
  return user.toJSON();
}

export async function listUsers({ role, search, page, limit, sort }) {
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const pagination = buildPagination({ page, limit });
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort(buildSort(sort, { name: 'name', email: 'email', role: 'role', createdAt: 'createdAt' }, { createdAt: -1 }))
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('department', 'name code')
      .lean(),
    User.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(pagination, total) };
}
