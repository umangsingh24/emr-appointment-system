import { rangesOverlap, timeToMinutes } from '../utils/time.js';

/**
 * Pure slot generation for one day. No I/O, so it is trivially unit-testable.
 *
 * Rules:
 *  - Each session is cut into consecutive, non-overlapping slots of `slotDurationMinutes`.
 *  - A slot that would run past the end of its session is dropped (no partial slots).
 *  - A slot that overlaps any break, even partially, is dropped.
 *  - Output is sorted and de-duplicated, so overlapping session definitions can never
 *    produce overlapping slots.
 *
 * @param {{ sessions: {start: string, end: string}[], breaks?: {start: string, end: string}[] }} daySchedule
 * @param {number} slotDurationMinutes
 * @returns {{ start: number, end: number }[]} minutes since midnight
 */
export function generateDaySlots(daySchedule, slotDurationMinutes) {
  if (!daySchedule || !(slotDurationMinutes > 0)) return [];

  const breaks = (daySchedule.breaks ?? []).map((b) => ({ start: timeToMinutes(b.start), end: timeToMinutes(b.end) }));
  const sessions = (daySchedule.sessions ?? [])
    .map((s) => ({ start: timeToMinutes(s.start), end: timeToMinutes(s.end) }))
    .sort((a, b) => a.start - b.start);

  const slots = [];
  let lastEnd = -1;

  for (const session of sessions) {
    for (let start = session.start; start + slotDurationMinutes <= session.end; start += slotDurationMinutes) {
      const end = start + slotDurationMinutes;
      if (start < lastEnd) continue; // guards against overlapping sessions
      if (breaks.some((b) => rangesOverlap(start, end, b.start, b.end))) continue;
      slots.push({ start, end });
      lastEnd = end;
    }
  }

  return slots;
}
