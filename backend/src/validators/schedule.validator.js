import { z } from 'zod';
import { WEEKDAYS } from '../config/constants.js';
import { rangesOverlap, timeToMinutes } from '../utils/time.js';
import { idParams, timeString } from './common.js';

const timeRange = z
  .object({
    label: z.string().trim().max(50).optional(),
    start: timeString,
    end: timeString,
  })
  .refine((r) => timeToMinutes(r.start) < timeToMinutes(r.end), {
    message: 'Start time must be before end time',
    path: ['end'],
  });

function findOverlap(ranges) {
  const sorted = ranges
    .map((r, index) => ({ index, start: timeToMinutes(r.start), end: timeToMinutes(r.end) }))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    if (rangesOverlap(sorted[i - 1].start, sorted[i - 1].end, sorted[i].start, sorted[i].end)) return sorted[i].index;
  }
  return -1;
}

const daySchedule = z.object({
  day: z.enum(WEEKDAYS),
  sessions: z.array(timeRange).min(1, 'At least one session is required').max(6),
  breaks: z.array(timeRange).max(6).default([]),
});

export const upsertScheduleSchema = {
  params: idParams,
  body: z
    .object({
      slotDurationMinutes: z.coerce.number().int().min(5).max(240),
      weeklySchedule: z.array(daySchedule).max(7),
    })
    .superRefine((schedule, ctx) => {
      const seenDays = new Set();
      schedule.weeklySchedule.forEach((day, dayIndex) => {
        if (seenDays.has(day.day)) {
          ctx.addIssue({ code: 'custom', message: `${day.day} is listed more than once`, path: ['weeklySchedule', dayIndex, 'day'] });
        }
        seenDays.add(day.day);

        for (const key of ['sessions', 'breaks']) {
          // Only check overlaps once individual ranges are valid.
          const valid = day[key].every((r) => timeToMinutes(r.start) < timeToMinutes(r.end));
          const overlapIndex = valid ? findOverlap(day[key]) : -1;
          if (overlapIndex !== -1) {
            ctx.addIssue({
              code: 'custom',
              message: `${key === 'sessions' ? 'Sessions' : 'Breaks'} must not overlap`,
              path: ['weeklySchedule', dayIndex, key, overlapIndex],
            });
          }
        }

        day.sessions.forEach((session, sessionIndex) => {
          if (timeToMinutes(session.end) - timeToMinutes(session.start) < schedule.slotDurationMinutes) {
            ctx.addIssue({
              code: 'custom',
              message: 'Session is shorter than the slot duration',
              path: ['weeklySchedule', dayIndex, 'sessions', sessionIndex],
            });
          }
        });
      });
    }),
};
