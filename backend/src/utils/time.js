import { env } from '../config/env.js';
import { WEEKDAYS } from '../config/constants.js';

/**
 * Time model used across the app:
 *  - A calendar day is a "YYYY-MM-DD" string in the clinic timezone.
 *  - A time of day is an integer number of minutes since midnight (0..1440).
 * Using plain minutes avoids Date/timezone drift when generating and comparing slots.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTime(value) {
  return TIME_PATTERN.test(value);
}

export function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function timeToMinutes(value) {
  const [, hours, minutes] = TIME_PATTERN.exec(value);
  return Number(hours) * 60 + Number(minutes);
}

export function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Weekday code ("MON") for a YYYY-MM-DD calendar date. Independent of server timezone. */
export function weekdayOf(dateString) {
  return WEEKDAYS[new Date(`${dateString}T00:00:00Z`).getUTCDay()];
}

/** Current date and minute-of-day in the clinic timezone. */
export function clinicNow(now = new Date(), timeZone = env.CLINIC_TIMEZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** True when the slot starting at `startMinutes` on `date` is already in the past (clinic time). */
export function isPastSlot(date, startMinutes, now = clinicNow()) {
  if (date !== now.date) return date < now.date;
  return startMinutes <= now.minutes;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
