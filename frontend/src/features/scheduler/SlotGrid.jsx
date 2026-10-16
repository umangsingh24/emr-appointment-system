import clsx from 'clsx';
import { memo } from 'react';
import { SLOT_STATUS } from '../../lib/constants.js';
import { formatTime } from '../../lib/date.js';

const SLOT_STYLES = {
  [SLOT_STATUS.AVAILABLE]: 'bg-white text-brand-800 ring-brand-200 hover:bg-brand-50 hover:ring-brand-500',
  [SLOT_STATUS.BOOKED]: 'bg-sky-600 text-white ring-sky-600 hover:bg-sky-700',
  BOOKED_ARRIVED: 'bg-amber-500 text-white ring-amber-500 hover:bg-amber-600',
  BOOKED_COMPLETED: 'bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700',
  [SLOT_STATUS.PAST]: 'bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed',
};

function styleFor(slot) {
  if (slot.status !== SLOT_STATUS.BOOKED) return SLOT_STYLES[slot.status];
  return SLOT_STYLES[`BOOKED_${slot.appointmentStatus}`] ?? SLOT_STYLES[SLOT_STATUS.BOOKED];
}

function describe(slot) {
  const time = `${formatTime(slot.start)} to ${formatTime(slot.end)}`;
  if (slot.status === SLOT_STATUS.AVAILABLE) return `${time}, available. Book this slot.`;
  if (slot.status === SLOT_STATUS.BOOKED) return `${time}, booked (${slot.appointmentStatus.toLowerCase()}). View appointment.`;
  return `${time}, in the past.`;
}

/**
 * Memoised so that when a live update changes one slot, React re-renders only that cell.
 * Props are primitives (plus stable callbacks), which keeps the shallow comparison cheap.
 */
const SlotCell = memo(function SlotCell({ doctorId, start, end, status, appointmentId, appointmentStatus, canBook, onBook, onOpen }) {
  const slot = { start, end, status, appointmentStatus };
  const isBooked = status === SLOT_STATUS.BOOKED;
  const isAvailable = status === SLOT_STATUS.AVAILABLE;
  const interactive = isBooked || (isAvailable && canBook);

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={describe(slot)}
      title={describe(slot)}
      onClick={() => (isBooked ? onOpen(appointmentId) : onBook(doctorId, start))}
      className={clsx(
        'h-9 rounded-md text-xs font-medium tabular-nums ring-1 transition-colors ring-inset',
        styleFor(slot),
        isAvailable && !canBook && 'cursor-default hover:bg-white hover:ring-brand-200',
      )}
    >
      {formatTime(start).replace(' ', ' ')}
    </button>
  );
});

export function SlotGrid({ doctorId, slots, canBook, onBook, onOpen }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
      {slots.map((slot) => (
        <SlotCell
          key={slot.start}
          doctorId={doctorId}
          start={slot.start}
          end={slot.end}
          status={slot.status}
          appointmentId={slot.appointmentId}
          appointmentStatus={slot.appointmentStatus}
          canBook={canBook}
          onBook={onBook}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

export function SlotLegend() {
  const items = [
    ['Available', 'bg-white ring-1 ring-brand-300'],
    ['Booked', 'bg-sky-600'],
    ['Arrived', 'bg-amber-500'],
    ['Completed', 'bg-emerald-600'],
    ['Past', 'bg-slate-200'],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600" aria-label="Legend">
      {items.map(([label, swatch]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={clsx('size-3 rounded-sm', swatch)} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
