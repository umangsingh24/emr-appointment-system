import { z } from 'zod';
import { WEEKDAYS } from '../../lib/constants.js';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (value) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

const range = z
  .object({ label: z.string().trim().max(50).optional(), start: z.string().regex(TIME, 'Required'), end: z.string().regex(TIME, 'Required') })
  .refine((r) => toMinutes(r.start) < toMinutes(r.end), { path: ['end'], message: 'Must be after start' });

function overlapIndex(ranges) {
  const sorted = ranges
    .map((r, index) => ({ index, start: toMinutes(r.start), end: toMinutes(r.end) }))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start < sorted[i - 1].end) return sorted[i].index;
  }
  return -1;
}

/** Same rules the API enforces in schedule.validator.js, checked before saving. */
export const scheduleFormSchema = z
  .object({
    slotDurationMinutes: z.coerce.number().int('Whole minutes only').min(5, 'At least 5 minutes').max(240, 'At most 240 minutes'),
    days: z.array(
      z.object({
        day: z.enum(WEEKDAYS),
        working: z.boolean(),
        sessions: z.array(range),
        breaks: z.array(range),
      }),
    ),
  })
  .superRefine((form, ctx) => {
    form.days.forEach((day, dayIndex) => {
      if (!day.working) return;
      if (day.sessions.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['days', dayIndex, 'sessions'], message: 'Add at least one session' });
        return;
      }
      for (const key of ['sessions', 'breaks']) {
        const index = overlapIndex(day[key]);
        if (index !== -1) {
          ctx.addIssue({ code: 'custom', path: ['days', dayIndex, key, index, 'start'], message: 'Overlaps another time range' });
        }
      }
      day.sessions.forEach((session, sessionIndex) => {
        if (toMinutes(session.end) - toMinutes(session.start) < form.slotDurationMinutes) {
          ctx.addIssue({
            code: 'custom',
            path: ['days', dayIndex, 'sessions', sessionIndex, 'end'],
            message: 'Shorter than one slot',
          });
        }
      });
    });
  });

const DEFAULT_SESSIONS = [
  { label: 'Morning', start: '09:00', end: '13:00' },
  { label: 'Afternoon', start: '14:00', end: '17:00' },
];

/** API schedule (or null) -> form values with all seven days present. */
export function toFormValues(schedule) {
  const byDay = new Map((schedule?.weeklySchedule ?? []).map((d) => [d.day, d]));
  return {
    slotDurationMinutes: schedule?.slotDurationMinutes ?? 15,
    days: WEEKDAYS.map((day) => {
      const existing = byDay.get(day);
      if (existing) return { day, working: true, sessions: existing.sessions, breaks: existing.breaks ?? [] };
      // New schedules start with a sensible Mon–Fri template.
      const working = !schedule && !['SAT', 'SUN'].includes(day);
      return { day, working, sessions: working ? DEFAULT_SESSIONS : [], breaks: [] };
    }),
  };
}

/** Form values -> PUT /doctors/:id/schedule body. Non-working days are simply omitted. */
export function toPayload(values) {
  const clean = ({ label, start, end }) => ({ ...(label?.trim() ? { label: label.trim() } : {}), start, end });
  return {
    slotDurationMinutes: values.slotDurationMinutes,
    weeklySchedule: values.days
      .filter((d) => d.working)
      .map((d) => ({ day: d.day, sessions: d.sessions.map(clean), breaks: d.breaks.map(clean) })),
  };
}
