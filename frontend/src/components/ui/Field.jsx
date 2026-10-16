import clsx from 'clsx';
import { useId } from 'react';

const CONTROL =
  'block w-full rounded-lg border-0 bg-white px-3 text-sm text-slate-900 ring-1 ring-inset placeholder:text-slate-400 ' +
  'focus:ring-2 focus:ring-inset focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

function controlClass(error, extra) {
  return clsx(CONTROL, error ? 'ring-rose-400 focus:ring-rose-500' : 'ring-slate-300 focus:ring-brand-600', extra);
}

/**
 * Label + control + hint/error, wired for accessibility (aria-invalid, aria-describedby).
 * `children` is a render function receiving the generated id and aria props.
 */
export function Field({ label, error, hint, required, className, children }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({
        id,
        'aria-invalid': Boolean(error) || undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p id={messageId} className={clsx('mt-1.5 text-xs', error ? 'text-rose-600' : 'text-slate-500')}>
          {message}
        </p>
      )}
    </div>
  );
}

export function Input({ error, className, ...props }) {
  return <input className={controlClass(error, clsx('h-10', className))} {...props} />;
}

export function Select({ error, className, children, ...props }) {
  return (
    <select className={controlClass(error, clsx('h-10 pr-8', className))} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ error, className, rows = 3, ...props }) {
  return <textarea rows={rows} className={controlClass(error, clsx('py-2', className))} {...props} />;
}
