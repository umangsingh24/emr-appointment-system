import clsx from 'clsx';
import { Spinner } from './Spinner.jsx';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
