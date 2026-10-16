import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { addDays, formatDate, fromISODate, toISODate } from '../../lib/date.js';

/**
 * Date control: previous/next-day arrows plus a calendar popover.
 * Value in/out is a "YYYY-MM-DD" string, matching the API.
 */
export function DatePicker({ value, onChange, minDate, label = 'Date', className }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const previous = addDays(value, -1);
  const canGoBack = !minDate || previous >= minDate;

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex h-10 items-stretch rounded-lg bg-white ring-1 ring-slate-300 ring-inset">
        <button
          type="button"
          className="px-2 text-slate-500 hover:text-slate-900 disabled:text-slate-300"
          onClick={() => onChange(previous)}
          disabled={!canGoBack}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 px-2 text-sm font-medium whitespace-nowrap text-slate-800"
          onClick={() => setOpen((isOpen) => !isOpen)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <CalendarDays className="size-4 text-brand-700" aria-hidden="true" />
          {formatDate(value)}
        </button>
        <button
          type="button"
          className="px-2 text-slate-500 hover:text-slate-900"
          onClick={() => onChange(addDays(value, 1))}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {open && (
        <div role="dialog" aria-label="Choose date" className="absolute left-0 z-30 mt-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
          <DayPicker
            mode="single"
            required
            selected={fromISODate(value)}
            defaultMonth={fromISODate(value)}
            disabled={minDate ? { before: fromISODate(minDate) } : undefined}
            weekStartsOn={1}
            onSelect={(date) => {
              if (!date) return;
              onChange(toISODate(date));
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
