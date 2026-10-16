import clsx from 'clsx';
import { STATUS_META } from '../../lib/constants.js';

const TONES = {
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export function Badge({ tone = 'slate', className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'slate' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
