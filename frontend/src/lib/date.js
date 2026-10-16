/**
 * Dates travel as "YYYY-MM-DD" strings and times as "HH:mm", exactly like the API.
 * "Today" is computed in the clinic timezone so it matches the server's notion of today.
 */
export const CLINIC_TIMEZONE = import.meta.env.VITE_CLINIC_TIMEZONE || 'Asia/Kolkata';

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayISO() {
  return isoFormatter.format(new Date());
}

/** Calendar Date (local midnight, as DayPicker returns) -> "YYYY-MM-DD". */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" -> local-midnight Date for DayPicker. */
export function fromISODate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value, days) {
  const date = fromISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

export function formatDate(value, { short = false } = {}) {
  if (!value) return '';
  return (short ? shortDate : longDate).format(fromISODate(value));
}

/** "13:30" -> "1:30 PM" */
export function formatTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDateTime(isoString) {
  if (!isoString) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: CLINIC_TIMEZONE }).format(
    new Date(isoString),
  );
}
