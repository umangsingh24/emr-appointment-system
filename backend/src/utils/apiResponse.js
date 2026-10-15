/**
 * Single place that shapes every successful response:
 * { success, message, data, meta }
 */
export function sendSuccess(res, { statusCode = 200, message = 'OK', data = null, meta = {} } = {}) {
  return res.status(statusCode).json({ success: true, message, data, meta });
}

export function sendError(res, { statusCode = 500, message, code, details } = {}) {
  const meta = {};
  if (code) meta.code = code;
  if (details) meta.details = details;
  return res.status(statusCode).json({ success: false, message, data: null, meta });
}
