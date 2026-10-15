import * as userService from '../services/user.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function createUser(req, res) {
  const user = await userService.createUser(req.validated.body, req.user, requestContext(req));
  return sendSuccess(res, { statusCode: 201, message: 'User created successfully', data: user });
}

export async function listUsers(req, res) {
  const { items, meta } = await userService.listUsers(req.validated.query);
  return sendSuccess(res, { data: items, meta });
}
