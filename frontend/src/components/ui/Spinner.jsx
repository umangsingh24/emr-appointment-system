import clsx from 'clsx';

export function Spinner({ className }) {
  return (
    <svg className={clsx('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
      <Spinner className="size-5 text-brand-700" />
      {label}
    </div>
  );
}
