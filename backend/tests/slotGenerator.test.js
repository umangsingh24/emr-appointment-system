import { describe, expect, it } from 'vitest';
import { generateDaySlots } from '../src/services/slotGenerator.js';
import { minutesToTime } from '../src/utils/time.js';

const times = (slots) => slots.map((s) => minutesToTime(s.start));

describe('generateDaySlots', () => {
  it('splits a session into consecutive slots (spec example)', () => {
    const slots = generateDaySlots({ sessions: [{ start: '09:00', end: '10:00' }] }, 15);
    expect(times(slots)).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });

  it('never generates slots inside a break, including partially overlapping ones', () => {
    const slots = generateDaySlots(
      { sessions: [{ start: '09:00', end: '11:00' }], breaks: [{ start: '09:40', end: '10:10' }] },
      20,
    );
    // 09:20-09:40 is fine (touches the break edge); 09:40 and 10:00 overlap it.
    expect(times(slots)).toEqual(['09:00', '09:20', '10:20', '10:40']);
  });

  it('skips the lunch break between sessions (spec example)', () => {
    const slots = generateDaySlots(
      {
        sessions: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '17:00' },
        ],
        breaks: [{ start: '12:00', end: '13:00' }],
      },
      60,
    );
    expect(times(slots)).toEqual(['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']);
  });

  it('drops a trailing partial slot that would overrun the session', () => {
    const slots = generateDaySlots({ sessions: [{ start: '09:00', end: '09:50' }] }, 20);
    expect(times(slots)).toEqual(['09:00', '09:20']);
  });

  it('never returns overlapping slots, even for overlapping sessions', () => {
    const slots = generateDaySlots(
      {
        sessions: [
          { start: '09:00', end: '10:00' },
          { start: '09:30', end: '10:30' },
        ],
      },
      30,
    );
    for (let i = 1; i < slots.length; i += 1) expect(slots[i].start).toBeGreaterThanOrEqual(slots[i - 1].end);
    expect(times(slots)).toEqual(['09:00', '09:30', '10:00']);
  });

  it('returns nothing for a non-working day', () => {
    expect(generateDaySlots(undefined, 15)).toEqual([]);
  });
});
