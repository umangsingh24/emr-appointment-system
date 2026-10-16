/** Helpers that read the API's { success, message, data, meta } error envelope. */

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (error?.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  return fallback;
}

export function getErrorCode(error) {
  return error?.response?.data?.meta?.code;
}

/**
 * Maps server validation details ("body.newPatient.mobile") onto form field names
 * ("newPatient.mobile") so React Hook Form can show them inline.
 */
export function applyServerFieldErrors(error, setError) {
  const details = error?.response?.data?.meta?.details;
  if (!Array.isArray(details)) return false;
  let applied = false;
  for (const { field, message } of details) {
    const name = field.replace(/^(body|query|params)\./, '');
    if (name) {
      setError(name, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}
