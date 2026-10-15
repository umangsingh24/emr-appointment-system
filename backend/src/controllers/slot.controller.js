import * as slotService from '../services/slot.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function getSlots(req, res) {
  const { date } = req.validated.query;
  const doctors = await slotService.getSlots(req.validated.query, req.user);
  return sendSuccess(res, { data: doctors, meta: { date } });
}
